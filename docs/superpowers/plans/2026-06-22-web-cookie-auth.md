# Web Cookie Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `realillust-web` to backend-owned HttpOnly cookie authentication, keep SSR login state in the nav bar, and reduce the app to `/`, `/terms`, `/privacy`, plus the OAuth callback infrastructure route.

**Architecture:** The frontend never reads or stores access tokens. Browser requests use `credentials: "include"`, SSR bootstrap forwards incoming cookies to `GET /api/v1/users/me`, and API 401 responses share one refresh request before retrying the original request once. Route-specific pages and components outside the retained public MVP surface are removed.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, TanStack Query, shadcn-style local UI primitives, backend Spring Security OAuth cookie contract.

---

## File Structure

Create:

- `lib/auth/paths.ts`  
  Normalizes return paths and builds backend OAuth authorize URLs.

- `lib/auth/server.ts`  
  Server-only helper that forwards incoming request cookies to `/api/v1/users/me`.

- `lib/auth/events.ts`  
  Tiny browser event bridge so shared API utilities can notify the auth provider after logout or unrecoverable auth failure without importing React state.

Modify:

- `lib/auth/types.ts`  
  Match backend user shape: `id`, `email`, `name`, `image`.

- `lib/auth/api.ts`  
  Keep only cookie-based `getMe`, `refreshAuth`, and `logout` helpers. Remove readable access token assumptions.

- `components/auth/auth-provider.tsx`  
  Accept `initialUser`, remove `accessToken`, and expose user/status/logout/sync behavior.

- `components/auth/google-login-button.tsx`  
  Navigate to `/api/v1/auth/oauth2/authorize/google?returnTo=...`.

- `components/auth/auth-status.tsx`  
  Remove Google client id checks and render shadcn-style auth controls.

- `app/auth/callback/page.tsx`  
  Verify cookies by calling `GET /api/v1/users/me`, sync provider state, then return to normalized path.

- `app/providers.tsx`  
  Accept and pass `initialUser`.

- `app/layout.tsx`  
  Fetch the SSR user and pass it to providers.

- `lib/api/fetcher.ts`  
  Add `credentials: "include"` and shared refresh/retry.

- `components/realillust/app-shell.tsx`  
  Remove links to deleted pages and keep only public route navigation plus auth state.

- `app/page.tsx`  
  Remove links and imports that point to deleted routes. Keep a public landing page.

- `app/sitemap.ts`  
  Return only `/`, `/terms`, and `/privacy`.

- `app/robots.ts`  
  Keep sitemap and disallow `/auth/callback`.

- `.env.example`  
  Remove `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

Delete:

- `app/admin/page.tsx`
- `app/admin/review/page.tsx`
- `app/admin/webhooks/page.tsx`
- `app/ai-image-check/page.tsx`
- `app/auth/error/page.tsx`
- `app/contest-ai-check/page.tsx`
- `app/scans/[scanId]/page.tsx`
- `app/settings/api-keys/page.tsx`
- `components/realillust/scan-review-workspace.tsx`
- `lib/mock-data.ts`

Delete `components/realillust/upload-workspace.tsx` only after rewriting `app/page.tsx` so it is no longer imported.

---

### Task 1: Add Cookie Auth Types, Path Helpers, Events, And SSR Bootstrap

**Files:**

- Create: `lib/auth/paths.ts`
- Create: `lib/auth/server.ts`
- Create: `lib/auth/events.ts`
- Modify: `lib/auth/types.ts`
- Modify: `.env.example`

- [ ] **Step 1: Replace `lib/auth/types.ts` with backend-compatible auth types**

Use this exact file content:

```ts
export type AppResponse<T> = {
  success: boolean;
  data: T | null;
  error: AppError | null;
};

export type AppError = {
  code: string;
  message: string;
  details?: Array<{
    field?: string;
    message: string;
  }>;
};

export type AuthUser = {
  id: number;
  email: string | null;
  name: string | null;
  image: string | null;
};
```

- [ ] **Step 2: Create `lib/auth/paths.ts`**

Use this exact file content:

```ts
const allowedReturnPaths = new Set(["/", "/terms", "/privacy"]);

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const isAuthApiConfigured = Boolean(apiBaseUrl);

export function normalizeReturnTo(value: string | null | undefined): string {
  if (!value) {
    return "/";
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("//") ||
    value.startsWith("javascript:")
  ) {
    return "/";
  }

  let path = value;

  try {
    const parsed = new URL(value, "http://realillust.local");
    path = `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }

  const pathname = path.split("?")[0] || "/";

  return allowedReturnPaths.has(pathname) ? path : "/";
}

export function getCurrentReturnTo() {
  if (typeof window === "undefined") {
    return "/";
  }

  return normalizeReturnTo(
    `${window.location.pathname}${window.location.search}`
  );
}

export function buildApiUrl(path: string) {
  if (!apiBaseUrl) {
    return path;
  }

  return new URL(path, apiBaseUrl).toString();
}

export function buildGoogleOAuthUrl(returnTo: string) {
  const normalizedReturnTo = normalizeReturnTo(returnTo);
  const authorizePath = `/api/v1/auth/oauth2/authorize/google?returnTo=${encodeURIComponent(
    normalizedReturnTo
  )}`;

  return buildApiUrl(authorizePath);
}
```

- [ ] **Step 3: Create `lib/auth/events.ts`**

Use this exact file content:

```ts
export const AUTH_STATE_CHANGED_EVENT = "realillust:auth-state-changed";

export type AuthStateChangedDetail = {
  reason: "logout" | "unauthenticated";
};

export function notifyAuthStateChanged(detail: AuthStateChangedDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AuthStateChangedDetail>(AUTH_STATE_CHANGED_EVENT, {
      detail,
    })
  );
}
```

- [ ] **Step 4: Create `lib/auth/server.ts`**

Use this exact file content:

```ts
import "server-only";

import { cookies } from "next/headers";

import type { AppResponse, AuthUser } from "@/lib/auth/types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function buildServerApiUrl(path: string) {
  if (!apiBaseUrl) {
    return null;
  }

  return new URL(path, apiBaseUrl).toString();
}

function serializeCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export async function getCurrentUserForSsr(): Promise<AuthUser | null> {
  const url = buildServerApiUrl("/api/v1/users/me");

  if (!url) {
    return null;
  }

  const cookieHeader = serializeCookies(await cookies());

  if (!cookieHeader) {
    return null;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Cookie: cookieHeader,
      },
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as AppResponse<AuthUser>;

    if (!body.success || !body.data) {
      return null;
    }

    return body.data;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Update `.env.example`**

Replace the file with:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

- [ ] **Step 6: Check current status before wiring**

Run:

```bash
git status --short
```

Expected: `lib/auth/paths.ts`, `lib/auth/server.ts`, `lib/auth/events.ts`, `lib/auth/types.ts`, and `.env.example` are modified or untracked. Do not commit yet because Task 2 wires these files into the app and restores a passing lint state.

---

### Task 2: Rewrite Auth API, Provider, Login Button, Status, Callback, And SSR Wiring

**Files:**

- Modify: `lib/auth/api.ts`
- Modify: `components/auth/auth-provider.tsx`
- Modify: `components/auth/google-login-button.tsx`
- Modify: `components/auth/auth-status.tsx`
- Modify: `app/auth/callback/page.tsx`
- Modify: `app/providers.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace `lib/auth/api.ts`**

Use this exact file content:

```ts
import { notifyAuthStateChanged } from "@/lib/auth/events";
import { buildApiUrl, isAuthApiConfigured } from "@/lib/auth/paths";
import type { AppResponse, AuthUser } from "@/lib/auth/types";

class AuthApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseAppResponse<T>(
  response: Response,
  allowEmptyData = false
): Promise<T> {
  if (response.status === 204 && allowEmptyData) {
    return undefined as T;
  }

  const body = (await response.json()) as AppResponse<T>;

  if (!response.ok || !body.success || body.data === null) {
    if (response.ok && body.success && allowEmptyData) {
      return undefined as T;
    }

    throw new AuthApiError(
      body.error?.message ?? "Authentication request failed.",
      response.status,
      body.error?.code
    );
  }

  return body.data;
}

async function postAuth<T>(path: string, allowEmptyData = false) {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    credentials: "include",
  });

  return parseAppResponse<T>(response, allowEmptyData);
}

export async function getMe() {
  const response = await fetch(buildApiUrl("/api/v1/users/me"), {
    method: "GET",
    credentials: "include",
  });

  return parseAppResponse<AuthUser>(response);
}

export async function refreshAuth() {
  await postAuth<void>("/api/v1/auth/refresh", true);
}

export async function logout() {
  try {
    await postAuth<void>("/api/v1/auth/logout", true);
  } finally {
    notifyAuthStateChanged({ reason: "logout" });
  }
}

export { AuthApiError, isAuthApiConfigured };
```

- [ ] **Step 2: Replace `components/auth/auth-provider.tsx`**

Use this exact file content:

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AUTH_STATE_CHANGED_EVENT,
  type AuthStateChangedDetail,
} from "@/lib/auth/events";
import { getMe, logout as requestLogout } from "@/lib/auth/api";
import type { AuthUser } from "@/lib/auth/types";

type AuthStatus = "checking" | "authenticated" | "anonymous";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  setUser: (user: AuthUser | null) => void;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  const [user, setUserState] = useState<AuthUser | null>(initialUser);
  const [status, setStatus] = useState<AuthStatus>(
    initialUser ? "authenticated" : "anonymous"
  );

  const setUser = useCallback((nextUser: AuthUser | null) => {
    setUserState(nextUser);
    setStatus(nextUser ? "authenticated" : "anonymous");
  }, []);

  const refreshUser = useCallback(async () => {
    setStatus((current) =>
      current === "authenticated" ? current : "checking"
    );

    try {
      const nextUser = await getMe();
      setUser(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      return null;
    }
  }, [setUser]);

  const logout = useCallback(async () => {
    try {
      await requestLogout();
    } finally {
      setUser(null);
    }
  }, [setUser]);

  useEffect(() => {
    const handleAuthStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<AuthStateChangedDetail>).detail;

      if (detail?.reason === "logout" || detail?.reason === "unauthenticated") {
        setUser(null);
      }
    };

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);

    return () => {
      window.removeEventListener(
        AUTH_STATE_CHANGED_EVENT,
        handleAuthStateChanged
      );
    };
  }, [setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      setUser,
      refreshUser,
      logout,
    }),
    [user, status, setUser, refreshUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
```

- [ ] **Step 3: Replace `components/auth/google-login-button.tsx`**

Use this exact file content:

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildGoogleOAuthUrl,
  getCurrentReturnTo,
  isAuthApiConfigured,
} from "@/lib/auth/paths";
import { cn } from "@/lib/utils";

type GoogleLoginButtonProps = {
  compact?: boolean;
  className?: string;
};

export function GoogleLoginButton({
  compact = false,
  className,
}: GoogleLoginButtonProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleLogin = () => {
    if (!isAuthApiConfigured) {
      setErrorMessage("API URL이 설정되지 않았습니다.");
      return;
    }

    setPending(true);
    setErrorMessage(null);

    try {
      window.location.href = buildGoogleOAuthUrl(getCurrentReturnTo());
    } catch {
      setErrorMessage("로그인 페이지로 이동하는 중 오류가 발생했습니다.");
      setPending(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-end gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon-lg" : "lg"}
        onClick={handleLogin}
        disabled={pending || !isAuthApiConfigured}
        className={cn(
          "rounded-full border-black/10 bg-white text-black/72 shadow-sm hover:bg-[var(--cg-ceramic)] hover:text-[var(--cg-green)]",
          compact ? "p-0" : "px-4"
        )}
        aria-label="Google로 로그인"
      >
        <svg className="size-[18px]" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {!compact && <span>Google 로그인</span>}
      </Button>
      {errorMessage ? (
        <p className="max-w-52 text-right text-xs font-medium text-red-600">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Replace `components/auth/auth-status.tsx`**

Use this exact file content:

```tsx
"use client";

import { LogOut, UserRound } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { Button } from "@/components/ui/button";
import { isAuthApiConfigured } from "@/lib/auth/paths";

export function AuthStatus() {
  const { user, status, logout } = useAuth();

  if (status === "checking") {
    return (
      <div className="inline-flex h-10 items-center rounded-full border border-black/10 px-3 text-xs font-semibold text-black/50 sm:px-4 sm:text-sm">
        로그인 확인 중
      </div>
    );
  }

  if (status === "authenticated" && user) {
    const displayName = user.name ?? user.email ?? "사용자";

    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              className="size-7 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="grid size-7 place-items-center rounded-full bg-[var(--cg-ceramic)] text-[var(--cg-green)]">
              <UserRound className="size-4" />
            </span>
          )}
          <span className="hidden max-w-36 truncate text-sm font-semibold text-black/72 sm:block">
            {displayName}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="rounded-full border-black/10 bg-white px-3 text-black/68 hover:text-[var(--cg-green)]"
          onClick={() => void logout()}
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">로그아웃</span>
        </Button>
      </div>
    );
  }

  if (!isAuthApiConfigured) {
    return (
      <div className="inline-flex h-10 items-center rounded-full border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 sm:px-4">
        API URL 미설정
      </div>
    );
  }

  return (
    <div>
      <GoogleLoginButton compact className="sm:hidden" />
      <GoogleLoginButton className="hidden sm:flex" />
    </div>
  );
}
```

- [ ] **Step 5: Replace `app/auth/callback/page.tsx`**

Use this exact file content:

```tsx
"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { getMe } from "@/lib/auth/api";
import { normalizeReturnTo } from "@/lib/auth/paths";

function AuthCallbackContent() {
  const { setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    initialized.current = true;

    const returnTo = normalizeReturnTo(searchParams.get("returnTo"));

    const handleCallback = async () => {
      try {
        const user = await getMe();
        setUser(user);
        router.replace(returnTo);
      } catch {
        setUser(null);
        router.replace("/");
      }
    };

    void handleCallback();
  }, [router, searchParams, setUser]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--cg-cream)] p-4 text-[var(--cg-ink)]">
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-lg border border-black/10 bg-white p-8 text-center shadow-sm">
        <div className="size-10 animate-spin rounded-full border-2 border-black/10 border-t-[var(--cg-green)]" />
        <div>
          <h1 className="text-lg font-semibold">로그인 처리 중</h1>
          <p className="mt-2 text-sm text-black/58">
            인증 정보를 확인하고 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--cg-cream)] text-[var(--cg-ink)]">
          로그인 처리 중
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
```

- [ ] **Step 6: Update `app/providers.tsx`**

Replace the file with:

```tsx
"use client";

import {
  environmentManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { AuthProvider } from "@/components/auth/auth-provider";
import type { AuthUser } from "@/lib/auth/types";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (environmentManager.isServer()) {
    return makeQueryClient();
  }

  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
}) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider initialUser={initialUser}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 7: Update `app/layout.tsx`**

Add the import:

```ts
import { getCurrentUserForSsr } from "@/lib/auth/server";
```

Then change `RootLayout` to `async` and pass `initialUser`:

```tsx
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getCurrentUserForSsr();

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers initialUser={initialUser}>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Run lint**

Run:

```bash
pnpm lint
```

Expected: no auth-provider, auth-status, or callback errors remain. Errors from deleted-route imports may still remain until Tasks 3 and 4.

- [ ] **Step 9: Commit Task 2**

Run:

```bash
git add lib/auth/api.ts components/auth/auth-provider.tsx components/auth/google-login-button.tsx components/auth/auth-status.tsx app/auth/callback/page.tsx app/providers.tsx app/layout.tsx
git add lib/auth/types.ts lib/auth/paths.ts lib/auth/events.ts lib/auth/server.ts .env.example
git commit -m "feat: wire cookie auth into app shell"
```

---

### Task 3: Add Cookie-Aware API Fetcher With Shared Refresh Retry

**Files:**

- Modify: `lib/api/fetcher.ts`

- [ ] **Step 1: Replace `lib/api/fetcher.ts`**

Use this exact file content:

```ts
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

function buildBody(data: ApiFetchOptions["data"]) {
  if (!data || data instanceof FormData || data instanceof Blob) {
    return data;
  }

  return JSON.stringify(data);
}

function shouldSkipRefresh(url: string, options: ApiFetchOptions) {
  if (options.skipAuthRefresh) {
    return true;
  }

  return (
    url.includes("/api/v1/auth/refresh") ||
    url.includes("/api/v1/auth/logout") ||
    url.includes("/api/v1/auth/oauth2/")
  );
}

async function refreshAuthOnce() {
  if (!refreshPromise) {
    refreshPromise = fetch(buildUrl("/api/v1/auth/refresh"), {
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
  const {
    headers,
    data,
    params,
    signal,
    responseType,
    skipAuthRefresh,
    ...requestOptions
  } = options;
  const isJsonBody =
    data && !(data instanceof FormData) && !(data instanceof Blob);
  const builtUrl = buildUrl(url, params);

  const response = await fetch(builtUrl, {
    ...requestOptions,
    credentials: "include",
    headers: {
      ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: buildBody(data),
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
```

- [ ] **Step 2: Run lint**

Run:

```bash
pnpm lint
```

Expected: no syntax or type-aware lint errors in `lib/api/fetcher.ts`.

- [ ] **Step 3: Commit Task 3**

Run:

```bash
git add lib/api/fetcher.ts
git commit -m "feat: retry api requests after cookie refresh"
```

---

### Task 4: Remove Deleted Routes And Simplify Landing, Shell, Sitemap, Robots

**Files:**

- Modify: `components/realillust/app-shell.tsx`
- Modify: `app/page.tsx`
- Modify: `app/sitemap.ts`
- Modify: `app/robots.ts`
- Delete: route and component files listed in the File Structure section

- [ ] **Step 1: Replace `components/realillust/app-shell.tsx`**

Use this exact file content:

```tsx
import Link from "next/link";
import { FileText, Shield } from "lucide-react";

import { AuthStatus } from "@/components/auth/auth-status";
import { siteConfig } from "@/lib/site";

const navItems = [
  { href: "/terms", label: "이용약관", icon: FileText },
  { href: "/privacy", label: "개인정보", icon: Shield },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--cg-cream)] text-[var(--cg-ink)]">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[var(--cg-green)] text-white shadow-sm">
              <Shield className="size-5" />
            </span>
            <span>
              <span className="block text-[17px] font-semibold leading-tight">
                {siteConfig.name}
              </span>
              <span className="block text-xs font-medium text-black/55">
                AI 일러스트 검사
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-black/70 transition hover:bg-[var(--cg-ceramic)] hover:text-[var(--cg-green)]"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <AuthStatus />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-black/10 bg-[var(--cg-house)] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr] lg:px-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-white text-[var(--cg-green)]">
                <Shield className="size-5" />
              </span>
              <span>
                <span className="block text-lg font-semibold">
                  {siteConfig.name}
                </span>
                <span className="block text-xs font-medium text-white/62">
                  {siteConfig.domain}
                </span>
              </span>
            </Link>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/68">
              AI 생성 의심 이미지, 메타데이터, 국소 영역 신호를 함께 검토해 창작
              이미지 판단을 돕습니다.
            </p>
            <p className="mt-4 text-sm text-white/62">
              문의:{" "}
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="font-semibold text-white underline-offset-4 hover:underline"
              >
                {siteConfig.contactEmail}
              </a>
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--cg-gold)]">
                서비스
              </h2>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link
                    href="/"
                    className="text-sm font-medium text-white/68 transition hover:text-white"
                  >
                    홈
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--cg-gold)]">
                정책
              </h2>
              <ul className="mt-4 space-y-3">
                <li>
                  <Link
                    href="/terms"
                    className="text-sm font-medium text-white/68 transition hover:text-white"
                  >
                    이용약관
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-sm font-medium text-white/68 transition hover:text-white"
                  >
                    개인정보 처리방침
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-white/52 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <span>© 2026 {siteConfig.name}. All rights reserved.</span>
            <span>
              AI 검사 결과는 보조 판단 자료이며 최종 판단은 운영 기준에 따라
              이루어집니다.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx`**

Use this exact file content:

```tsx
import type { Metadata } from "next";
import { FileSearch, ShieldCheck, Sparkles } from "lucide-react";

import { AppShell } from "@/components/realillust/app-shell";
import { PageSection, Panel } from "@/components/realillust/primitives";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  url: siteConfig.url,
  description: siteConfig.description,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "KRW",
  },
};

const features = [
  {
    title: "AI 생성 의심 신호",
    body: "이미지 전체 점수만이 아니라 의심 영역, 파일 신호, 메타데이터를 함께 검토하는 방향으로 설계됩니다.",
    icon: Sparkles,
  },
  {
    title: "창작 이미지 검토",
    body: "일러스트와 웹툰풍 이미지처럼 단순 탐지가 어려운 창작물 검토 흐름에 맞춘 서비스를 준비하고 있습니다.",
    icon: FileSearch,
  },
  {
    title: "운영 기준 보조",
    body: "검사 결과는 확정 판정이 아니라 운영자와 창작자의 판단을 돕는 참고 자료로 제공됩니다.",
    icon: ShieldCheck,
  },
];

export default function Home() {
  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageSection className="py-16 sm:py-20">
        <div className="max-w-3xl">
          <Badge variant="outline" className="border-black/10 bg-white">
            AI 일러스트 검사
          </Badge>
          <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
            진짜그림
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-black/62 sm:text-lg">
            AI 생성 의심 일러스트, 메타데이터, 국소 영역 신호를 함께 분석해 창작
            이미지 검토를 돕는 서비스입니다.
          </p>
        </div>
      </PageSection>

      <PageSection className="pb-16 pt-0">
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <Panel key={feature.title} className="p-6">
              <feature.icon className="size-7 text-[var(--cg-green)]" />
              <h2 className="mt-5 text-xl font-semibold">{feature.title}</h2>
              <p className="mt-3 text-sm leading-6 text-black/58">
                {feature.body}
              </p>
            </Panel>
          ))}
        </div>
      </PageSection>
    </AppShell>
  );
}
```

- [ ] **Step 3: Replace `app/sitemap.ts`**

Use this exact file content:

```ts
import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: siteConfig.url,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteConfig.url}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
```

- [ ] **Step 4: Replace `app/robots.ts`**

Use this exact file content:

```ts
import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/auth/callback"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
```

- [ ] **Step 5: Delete removed routes and unused route components**

Run:

```bash
git rm app/admin/page.tsx \
  app/admin/review/page.tsx \
  app/admin/webhooks/page.tsx \
  app/ai-image-check/page.tsx \
  app/auth/error/page.tsx \
  app/contest-ai-check/page.tsx \
  'app/scans/[scanId]/page.tsx' \
  app/settings/api-keys/page.tsx \
  components/realillust/scan-review-workspace.tsx \
  components/realillust/upload-workspace.tsx \
  lib/mock-data.ts
```

Expected: files are removed from the index. Empty directories may remain on disk but are not tracked by git.

- [ ] **Step 6: Search for references to deleted routes and files**

Run:

```bash
rg -n "admin|settings|ai-image-check|contest-ai-check|scans/|scan-review-workspace|upload-workspace|mock-data|auth/error" app components lib
```

Expected: no output except policy copy in `app/terms/page.tsx`, `app/privacy/page.tsx`, or SEO keywords in `lib/site.ts` if intentionally retained. If imports or links to deleted files appear, remove them before continuing.

- [ ] **Step 7: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

Run:

```bash
git add app components lib .env.example
git commit -m "feat: reduce web routes to public auth shell"
```

---

### Task 5: Final Verification And Build

**Files:**

- Verify: all changed files

- [ ] **Step 1: Confirm no Bearer auth or readable token state remains**

Run:

```bash
rg -n "accessToken|Authorization|Bearer|NEXT_PUBLIC_GOOGLE_CLIENT_ID|profileImageUrl|AuthTokenResponse|refreshToken" app components lib .env.example
```

Expected: no output. If `refreshToken` appears only in generated OpenAPI petstore files, ignore those generated files unless they are imported by retained routes. No auth app code should reference readable access tokens.

- [ ] **Step 2: Confirm deleted routes are not tracked**

Run:

```bash
git ls-files 'app/admin/*' 'app/settings/*' 'app/ai-image-check/*' 'app/contest-ai-check/*' 'app/scans/*' 'app/auth/error/*'
```

Expected: no output.

- [ ] **Step 3: Confirm sitemap only contains retained content routes**

Run:

```bash
rg -n "ai-image-check|contest-ai-check|admin|settings|scans|auth/callback" app/sitemap.ts app/robots.ts
```

Expected: only `app/robots.ts` may contain `auth/callback` as a disallow rule.

- [ ] **Step 4: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS. If build fails because the backend is unavailable during SSR, verify `getCurrentUserForSsr()` catches fetch failures and returns `null`, then rerun.

- [ ] **Step 6: Start the dev server**

Run:

```bash
pnpm dev
```

Expected: Next.js starts on `http://localhost:3000`. Keep the session running for manual browser checks.

- [ ] **Step 7: Manually verify local login URL**

Open `http://localhost:3000`, click the Google login button, and confirm the browser navigates to:

```text
http://localhost:8080/api/v1/auth/oauth2/authorize/google?returnTo=%2F
```

Then stop before completing Google OAuth if backend credentials are not configured.

- [ ] **Step 8: Manually verify policy return paths**

Open `http://localhost:3000/terms`, click Google login, and confirm the URL includes:

```text
returnTo=%2Fterms
```

Open `http://localhost:3000/privacy`, click Google login, and confirm the URL includes:

```text
returnTo=%2Fprivacy
```

- [ ] **Step 9: Commit verification fixes if any were needed**

If Tasks 5.1 through 5.8 required code changes, run:

```bash
git add app components lib .env.example
git commit -m "fix: complete web auth verification"
```

If no code changes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Cookie-only auth and no Bearer token handling: Tasks 1, 2, 3, 5.
- Local/prod backend origins through `NEXT_PUBLIC_API_BASE_URL`: Tasks 1 and 2.
- Login path `/api/v1/auth/oauth2/authorize/google?returnTo=`: Task 2.
- SSR login state in nav: Tasks 1 and 2.
- Access token expiration refresh/retry: Task 3.
- Route reduction to `/`, `/terms`, `/privacy`, plus `/auth/callback`: Task 4.
- shadcn-style UI usage: Tasks 2 and 4 use existing `Button` and `Badge`.
- sitemap/robots cleanup: Task 4.
- Final verification: Task 5.

Placeholder scan:

- No open-ended implementation placeholders are intentionally left.
- Every code-changing step includes concrete code or an exact command.

Type consistency:

- `AuthUser.image` is used consistently by `AuthStatus`.
- `refreshAuth()` exists in `lib/auth/api.ts`; shared fetcher performs its own refresh request to avoid coupling generated API code to React state.
- `initialUser` is passed from `app/layout.tsx` to `Providers` to `AuthProvider`.
