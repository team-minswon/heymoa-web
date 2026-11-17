import { fetchWithRefreshTimeout } from "@/lib/api/refresh-timeout";
import { isRefreshTokenDead } from "@/lib/auth/refresh-failure";
import {
  isSessionExpired,
  openSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";
import { acceptLanguageHeader } from "@/lib/i18n/document-locale";
import { webMessage } from "@/lib/i18n/web-message";

type ApiFetchOptions = RequestInit & {
  headers?: HeadersInit;
  data?: BodyInit | Record<string, unknown>;
  params?: Record<string, unknown>;
  responseType?: string;
  skipAuthRefresh?: boolean;
  /** 응답 헤더까지 기다릴 한도(ms)입니다. 연결이 반쯤 끊기면 fetch 는 몇 분이 지나도 실패하지 않습니다. */
  timeoutMs?: number;
};

export const REQUEST_TIMEOUT_MS = 20_000;

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

let refreshPromise: Promise<void> | null = null;

export function buildUrl(path: string, params?: Record<string, unknown>) {
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

export class AuthRefreshError extends Error {
  readonly expired: boolean;
  constructor(expired: boolean) {
    super("Authentication refresh failed.");
    this.name = "AuthRefreshError";
    this.expired = expired;
  }
}

export function isAuthError(error: unknown) {
  if (error instanceof SessionExpiredError) {
    return true;
  }

  return error instanceof AuthRefreshError && error.expired;
}

/** prerender 된 문서는 활성화까지 기다립니다. 폐기된 prerender 가 갱신하면 서버는 토큰을 회전시켰는데 새 쿠키를 아무도 못 받습니다. `document.prerendering` 은 아직 lib.dom 에 없습니다. */
function whenActivated() {
  const doc =
    typeof document === "undefined"
      ? null
      : (document as Document & { prerendering?: boolean });

  if (!doc?.prerendering) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    doc.addEventListener("prerenderingchange", () => resolve(), { once: true });
  });
}

export async function refreshAuthOnce() {
  if (!refreshPromise) {
    refreshPromise = whenActivated()
      .then(() =>
        fetchWithRefreshTimeout(buildUrl("/v1/auth/refresh"), {
          method: "POST",
          credentials: "include",
        })
      )
      .then(async (response) => {
        if (!response.ok) {
          throw new AuthRefreshError(await isRefreshTokenDead(response));
        }
      })
      .catch((error) => {
        if (error instanceof AuthRefreshError) throw error;
        throw new AuthRefreshError(false);
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export class ApiError extends Error {
  readonly success = false as const;
  readonly data = null;
  readonly error: { code: string; message: string; details?: unknown };
  readonly status: number;
  readonly retryAfterMs: number | null;

  constructor(
    status: number,
    error: { code: string; message: string; details?: unknown },
    retryAfterMs: number | null
  ) {
    super(error.message);
    this.name = "ApiError";
    this.status = status;
    this.error = error;
    this.retryAfterMs = retryAfterMs;
  }
}

/** 봉투가 없을 때의 문구입니다. ALB 가 돌려주는 HTML 502·503·504 나 본문 없는 429 가 옵니다. */
function fallbackMessage(status: number) {
  if (status === 429) return webMessage("tooManyRequests");
  if (status >= 500) return webMessage("serverUnavailable");
  return webMessage("requestFailed");
}

export function retryAfterMsOf(headers: Headers) {
  const seconds = Number(headers.get("Retry-After"));
  return headers.has("Retry-After") && Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1000
    : null;
}

async function toApiError(response: Response) {
  const text = await response.text().catch(() => "");
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
  }
  const error = (body as { error?: { code?: unknown; message?: unknown } } | null)
    ?.error;
  const envelope =
    typeof error?.code === "string" && typeof error.message === "string"
      ? (error as ApiError["error"])
      : { code: `HTTP_${response.status}`, message: fallbackMessage(response.status) };
  return new ApiError(response.status, envelope, retryAfterMsOf(response.headers));
}

async function parseResponse<T>(response: Response, responseType?: string) {
  if (!response.ok) {
    throw await toApiError(response);
  }

  const responseData =
    response.status === 204
      ? undefined
      : responseType === "blob"
        ? await response.blob()
        : await response.json();

  return {
    data: responseData as T,
    status: response.status,
    headers: response.headers,
  } as T;
}

function withTimeout(caller: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("request timed out", "TimeoutError"));
  }, timeoutMs);
  if (caller) {
    if (caller.aborted) controller.abort(caller.reason);
    else
      caller.addEventListener("abort", () => controller.abort(caller.reason), {
        once: true,
      });
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    clear: () => clearTimeout(timer),
  };
}

async function request<T>(
  url: string,
  options: ApiFetchOptions,
  hasRetried: boolean
): Promise<T> {
  if (isSessionExpired() && !shouldSkipRefresh(url, options)) {
    throw new SessionExpiredError();
  }

  const {
    headers,
    body,
    data,
    params,
    signal,
    responseType,
    skipAuthRefresh,
    timeoutMs,
    ...requestOptions
  } = options;
  const isJsonBody = isJsonData(data) || typeof body === "string";
  const builtUrl = buildUrl(url, params);

  const timeout = timeoutMs ? withTimeout(signal, timeoutMs) : null;
  const timedOutError = (error: unknown) => {
    if (!timeout?.timedOut()) return error;
    return new ApiError(
      408,
      {
        code: "REQUEST_TIMEOUT",
        message: webMessage("timeout"),
      },
      null
    );
  };

  let response: Response;
  try {
    response = await fetch(builtUrl, {
      ...requestOptions,
      credentials: "include",
      headers: {
        ...acceptLanguageHeader(),
        ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: buildBody(data, body),
      signal: timeout ? timeout.signal : signal,
    });
  } catch (error) {
    timeout?.clear();
    throw timedOutError(error);
  }

  if (
    response.status === 401 &&
    !hasRetried &&
    !shouldSkipRefresh(url, { ...options, skipAuthRefresh })
  ) {
    timeout?.clear();
    try {
      await refreshAuthOnce();
      return request<T>(url, options, true);
    } catch (error) {
      if (error instanceof AuthRefreshError && error.expired) {
        openSessionGate();
      }

      throw error;
    }
  }

  try {
    return await parseResponse<T>(response, responseType);
  } catch (error) {
    throw timedOutError(error);
  } finally {
    timeout?.clear();
  }
}

export async function apiFetch<T>(
  url: string,
  options?: ApiFetchOptions
): Promise<T> {
  return request<T>(url, options ?? {}, false);
}
