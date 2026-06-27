import { buildApiUrl, isAuthApiConfigured } from "@/lib/auth/paths";
import type { AppResponse } from "@/lib/api/generated";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  allowEmptyData?: boolean;
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  if (!isAuthApiConfigured) {
    throw new ApiClientError(
      "API URL is not configured.",
      503,
      "API_NOT_CONFIGURED"
    );
  }

  const { allowEmptyData = false, body, headers, ...requestInit } = options;
  let response: Response;

  try {
    response = await fetch(buildApiUrl(path), {
      credentials: "include",
      ...requestInit,
      headers: {
        ...(body === undefined
          ? undefined
          : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError("API server is unavailable.", 503);
  }

  if (response.status === 204 && allowEmptyData) {
    return undefined as T;
  }

  let appResponse: AppResponse<T>;

  try {
    appResponse = (await response.json()) as AppResponse<T>;
  } catch {
    throw new ApiClientError(
      "API response was not valid JSON.",
      response.status || 500
    );
  }

  if (!response.ok || !appResponse.success || appResponse.data === null) {
    if (response.ok && appResponse.success && allowEmptyData) {
      return undefined as T;
    }

    throw new ApiClientError(
      appResponse.error?.message ?? "API request failed.",
      response.status,
      appResponse.error?.code
    );
  }

  return appResponse.data;
}
