import { AuthRefreshError, refreshAuthOnce } from "@/lib/api/fetcher";
import { openSessionGate } from "@/lib/auth/session-gate";

/**
 * 소켓을 다시 붙이기 전의 접근 토큰 갱신. 쿠키(30분)가 만료되면 핸드셰이크가 매번 401 로 거절되는데
 * 브라우저는 그 상태 코드를 못 보고 연결 실패로만 안다. 그래서 CONNECTED 전에 실패한 시도 뒤에만 부른다 —
 * 붙어 있다 끊긴 것은 토큰 탓이 아니다.
 *
 * 던지지 않는다. 갱신이 실패하거나 `timeoutMs` 를 넘겨도 호출부는 그대로 다시 붙어 본다.
 * 다시 로그인해야 하면(갱신 토큰까지 죽었다) 세션 게이트를 열고 true 를 돌려준다.
 */
export async function refreshAuthBeforeReconnect(timeoutMs: number) {
  let timer: number | undefined;
  const expired = await Promise.race([
    refreshAuthOnce().then(
      () => false,
      (error: unknown) => {
        if (!(error instanceof AuthRefreshError && error.expired)) return false;
        openSessionGate();
        return true;
      }
    ),
    new Promise<false>((resolve) => {
      timer = window.setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
  window.clearTimeout(timer);
  return expired;
}
