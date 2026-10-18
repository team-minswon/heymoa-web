/**
 * 「이 사용자가 이걸 했다」를 브라우저에 적어 두는 작은 표시들. **키에 userId 가 들어간다** — 같은 브라우저에서
 * 계정을 바꿔도 앞 사람의 표시를 이어받지 않는다. 값이 소개를 닫았나, 말풍선을 껐나, 어디까지 봤나 같은 화면
 * 상태라 서버에 두지 않는다(잃으면 안내가 한 번 더 뜰 뿐이다). **로그아웃·세션 만료 때 `clearUserFlags()` 로 지운다** —
 * 공용 브라우저에서 앞 사람의 흔적이 남지 않게. 같은 사람이 다시 로그인하면 안내가 한 번 더 뜬다.
 *
 * **저장소의 나머지 키(지금 있는 것 전부).** 새 키를 만들기 전에 이 목록과 아래 질문으로 자리를 고른다.
 * - 이 기기·브라우저의 사정이면 기기 범위 `heymoa:...` : `analytics-opt-out`(처리방침 5조의 거부 방법이라
 *   초기화하지 않는다), `last-workspace`·`last-meeting-project:{워크스페이스}`(읽을 때 내 목록으로 검증한다),
 *   `heymoa.transcription.recording:*`(5분 지나면 읽을 때 지운다)
 * - 내 계정의 표시면 이 파일의 사용자 표시 · `heymoa:onboarding:{userId}`(체크리스트, 자체 모듈)
 * - 탭 하나의 수명이면 sessionStorage `heymoa.transcription.clientInstanceId`
 * - 서버가 첫 화면을 그릴 때 알아야 하면 쿠키 `sidebar_state`
 * - 기기를 넘어 같아야 하거나 잃으면 곤란하면 DB 다(아직 그런 값이 없다)
 */
const PREFIX = "heymoa:u:";

export const USER_FLAGS = {
  agentIntroDismissed: "agent-intro-dismissed",
  endNudgeOff: "end-nudge-off",
  feedbackSeen: "feedback-seen",
} as const;

export type UserFlag = keyof typeof USER_FLAGS;

/** 사용자별로 옮기기 전의 전역 키와 읽는 코드가 사라진 키. 한 번 지운다. */
const LEGACY_KEYS = [
  "heymoa:agent-intro-dismissed",
  "heymoa:end-nudge-off",
  "heymoa:feedback-seen",
  "heymoa:desktop-promo-dismissed",
];

let purged = false;

function purgeLegacyOnce() {
  if (purged) return;
  purged = true;
  try {
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
  } catch {
    // 저장소를 못 쓰는 브라우저는 지울 것도 없다.
  }
}

const keyOf = (userId: string, flag: UserFlag) =>
  `${PREFIX}${userId}:${USER_FLAGS[flag]}`;

/** 없으면 `null`, **저장소를 못 읽으면 `undefined`** — 둘을 가를 수 있어야 하는 안내(못 읽으면 닫힌 것으로 본다)가 있다. */
export function readUserFlag(
  userId: string,
  flag: UserFlag
): string | null | undefined {
  purgeLegacyOnce();
  try {
    return window.localStorage.getItem(keyOf(userId, flag));
  } catch {
    return undefined;
  }
}

/** 적었으면 true. 막힌 브라우저에서는 false 이고, 그때는 이번 방문 안의 상태로만 버틴다. */
export function writeUserFlag(
  userId: string,
  flag: UserFlag,
  value: string
): boolean {
  try {
    window.localStorage.setItem(keyOf(userId, flag), value);
    return true;
  } catch {
    return false;
  }
}

/** 이 브라우저에 남은 모든 사용자의 표시를 지운다. 기기 범위 키(분석 거부 등)는 건드리지 않는다. */
export function clearUserFlags() {
  try {
    const storage = window.localStorage;
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(PREFIX)) storage.removeItem(key);
    }
  } catch {
    // 저장소를 못 쓰는 브라우저는 지울 것도 없다.
  }
}
