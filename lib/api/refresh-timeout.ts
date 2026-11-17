export const REFRESH_TIMEOUT_MS = 15_000;

/** `AbortSignal.timeout` 대신 타이머를 직접 둡니다 — Safari 16 미만에 없고, 시험이 가짜 타이머로 시한을 넘길 수 있습니다. */
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
