import { notifyAuthStateChanged } from "@/lib/auth/events";

type ApiFetchOptions = RequestInit & {
  headers?: HeadersInit;
  data?: BodyInit | Record<string, unknown>;
  params?: Record<string, unknown>;
  responseType?: string;
  skipAuthRefresh?: boolean;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

let refreshPromise: Promise<void> | null = null;

function buildUrl(path: string, params?: Record<string, unknown>) {
  const url = new URL(path, apiBaseUrl || "http://localhost");

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  if (!apiBaseUrl) {
    return `${url.pathname}${url.search}`;
  }

  return url.toString();
}

function buildBody(data: ApiFetchOptions["data"], body?: BodyInit | null) {
  if (body !== undefined) {
    return body;
  }

  if (!data || data instanceof FormData || data instanceof Blob) {
    return data;
  }

  return JSON.stringify(data);
}

function isJsonData(data: ApiFetchOptions["data"]) {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(data);

  return prototype === Object.prototype || prototype === null;
}

function shouldSkipRefresh(url: string, options: ApiFetchOptions) {
  if (options.skipAuthRefresh) {
    return true;
  }

  return (
    url.includes("/v1/auth/refresh") ||
    url.includes("/v1/auth/logout") ||
    url.includes("/v1/auth/oauth2/")
  );
}

export async function refreshAuthOnce() {
  if (!refreshPromise) {
    refreshPromise = fetch(buildUrl("/v1/auth/refresh"), {
      method: "POST",
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Authentication refresh failed.");
        }
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function isOnboardingRequiredError(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: { code?: unknown } }).error?.code === "string" &&
    (value as { error: { code: string } }).error.code === "ONBOARDING_REQUIRED"
  );
}

async function parseResponse<T>(response: Response, responseType?: string) {
  const responseData =
    response.status === 204
      ? undefined
      : responseType === "blob"
        ? await response.blob()
        : await response.json();

  if (!response.ok) {
    if (
      typeof window !== "undefined" &&
      response.status === 403 &&
      isOnboardingRequiredError(responseData)
    ) {
      window.location.assign("/onboarding");
    }

    throw responseData;
  }

  return {
    data: responseData as T,
    status: response.status,
    headers: response.headers,
  } as T;
}

async function request<T>(
  url: string,
  options: ApiFetchOptions,
  hasRetried: boolean
): Promise<T> {
  const {
    headers,
    body,
    data,
    params,
    signal,
    responseType,
    skipAuthRefresh,
    ...requestOptions
  } = options;
  const isJsonBody = isJsonData(data) || typeof body === "string";
  const builtUrl = buildUrl(url, params);

  const response = await fetch(builtUrl, {
    ...requestOptions,
    credentials: "include",
    headers: {
      ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: buildBody(data, body),
    signal,
  });

  if (
    response.status === 401 &&
    !hasRetried &&
    !shouldSkipRefresh(url, { ...options, skipAuthRefresh })
  ) {
    try {
      await refreshAuthOnce();
      return request<T>(url, options, true);
    } catch {
      notifyAuthStateChanged({ reason: "unauthenticated" });
      throw new Error("Authentication refresh failed.");
    }
  }

  return parseResponse<T>(response, responseType);
}

export async function apiFetch<T>(
  url: string,
  options?: ApiFetchOptions
): Promise<T> {
  return request<T>(url, options ?? {}, false);
}
