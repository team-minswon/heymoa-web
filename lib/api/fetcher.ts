import { isRefreshTokenDead } from "@/lib/auth/refresh-failure";
import {
  isSessionExpired,
  openSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";

type ApiFetchOptions = RequestInit & {
  headers?: HeadersInit;
  data?: BodyInit | Record<string, unknown>;
  params?: Record<string, unknown>;
  responseType?: string;
  skipAuthRefresh?: boolean;
};

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

/** 갱신 실패 사유. `expired`면 재로그인이 필요하고, 아니면 일시 오류다. */
export class AuthRefreshError extends Error {
  /** 판정은 `lib/auth/refresh-failure.ts`가 한다 — proxy와 규칙이 하나여야 한다. */
  readonly expired: boolean;
  constructor(expired: boolean) {
    super("Authentication refresh failed.");
    this.name = "AuthRefreshError";
    this.expired = expired;
  }
}

/**
 * 재시도해도 소용없는 인증 오류인가. 전역 재시도 정책(`lib/query/query-client.ts`)이 쓴다.
 *
 * 네트워크 때문에 갱신이 실패한 경우(`expired === false`)는 여기 안 걸린다. 지하철에서
 * 잠깐 끊긴 사용자를 작업 중인 화면에서 내보내면 안 되기 때문이다.
 */
export function isAuthError(error: unknown) {
  if (error instanceof SessionExpiredError) {
    return true;
  }

  return error instanceof AuthRefreshError && error.expired;
}

/**
 * prerender된 문서라면 **활성화될 때까지 기다린다.**
 *
 * proxy의 matcher는 서버 쪽 갱신만 막는다. prerender된 문서는 JS를 실행하므로
 * `AuthProvider`가 hydration 중에 `getMe()` → 여기로 들어온다. 그 prerender가 폐기되면
 * 서버는 토큰을 회전시켰는데 새 쿠키는 아무도 못 받는다 — matcher로 막으려던 바로 그
 * 상황이 클라이언트 경로로 다시 생긴다 (APP-347).
 *
 * `document.prerendering`은 아직 lib.dom에 없어서 좁혀서 읽는다. 없는 브라우저에서는
 * 항상 활성 문서로 본다.
 */
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
        fetch(buildUrl("/v1/auth/refresh"), {
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
        // 네트워크 오류(fetch reject)는 만료가 아니라 일시 실패다.
        if (error instanceof AuthRefreshError) throw error;
        throw new AuthRefreshError(false);
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function parseResponse<T>(response: Response, responseType?: string) {
  const responseData =
    response.status === 204
      ? undefined
      : responseType === "blob"
        ? await response.blob()
        : await response.json();

  if (!response.ok) {
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
  // 세션이 끝났으면 네트워크를 타지 않는다. 폴링 호출부가 5곳이라 여기서 막지 않으면
  // 각자 401을 만나 갱신을 다시 시도하고, 그것이 무한 루프의 실체다.
  // 인증 엔드포인트 자신은 통과시킨다 — 로그아웃이 쿠키를 지워야 하기 때문이다.
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
    } catch (error) {
      // 만료일 때만 게이트를 연다. 네트워크 오류는 일시 실패라 재시도 대상으로 남긴다.
      if (error instanceof AuthRefreshError && error.expired) {
        openSessionGate();
      }

      // 타입을 뭉개지 않는다. 전역 재시도 정책이 `isAuthError`로 판별해야 한다.
      throw error;
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
