export const AUTH_STATE_CHANGED_EVENT = "heymoa:auth-state-changed";

/**
 * 만료로 쫓겨났다는 사실을 **새 문서 너머로** 옮기는 쿼리 키.
 *
 * 만료 처리는 하드 내비게이션이라(세션 게이트가 새 문서로만 풀린다) 토스트가 이동과 함께
 * 사라진다. 이유 없이 홈에 떨어지면 무슨 일이 있었는지 알 수 없어서 쿼리로 넘긴다.
 */
export const SESSION_EXPIRED_PARAM = "session=expired";

export type AuthStateChangedDetail = {
  reason: "logout" | "unauthenticated";
};

export function notifyAuthStateChanged(detail: AuthStateChangedDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AuthStateChangedDetail>(AUTH_STATE_CHANGED_EVENT, {
      detail,
    })
  );
}
