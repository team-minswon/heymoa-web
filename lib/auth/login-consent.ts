import {
  getCurrentUser,
  recordConsents,
} from "@/lib/api/generated/users/users";
import type { CurrentUserResponseData } from "@/lib/api/generated/models";

/**
 * 로그인 동의(APP-1277). 로그인 창에서 「개인정보 처리방침과 이용약관을 읽었으며 동의합니다」를 체크해야 로그인이
 * 시작된다. 로그인은 Google 을 다녀오는 전체 이동이라 창의 상태가 사라지므로, 체크하고 로그인을 시작했다는 표시를
 * **같은 탭의 sessionStorage** 에 남기고 돌아온 `/auth/callback` 이 읽는다. 표시가 없으면(초대·외부 에이전트 로그인
 * 링크처럼 창을 거치지 않은 로그인) 동의를 기록하지 않고 callback 이 같은 체크박스로 한 번 더 받는다 —
 * **체크하지 않은 동의는 기록하지 않는다.**
 *
 * 기록하는 쪽은 서버다(`POST /v1/users/me/consents`, APP-1276). 문서 버전은 서버가 정한 값(`currentVersion`)을
 * 내 정보에서 받아 그대로 돌려보낸다 — web 이 버전을 들고 있지 않는다.
 */
const KEY = "heymoa:login-consent";
/** Google 로그인(2단계 인증 등)에 걸릴 수 있는 시간. 이 안에 돌아오지 않으면 표시는 무효다. */
const TTL_MS = 30 * 60 * 1000;

/** 체크하고 로그인을 시작하는 순간 남긴다. 저장소를 못 쓰는 브라우저면 callback 이 동의를 다시 받는다. */
export function rememberLoginConsent(now = Date.now()) {
  try {
    window.sessionStorage.setItem(KEY, String(now));
  } catch {
    // 못 남기면 callback 이 체크박스를 한 번 더 보인다.
  }
}

function hasLoginConsent(now = Date.now()) {
  try {
    const at = Number(window.sessionStorage.getItem(KEY));
    return at > 0 && now - at < TTL_MS;
  } catch {
    return false;
  }
}

function forgetLoginConsent() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // 지울 것도 없다.
  }
}

async function loadAccount(): Promise<CurrentUserResponseData> {
  const response = await getCurrentUser();
  if (response.status !== 200 || !response.data.success) {
    throw new Error("CURRENT_USER_FAILED");
  }
  return response.data.data;
}

async function record(account: CurrentUserResponseData) {
  await recordConsents({
    consents: account.consents.map(({ documentType, currentVersion }) => ({
      documentType,
      version: currentVersion,
    })),
  });
  forgetLoginConsent();
}

/**
 * 로그인 직후 동의를 맞춘다. 이미 지금 버전에 동의했으면 아무것도 안 하고 `done`, 아직인데 로그인 창에서 체크한
 * 표시가 있으면 기록하고 `done`, 표시가 없으면 기록하지 않고 `ask` 다(callback 이 체크박스를 보인다).
 * 조회·기록이 실패하면 던진다 — 호출한 쪽이 다시 시도하게 한다.
 */
export async function settleLoginConsent(): Promise<"done" | "ask"> {
  const account = await loadAccount();
  if (!account.consentRequired) {
    forgetLoginConsent();
    return "done";
  }
  if (!hasLoginConsent()) return "ask";
  await record(account);
  return "done";
}

/** 사용자가 callback 화면에서 직접 체크한 뒤 기록한다. 그 사이 다른 탭이 기록했으면 건너뛴다. */
export async function recordConsentNow() {
  const account = await loadAccount();
  if (account.consentRequired) await record(account);
  else forgetLoginConsent();
}
