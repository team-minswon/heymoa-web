import { notifyAuthStateChanged } from "@/lib/auth/events";

/**
 * 인증이 끝났다는 사실을 기억하는 단 한 곳.
 *
 * 이것이 없으면 401을 만난 호출부가 각자 갱신을 시도한다. 쿼리 호출부가 31곳이고 그중
 * 5곳이 폴링이라, 갱신이 실패해도 아무도 멈추지 않아 요청이 무한히 나간다.
 *
 * 닫는 방법은 두지 않는다. 만료는 새 문서(새로고침·재로그인 뒤 이동)로만 풀린다.
 */
let expired = false;

/**
 * **게이트는 브라우저에서만 산다.**
 *
 * 모듈 수준 상태를 서버에서 쓰면 Next 프로세스가 그 값을 모든 요청과 공유한다. 비로그인
 * 사용자의 SSR prefetch(`lib/workspace/prefetch.ts`)가 401 → 갱신 400을 겪으면 게이트가
 * 열리고, 그 뒤 같은 프로세스로 들어온 **다른 사용자**의 SSR까지 차단돼 화면이 빈다.
 *
 * 서버에서는 항상 닫힌 것으로 보고 열리지도 않는다. 만료를 다루는 주체는 브라우저 세션이다.
 */
function isBrowser() {
  return typeof window !== "undefined";
}

/** 게이트가 열린 뒤에 발생한 요청. 네트워크를 타지 않고 즉시 거절된다. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired.");
    this.name = "SessionExpiredError";
  }
}

export function isSessionExpired() {
  return isBrowser() && expired;
}

/**
 * 만료를 한 번만 알린다.
 *
 * 멱등성이 이 함수의 핵심이다. 401을 만난 호출부가 몇이든 뒤따르는 처리(로그아웃·토스트·
 * 이동)는 한 번만 일어나야 한다. 없으면 토스트가 호출부 수만큼 뜬다.
 */
export function openSessionGate() {
  if (!isBrowser() || expired) {
    return;
  }

  expired = true;
  notifyAuthStateChanged({ reason: "unauthenticated" });
}

/**
 * 스스로 로그아웃했을 때. 게이트는 열되 **만료를 알리지 않는다.**
 *
 * 로그아웃 응답이 온 뒤에도 새 문서가 뜨기까지 수백 ms 동안 폴링 타이머와 이미 예약된
 * 조회가 계속 깨어난다. 그 시점엔 쿠키가 이미 지워져서 401 → 갱신 실패 →
 * `openSessionGate()` 순으로 만료 경로가 열리고, 사용자가 직접 누른 로그아웃이
 * "세션이 만료되었습니다"로 둔갑한 채 홈에 떨어졌다.
 *
 * 그 요청들을 네트워크 앞에서 막는 것이 이 함수다. 이동과 문구는 호출부가 정한다.
 */
export function openSessionGateQuietly() {
  if (!isBrowser()) {
    return;
  }

  expired = true;
}

/** 테스트 전용. 모듈 수준 상태를 초기화한다. */
export function resetSessionGate() {
  expired = false;
}
