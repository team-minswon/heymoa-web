type AppResponseLike<T> = {
  success: boolean;
  data?: T | null;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  } | null;
};

export class AppResponseError extends Error {
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "AppResponseError";
    this.code = code;
    this.details = details;
  }
}

function isAppResponseLike(value: unknown): value is AppResponseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof (value as { success?: unknown }).success === "boolean"
  );
}

export function toAppResponseError(
  error: unknown,
  fallback = "Request failed."
) {
  if (error instanceof AppResponseError) {
    return error;
  }

  if (isAppResponseLike(error)) {
    return new AppResponseError(
      error.error?.message ?? fallback,
      error.error?.code,
      error.error?.details
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new AppResponseError(fallback);
}

export function unwrapAppResponse<T>(body: AppResponseLike<T>): T {
  if (!body.success || body.data === null || body.data === undefined) {
    throw new AppResponseError(
      body.error?.message ?? "Request failed.",
      body.error?.code,
      body.error?.details
    );
  }

  return body.data;
}

export function unwrapGeneratedAppResponse<T>(response: {
  data?: AppResponseLike<T>;
}): T {
  if (!response.data) {
    throw new AppResponseError("Empty response.");
  }

  return unwrapAppResponse(response.data);
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "message" in error.error &&
    typeof error.error.message === "string"
  ) {
    return error.error.message;
  }

  return fallback;
}
