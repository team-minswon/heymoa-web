/**
 * 토큰 갱신 호출의 요청 시한입니다. 갱신은 모든 401 재시도와 채팅 연결 전 갱신이 한 promise 를
 * 나눠 쓰므로(`refreshAuthOnce`), 응답이 안 오면 그 전부가 같이 멈춥니다.
 *
 * server 갱신은 트랜잭션 하나이고 최대 지연이 풀 대기 5초라 정상일 때 이 시한은 닿지 않습니다.
 * 노트 토픽 클라이언트의 갱신 대기(10초)보다 길게 두어, 그쪽 race 가 먼저 풀리고 갱신은 이어집니다.
 */
export const REFRESH_TIMEOUT_MS = 15_000;

/**
 * 시한이 지나면 `TimeoutError` 로 끊는 fetch 입니다. `AbortSignal.timeout` 이 아니라 타이머를 직접 두는
 * 까닭은 구형 브라우저(Safari 16 미만)에 없고, 시험이 가짜 타이머로 시한을 결정적으로 넘길 수 있어서입니다.
 * 시한은 응답 헤더가 올 때까지만 잽니다.
 */
export function fetchWithRefreshTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("refresh timed out", "TimeoutError"));
  }, REFRESH_TIMEOUT_MS);

  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}
