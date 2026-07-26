# APP-205 인증 세션 게이트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인증이 만료된 뒤에도 갱신 요청을 무한히 보내는 루프를 끊고, 만료를 한 번만 사용자에게 알린 뒤 홈으로 내보낸다.

**Architecture:** 모듈 하나가 `live`/`expired` 두 상태를 들고 있고(`session-gate`), 여는 동작이 멱등이라 뒤따르는 처리(로그아웃·토스트·이동)가 한 번만 일어난다. **차단은 폴링 호출부가 아니라 `fetcher` 한 곳에서 한다** — 게이트가 열린 뒤의 요청은 네트워크를 타지 않고 즉시 거절된다. 그래야 폴링 5곳을 개별로 고치지 않고, 나중에 생길 6번째 호출부도 자동으로 덮인다.

**Tech Stack:** Next.js 16 App Router, TanStack Query v5, vitest + Testing Library, sonner

## Global Constraints

- 커밋 제목은 `[APP-205] 제목` 형식. `feat:`·`feat(app-205):` 같은 conventional prefix를 쓰지 않는다
- 코드 주석은 한국어 존댓말이 아니라 **평서체**로 쓴다 (이 레포의 기존 주석 문체)
- API 호출은 `lib/api/generated/`의 Orval 훅으로 한다. 직접 `fetch()`는 `lib/api/`·`lib/auth/`·`proxy.ts`·`components/mocks/`에서만 허용된다
- `lib/api/generated/**`와 `openapi3.yml`은 편집하지 않는다 (hook이 막는다)
- 테스트는 vitest + `@testing-library/react`. 파일명은 대상 파일명 + `.test.ts(x)`
- 검증 명령: `pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e`
- 브랜치는 `dev`에서 따고, 머지는 PR 없이 로컬 squash (skill `merging`)

## 범위에서 뺀 것 — 서버 변경

이슈 APP-205의 "`InvalidRefreshTokenException`에 전용 `AppErrorType` 매핑 추가"는 **하지 않는다.**

`AuthControllerE2eTest`의 `리프레시 쿠키가 없으면 잘못된 요청으로 응답한다`가 이미 `statusCode(400)`과 `body("error.code", equalTo("BAD_REQUEST"))`를 **둘 다 고정**하고 있다. 이슈가 걱정한 "누가 매핑을 바꾸면 웹 판정이 조용히 깨진다"는 이 테스트가 이미 막는다.

반대로 전용 매핑을 추가하면 `error.code`가 `BAD_REQUEST`에서 바뀌므로 **계약 변경**이 된다 — DocsTest 수정, `./gradlew openapi3` 재생성, docs repo 미러, `heymoa-web/openapi3.yml` 재복사, `pnpm orval`까지 따라온다. 보호는 이미 있으므로 얻는 것 없이 레포 넷을 건드리는 일이다.

**따라서 APP-205는 web 전용 이슈가 된다.** 이슈의 `heymoa-server` 라벨과 해당 체크박스를 지워야 한다 (Task 7).

## File Structure

| 파일 | 책임 |
|---|---|
| `lib/auth/session-gate.ts` (신설) | 만료 상태 하나와 멱등한 열기. React를 모른다 |
| `lib/auth/session-gate.test.ts` (신설) | 멱등성과 초기화 |
| `lib/api/fetcher.ts` (수정) | 게이트 확인(차단) · 에러 타입 보존 · `isAuthError` |
| `lib/api/sse.ts` (수정) | 같은 게이트를 따른다 |
| `lib/auth/api.ts` (수정) | 같은 게이트를 따른다 |
| `lib/query/query-client.ts` (수정) | 전역 재시도 정책 · mutation 토스트 억제 |
| `components/auth/auth-provider.tsx` (수정) | 만료 시 로그아웃·토스트·이동 (React 쪽 효과) |
| `components/ui/sonner.tsx` (수정) | 위치 · 닫기 버튼 |

상태는 `session-gate`가 갖고, **React가 필요한 효과는 `auth-provider`가 갖는다.** 둘을 잇는 것은 이미 있는 `notifyAuthStateChanged` 이벤트라 새 배선을 만들지 않는다.

---

### Task 1: 세션 게이트 모듈

**Files:**
- Create: `lib/auth/session-gate.ts`
- Test: `lib/auth/session-gate.test.ts`

**Interfaces:**
- Consumes: `notifyAuthStateChanged` from `lib/auth/events`
- Produces: `SessionExpiredError`, `isSessionExpired(): boolean`, `openSessionGate(): void`, `resetSessionGate(): void`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/auth/session-gate.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_STATE_CHANGED_EVENT } from "@/lib/auth/events";
import {
  isSessionExpired,
  openSessionGate,
  resetSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";

describe("session gate", () => {
  beforeEach(() => {
    resetSessionGate();
  });

  it("시작할 때는 닫혀 있다", () => {
    expect(isSessionExpired()).toBe(false);
  });

  it("열면 만료 상태가 되고 이벤트를 한 번 낸다", () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, listener);

    openSessionGate();

    expect(isSessionExpired()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_STATE_CHANGED_EVENT, listener);
  });

  it("여러 번 열어도 이벤트는 한 번만 난다", () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_STATE_CHANGED_EVENT, listener);

    openSessionGate();
    openSessionGate();
    openSessionGate();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_STATE_CHANGED_EVENT, listener);
  });

  it("SessionExpiredError는 이름으로 구분된다", () => {
    expect(new SessionExpiredError().name).toBe("SessionExpiredError");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/auth/session-gate.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/auth/session-gate"`

- [ ] **Step 3: 최소 구현을 쓴다**

`lib/auth/session-gate.ts`:

```ts
import { notifyAuthStateChanged } from "@/lib/auth/events";

/**
 * 인증이 끝났다는 사실을 기억하는 단 한 곳.
 *
 * 이것이 없으면 401을 만난 호출부가 각자 갱신을 시도한다. 쿼리 호출부가 31곳이고 그중
 * 5곳이 폴링이라, 갱신이 실패해도 아무도 멈추지 않아 요청이 무한히 나간다.
 *
 * 닫는 방법은 두지 않는다. 만료는 새 문서(새로고침·재로그인 뒤 이동)로만 풀린다.
 */
let expired = false;

/** 게이트가 열린 뒤에 발생한 요청. 네트워크를 타지 않고 즉시 거절된다. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired.");
    this.name = "SessionExpiredError";
  }
}

export function isSessionExpired() {
  return expired;
}

/**
 * 만료를 한 번만 알린다.
 *
 * 멱등성이 이 함수의 핵심이다. 401을 만난 호출부가 몇이든 뒤따르는 처리(로그아웃·토스트·
 * 이동)는 한 번만 일어나야 한다. 없으면 토스트가 호출부 수만큼 뜬다.
 */
export function openSessionGate() {
  if (expired) {
    return;
  }

  expired = true;
  notifyAuthStateChanged({ reason: "unauthenticated" });
}

/** 테스트 전용. 모듈 수준 상태를 초기화한다. */
export function resetSessionGate() {
  expired = false;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm vitest run lib/auth/session-gate.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: 커밋한다**

```bash
git add lib/auth/session-gate.ts lib/auth/session-gate.test.ts
git commit -m "[APP-205] 세션 만료를 기억하는 게이트 추가"
```

---

### Task 2: fetcher가 게이트를 보고 에러 타입을 보존한다

**Files:**
- Modify: `lib/api/fetcher.ts`
- Test: `lib/api/fetcher.test.ts` (신설)

**Interfaces:**
- Consumes: `SessionExpiredError`, `isSessionExpired`, `openSessionGate` (Task 1)
- Produces: `isAuthError(error: unknown): boolean` — Task 3의 재시도 정책이 쓴다

이 태스크가 루프를 실제로 끊는다. 두 가지를 한다.

1. 게이트가 열려 있으면 **네트워크를 타지 않고** 거절한다 — 폴링 5곳을 개별로 고치지 않아도 된다
2. 갱신 실패 시 `AuthRefreshError`를 버리지 않고 올린다 — Task 3이 인증 오류를 판별할 수 있게 된다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/api/fetcher.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch, AuthRefreshError, isAuthError } from "@/lib/api/fetcher";
import { resetSessionGate, SessionExpiredError } from "@/lib/auth/session-gate";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch", () => {
  beforeEach(() => {
    resetSessionGate();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("갱신이 만료로 실패하면 게이트를 열고 AuthRefreshError를 올린다", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockResolvedValueOnce(jsonResponse(400, { success: false }));

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(AuthRefreshError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("게이트가 열린 뒤에는 네트워크를 타지 않는다", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockResolvedValueOnce(jsonResponse(400, { success: false }));

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(AuthRefreshError);
    fetchMock.mockClear();

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(
      SessionExpiredError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("네트워크 오류로 갱신이 실패하면 게이트를 열지 않는다", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { success: false }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(AuthRefreshError);

    // 게이트가 안 열렸으므로 다음 요청은 다시 네트워크를 탄다.
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, data: [] }));
    await apiFetch("/v1/notes");
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe("isAuthError", () => {
  it("만료된 갱신 실패와 세션 만료를 참으로 본다", () => {
    expect(isAuthError(new AuthRefreshError(400))).toBe(true);
    expect(isAuthError(new SessionExpiredError())).toBe(true);
  });

  it("네트워크 갱신 실패와 일반 오류는 거짓으로 본다", () => {
    expect(isAuthError(new AuthRefreshError(null))).toBe(false);
    expect(isAuthError(new Error("boom"))).toBe(false);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/api/fetcher.test.ts`
Expected: FAIL — `isAuthError` is not exported

- [ ] **Step 3: `lib/api/fetcher.ts`를 고친다**

파일 맨 위 import에 한 줄을 더한다:

```ts
import { notifyAuthStateChanged } from "@/lib/auth/events";
import {
  isSessionExpired,
  openSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";
```

`AuthRefreshError` 클래스 **바로 아래**에 판별 함수를 더한다:

```ts
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
```

`request()` 함수의 본문 첫 줄에 차단을 넣는다 — `const { headers, ... } = options;` **위**다:

```ts
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
```

401 처리 블록의 `catch`를 바꾼다. 기존:

```ts
    } catch {
      notifyAuthStateChanged({ reason: "unauthenticated" });
      throw new Error("Authentication refresh failed.");
    }
```

새로:

```ts
    } catch (error) {
      // 만료일 때만 게이트를 연다. 네트워크 오류는 일시 실패라 재시도 대상으로 남긴다.
      if (error instanceof AuthRefreshError && error.expired) {
        openSessionGate();
      }

      // 타입을 뭉개지 않는다. 전역 재시도 정책이 `isAuthError`로 판별해야 한다.
      throw error;
    }
```

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm vitest run lib/api/fetcher.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: `notifyAuthStateChanged` import가 남아 있으면 지운다**

Run: `pnpm lint`
Expected: 통과. `notifyAuthStateChanged`가 더는 `fetcher.ts`에서 안 쓰이면 import 줄을 지운다.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/api/fetcher.ts lib/api/fetcher.test.ts
git commit -m "[APP-205] fetcher가 게이트를 보고 인증 오류 타입을 보존한다"
```

---

### Task 3: 전역 재시도 정책과 mutation 토스트 억제

**Files:**
- Modify: `lib/query/query-client.ts`
- Test: `lib/query/query-client.test.tsx` (신설 — mutation 테스트가 JSX를 쓰므로 `.tsx`다)

**Interfaces:**
- Consumes: `isAuthError` (Task 2), `isSessionExpired` (Task 1)
- Produces: 없음 (설정 변경)

쿼리 호출부 31곳 중 `retry`를 지정한 곳이 2곳뿐이라, 나머지 29곳이 v5 기본값 3회를 그대로 쓰고 있다. 401도 3번 더 때린다. 한 곳에서 끝낸다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/query/query-client.test.tsx`:

```tsx
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthRefreshError } from "@/lib/api/fetcher";
import { makeQueryClient } from "@/lib/query/query-client";
import {
  openSessionGate,
  resetSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function retryOf(client: ReturnType<typeof makeQueryClient>) {
  const retry = client.getDefaultOptions().queries?.retry;
  if (typeof retry !== "function") {
    throw new Error("retry는 함수여야 한다");
  }
  return retry;
}

describe("makeQueryClient 재시도 정책", () => {
  beforeEach(() => {
    resetSessionGate();
    toast.error.mockReset();
  });

  it("인증 오류는 재시도하지 않는다", () => {
    const retry = retryOf(makeQueryClient());

    expect(retry(0, new SessionExpiredError())).toBe(false);
    expect(retry(0, new AuthRefreshError(400))).toBe(false);
  });

  it("그 밖의 오류는 두 번까지 재시도한다", () => {
    const retry = retryOf(makeQueryClient());

    expect(retry(0, new Error("boom"))).toBe(true);
    expect(retry(1, new Error("boom"))).toBe(true);
    expect(retry(2, new Error("boom"))).toBe(false);
  });

  it("네트워크 갱신 실패는 재시도 대상으로 남는다", () => {
    const retry = retryOf(makeQueryClient());

    expect(retry(0, new AuthRefreshError(null))).toBe(true);
  });
});

describe("makeQueryClient mutation 토스트", () => {
  beforeEach(() => {
    resetSessionGate();
    toast.error.mockReset();
  });

  function renderFailingMutation() {
    const client = makeQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    return renderHook(
      () =>
        useMutation({
          mutationFn: async () => {
            throw new Error("실패");
          },
        }),
      { wrapper }
    );
  }

  it("게이트가 열려 있으면 토스트를 띄우지 않는다", async () => {
    openSessionGate();
    const { result } = renderFailingMutation();

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("평소 실패는 토스트를 띄운다", async () => {
    const { result } = renderFailingMutation();

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/query/query-client.test.tsx`
Expected: FAIL — `retry는 함수여야 한다`

- [ ] **Step 3: `lib/query/query-client.ts`를 고친다**

import에 두 줄을 더한다:

```ts
import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessageOf } from "@/lib/api/error-message";
import { isAuthError } from "@/lib/api/fetcher";
import { isSessionExpired } from "@/lib/auth/session-gate";
```

`defaultOptions.queries`에 `retry`를 더한다:

```ts
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        // 호출부 31곳 중 retry를 지정한 곳이 2곳뿐이라 나머지는 v5 기본값 3회를 쓴다.
        // 인증 오류는 몇 번을 더 보내도 결과가 같으므로 여기서 끊는다.
        retry: (failureCount, error) =>
          isAuthError(error) ? false : failureCount < 2,
      },
```

`MutationCache.onError`를 고친다:

```ts
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.suppressErrorToast) return;
        // 세션이 끝난 뒤의 실패는 만료 토스트 하나로 충분하다. 여기서 또 띄우면
        // "세션이 만료되었습니다"와 "요청을 처리하지 못했습니다"가 겹친다.
        if (isSessionExpired() || isAuthError(error)) return;
        toast.error(errorMessageOf(error, "요청을 처리하지 못했습니다."));
      },
```

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm vitest run lib/query/query-client.test.tsx`
Expected: PASS — 5 tests

- [ ] **Step 5: 기존 테스트가 안 깨졌는지 본다**

Run: `pnpm test:run`
Expected: 전부 PASS. 재시도 기본값이 3→2로 바뀌었으니 재시도 횟수를 세는 테스트가 있으면 여기서 드러난다. 드러나면 그 테스트의 기대값을 새 정책에 맞춘다.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/query/query-client.ts lib/query/query-client.test.tsx
git commit -m "[APP-205] 전역 재시도 정책과 mutation 토스트 겹침 제거"
```

---

### Task 4: 만료되면 로그아웃하고 홈으로 보낸다

**Files:**
- Modify: `components/auth/auth-provider.tsx:110-131`
- Test: `components/auth/auth-provider.test.tsx` (기존 파일에 추가)

**Interfaces:**
- Consumes: `AUTH_STATE_CHANGED_EVENT` (이미 구독 중), `logout as requestLogout` from `lib/auth/api` (이미 import 중)
- Produces: 없음

게이트가 여는 이벤트를 이미 이 컴포넌트가 듣고 있다. 지금은 캐시만 비우고 **아무 데도 안 간다.** 그래서 사용자가 만료된 화면에 그대로 남는다.

**재진입을 알고 있어야 한다.** `lib/auth/api.ts`의 `logout()`은 끝에서 `notifyAuthStateChanged({ reason: "logout" })`을 쏜다. 즉 아래에서 `requestLogout()`을 부르면 같은 핸들러가 `logout` 갈래로 한 번 더 들어온다. `clearAuthenticatedState()`가 다시 불리지만 멱등이라 해롭지 않고, 게이트는 이미 열려 있어 갱신 루프로 이어지지 않는다. **`logout` 갈래에서 이동이나 토스트를 하지 않는 이유가 이것이다** — 하면 두 번씩 일어난다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`components/auth/auth-provider.test.tsx`의 `describe("AuthProvider", ...)` 안에 더한다:

```ts
  it("만료 이벤트를 받으면 로그아웃하고 홈으로 보낸다", async () => {
    authApi.logout.mockResolvedValue(undefined);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </QueryClientProvider>
    );

    renderHook(() => useAuth(), { wrapper });

    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_STATE_CHANGED_EVENT, {
          detail: { reason: "unauthenticated" },
        })
      );
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/");
    });
    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("로그아웃 호출이 실패해도 홈으로 보낸다", async () => {
    authApi.logout.mockRejectedValue(new Error("네트워크"));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </QueryClientProvider>
    );

    renderHook(() => useAuth(), { wrapper });

    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_STATE_CHANGED_EVENT, {
          detail: { reason: "unauthenticated" },
        })
      );
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/");
    });
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run components/auth/auth-provider.test.tsx`
Expected: FAIL — `router.replace`가 호출되지 않음

- [ ] **Step 3: 핸들러를 고친다**

`components/auth/auth-provider.tsx`의 `useEffect` 안 `handleAuthStateChanged`를 바꾼다. 기존:

```ts
    const handleAuthStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<AuthStateChangedDetail>).detail;

      if (detail?.reason === "logout" || detail?.reason === "unauthenticated") {
        if (detail.reason === "unauthenticated") {
          releaseAuthenticatedResources();
        }

        clearAuthenticatedState();
      }
    };
```

새로:

```ts
    const handleAuthStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<AuthStateChangedDetail>).detail;

      if (detail?.reason === "logout") {
        clearAuthenticatedState();
        return;
      }

      if (detail?.reason !== "unauthenticated") {
        return;
      }

      releaseAuthenticatedResources();
      clearAuthenticatedState();

      // access·refresh 쿠키는 HttpOnly라 JS가 못 지운다. 서버가 만료 Set-Cookie를
      // 내려주는 것이 유일한 방법이고, LogoutService는 토큰도 세션도 없을 때 조용히
      // 반환하므로 이 호출은 안전하다. 실패해도 이동은 그대로 진행한다 — 남은 쿠키는
      // 다음 SSR에서 proxy.ts의 clearAuthCookies()가 정리한다.
      void requestLogout().catch(() => undefined);

      toast.error("세션이 만료되었습니다. 다시 로그인해 주세요.");

      // 로그인 전용 페이지가 없으므로 홈으로 보낸다. 이동하면 /w/** 트리가 언마운트되어
      // 폴링 쿼리도 함께 사라진다.
      router.replace("/");
    };
```

`useEffect`의 의존성 배열을 고친다:

```ts
  }, [clearAuthenticatedState, releaseAuthenticatedResources, router]);
```

- [ ] **Step 4: 통과를 확인한다**

Run: `pnpm vitest run components/auth/auth-provider.test.tsx`
Expected: PASS — 기존 테스트 포함 전부

- [ ] **Step 5: 커밋한다**

```bash
git add components/auth/auth-provider.tsx components/auth/auth-provider.test.tsx
git commit -m "[APP-205] 세션이 만료되면 쿠키를 지우고 홈으로 보낸다"
```

---

### Task 5: SSE와 auth API도 같은 게이트를 따른다

**Files:**
- Modify: `lib/api/sse.ts:26-33`
- Modify: `lib/auth/api.ts:59-66`
- Test: `lib/api/sse.test.ts` (기존 파일에 추가)

**Interfaces:**
- Consumes: `isSessionExpired`, `openSessionGate`, `SessionExpiredError` (Task 1)
- Produces: 없음

이 둘은 `apiFetch`를 거치지 않고 직접 `fetch()`한다(정당한 예외다). Task 2의 차단이 안 걸리므로 같은 처리를 따로 넣어야 한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`lib/api/sse.test.ts` 맨 아래에 더한다:

```ts
describe("postEventStream 세션 게이트", () => {
  beforeEach(() => {
    resetSessionGate();
  });

  it("게이트가 열려 있으면 네트워크를 타지 않는다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    openSessionGate();

    const iterator = postEventStream("/v1/chat", {});
    await expect(iterator.next()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
```

파일 상단 import에 더한다:

```ts
import {
  openSessionGate,
  resetSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";
```

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run lib/api/sse.test.ts`
Expected: FAIL — fetch가 호출됨

- [ ] **Step 3: `lib/api/sse.ts`를 고친다**

import를 바꾼다:

```ts
import { buildUrl, refreshAuthOnce } from "@/lib/api/fetcher";
import {
  isSessionExpired,
  openSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";
```

`connect()` 본문 첫 줄에 차단을 넣는다:

```ts
async function connect(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal | undefined,
  hasRetried: boolean
): Promise<Response> {
  // 세션이 끝났으면 스트림을 열지 않는다. apiFetch를 안 거치는 경로라 따로 막아야 한다.
  if (isSessionExpired()) {
    throw new SessionExpiredError();
  }

  const response = await fetch(buildUrl(url), {
```

401 처리의 `catch`를 바꾼다. 기존:

```ts
    try {
      await refreshAuthOnce();
    } catch {
      notifyAuthStateChanged({ reason: "unauthenticated" });
      throw new Error("Authentication refresh failed.");
    }
```

새로:

```ts
    try {
      await refreshAuthOnce();
    } catch (error) {
      if (error instanceof AuthRefreshError && error.expired) {
        openSessionGate();
      }
      throw error;
    }
```

`AuthRefreshError`를 import에 더한다:

```ts
import { AuthRefreshError, buildUrl, refreshAuthOnce } from "@/lib/api/fetcher";
```

`notifyAuthStateChanged` import가 더는 안 쓰이면 지운다.

- [ ] **Step 4: `lib/auth/api.ts`의 `fetchMe`를 고친다**

import에 더한다:

```ts
import {
  isSessionExpired,
  openSessionGate,
  SessionExpiredError,
} from "@/lib/auth/session-gate";
import { AuthRefreshError, refreshAuthOnce } from "@/lib/api/fetcher";
```

`fetchMe`의 첫 줄과 401 처리를 바꾼다:

```ts
async function fetchMe(hasRetried = false): Promise<AuthUser> {
  if (isSessionExpired()) {
    throw new SessionExpiredError();
  }

  const url = buildApiUrl("/v1/users/me");
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (response.status === 401 && !hasRetried) {
    try {
      await refreshAuthOnce();
      return fetchMe(true);
    } catch (error) {
      if (error instanceof AuthRefreshError && error.expired) {
        openSessionGate();
      }
      throw error;
    }
  }

  return parseAppResponse<AuthUser>(response);
}
```

`notifyAuthStateChanged` import가 `logout` 쪽에서만 쓰이면 그대로 둔다.

- [ ] **Step 5: 통과를 확인한다**

Run: `pnpm vitest run lib/api/sse.test.ts components/auth/auth-provider.test.tsx`
Expected: PASS

- [ ] **Step 6: 커밋한다**

```bash
git add lib/api/sse.ts lib/api/sse.test.ts lib/auth/api.ts
git commit -m "[APP-205] SSE와 사용자 조회도 세션 게이트를 따른다"
```

---

### Task 6: sonner 위치와 닫기 버튼

**Files:**
- Modify: `components/ui/sonner.tsx:13-20`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

인증과 무관한 전역 UI 변경이지만, 만료 토스트가 안 보이면 이 이슈의 사용자 안내가 무의미해지므로 같이 간다. 현재 `position`을 안 줘서 sonner 기본값(우측 하단)을 쓰고 있다.

- [ ] **Step 1: 기본값을 준다**

`components/ui/sonner.tsx`의 `<Sonner ...>` 호출에 두 속성을 더한다. `theme` 바로 아래에 넣는다:

```tsx
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // 기본값은 우측 하단인데 제품 화면의 플로팅 독·챗봇 카드와 겹쳐 잘 안 보인다.
      position="top-right"
      closeButton
      className="toaster group"
```

`{...props}`가 마지막에 있으므로 호출부가 필요하면 덮을 수 있다.

- [ ] **Step 2: 타입과 린트를 확인한다**

Run: `pnpm typecheck && pnpm lint`
Expected: 통과

- [ ] **Step 3: 실제 화면에서 확인한다**

Run: `pnpm dev` 후 브라우저에서 mutation을 실패시켜 토스트를 띄운다 (예: 목 환경에서 프로젝트 삭제 실패 경로).
Expected: 토스트가 **우측 상단**에 뜨고 **닫기 버튼**이 있다.

- [ ] **Step 4: 커밋한다**

```bash
git add components/ui/sonner.tsx
git commit -m "[APP-205] 토스트를 우측 상단으로 옮기고 닫기 버튼을 넣는다"
```

---

### Task 7: 전체 검증과 이슈 정리

**Files:**
- 없음 (검증과 이슈 갱신)

**Interfaces:**
- Consumes: Task 1~6
- Produces: 없음

- [ ] **Step 1: 전체 검증을 돌린다**

```bash
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build && pnpm test:e2e
```

Expected: 전부 통과

- [ ] **Step 2: 실제 앱에서 만료를 재현한다**

`pnpm dev`로 띄우고 브라우저 devtools에서 인증 쿠키를 지운 뒤 노트 상세(`/w/{id}/notes/{noteId}`)를 연다.

확인할 셋:
1. Network 탭에서 `/v1/auth/refresh` 요청이 **정확히 1회**만 나간다
2. 토스트가 **정확히 1개** 뜬다
3. `/`로 이동하고 쿠키가 지워져 있다

- [ ] **Step 3: 네트워크 오류로는 안 튕기는지 확인한다**

devtools의 Network를 `Offline`으로 바꾸고 노트 화면을 연다.

Expected: 홈으로 **이동하지 않는다.** 만료 토스트도 뜨지 않는다. 온라인으로 되돌리면 정상 복귀한다.

이 셋이 이 이슈의 회귀 방지 핵심이다. 하나라도 어긋나면 멈추고 원인을 찾는다.

- [ ] **Step 4: codex 리뷰를 받는다**

```bash
codex exec review --base dev
```

P1·P2를 고치고 다시 돌린다. 회차 기록이 필요하면 `docs/codex-review-app-205.md`에 남긴다.

- [ ] **Step 5: 이슈를 web 전용으로 정리한다**

Linear APP-205에서:
- `heymoa-server` 라벨을 뗀다
- 할 일의 `(server) InvalidRefreshTokenException에 전용 AppErrorType 매핑 추가` 체크박스를 지운다
- 왜 뺐는지 댓글로 남긴다 — `AuthControllerE2eTest`가 이미 400과 `error.code`를 고정하고 있어 보호가 이미 있고, 매핑을 추가하면 `error.code`가 바뀌어 DocsTest·openapi3·web 미러·docs repo까지 따라오는 계약 변경이 된다

- [ ] **Step 6: dev에 머지한다**

skill [`merging`](../../../.claude/skills/merging/SKILL.md)을 따른다.

```bash
git checkout dev && git merge --squash feature/app-205-auth-session-gate
git commit -m "[APP-205] 인증 만료 시 token refresh 무한 루프"
git push
```

머지 직후 Linear 이슈를 Done으로 옮기고 완료 댓글을 단다 (rule `issue-tracking` ⑤).
