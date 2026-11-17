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

export function errorCodeOf(error: unknown): string | null {
  return isApiErrorEnvelope(error) ? error.error.code : null;
}

export function errorMessageOf(error: unknown, fallback: string): string {
  if (isApiErrorEnvelope(error)) return error.error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

