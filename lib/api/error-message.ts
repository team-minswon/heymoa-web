/**
 * 계약 오류 봉투에서 사용자에게 보일 문구를 뽑는다.
 *
 * `apiFetch`는 비-2xx일 때 응답 본문을 그대로 throw한다 — 형태는
 * `{ success: false, data: null, error: { code, message, details } }`다.
 * SSE 클라이언트(`lib/api/sse.ts`)도 같은 봉투를 던진다.
 */

export type ApiErrorEnvelope = {
  success: false;
  data: null;
  error: { code: string; message: string; details?: unknown };
};

function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return false;
  return typeof (error as { message?: unknown }).message === "string";
}

/** 계약 코드가 있으면 돌려준다. 네트워크 오류처럼 봉투가 아닌 실패는 null이다. */
export function errorCodeOf(error: unknown): string | null {
  return isApiErrorEnvelope(error) ? error.error.code : null;
}

/**
 * 서버 문구를 우선 쓴다 — 계약이 사용자에게 보일 수 있는 한국어 메시지를 담고 있고,
 * web이 코드별 문구를 다시 만들면 서버가 바뀔 때마다 갈라진다.
 */
export function errorMessageOf(error: unknown, fallback: string): string {
  if (isApiErrorEnvelope(error)) return error.error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
