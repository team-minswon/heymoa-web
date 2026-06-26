import type { AppError, AppResponse } from "@/lib/auth/types";

export class AppResponseError extends Error {
  public readonly code?: string;
  public readonly details?: AppError["details"];

  constructor(message: string, code?: string, details?: AppError["details"]) {
    super(message);
    this.name = "AppResponseError";
    this.code = code;
    this.details = details;
  }
}

export function unwrapAppResponse<T>(body: AppResponse<T>): T {
  if (!body.success || body.data === null) {
    throw new AppResponseError(
      body.error?.message ?? "Request failed.",
      body.error?.code,
      body.error?.details
    );
  }

  return body.data;
}

export function unwrapGeneratedAppResponse<T>(response: {
  data?: AppResponse<T>;
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
