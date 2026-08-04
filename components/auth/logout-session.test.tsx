import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api/fetcher";
import { resetSessionGate, SessionExpiredError } from "@/lib/auth/session-gate";
import type { AuthUser } from "@/lib/auth/types";

// 이 파일만 `@/lib/auth/api`를 목하지 않는다. 버그가 살던 자리가 **로그아웃 요청과 그 뒤에
// 남은 쿼리 사이**라서, api를 목하면 재현할 구간이 통째로 사라진다.
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@/lib/ui/toast", () => ({ toast }));

// jsdom은 실제 이동을 구현하지 않아 location.replace가 "Not implemented"로 터진다.
const hardNavigate = vi.fn();
const reload = vi.fn();
Object.defineProperty(window, "location", {
  configurable: true,
  value: {
    replace: hardNavigate,
    reload,
    get href() {
      return document.URL;
    },
  },
});

/** BFCache 복원. jsdom에는 `PageTransitionEvent` 생성자가 없어 직접 만든다. */
function dispatchRestoreFromBFCache() {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: true });
  window.dispatchEvent(event);
}

const user: AuthUser = {
  userId: "user-12345",
  name: "테스트 유저",
  email: "test@heymoa.com",
  image: null,
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 로그아웃 전에는 조회가 되고, 그 뒤로는 쿠키가 없어 401만 돌려주는 서버. */
function serverThatLogsOut() {
  let loggedIn = true;

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    // 응답하지 않는 조회. 로그아웃이 진행 중인 요청을 끊어 주는지 보려면 붙잡고 있어야 한다.
    if (url.includes("/v1/transcript")) {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      });
    }

    if (url.includes("/v1/auth/logout")) {
      loggedIn = false;
      return jsonResponse(200, { success: true, data: null });
    }

    if (url.includes("/v1/auth/refresh")) {
      return jsonResponse(401, {
        success: false,
        error: { code: "INVALID_REFRESH_TOKEN", message: "만료" },
      });
    }

    return loggedIn
      ? jsonResponse(200, { success: true, data: { notes: [] } })
      : jsonResponse(401, {
          success: false,
          error: { code: "UNAUTHORIZED", message: "인증이 필요합니다." },
        });
  });
}

describe("로그아웃과 세션 만료", () => {
  beforeEach(() => {
    resetSessionGate();
    toast.error.mockReset();
    hardNavigate.mockReset();
    reload.mockReset();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", serverThatLogsOut());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderWithNotes(
    loadNotes: (context: { signal: AbortSignal }) => Promise<unknown>
  ) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </QueryClientProvider>
    );

    // 사이드바처럼 `useAuth()`를 함께 구독하는 제품 화면. 로그아웃 상태가 바뀌면 리렌더된다.
    return renderHook(
      () => ({
        auth: useAuth(),
        notes: useQuery({ queryKey: ["notes"], queryFn: loadNotes }),
      }),
      { wrapper }
    );
  }

  function requestedUrls() {
    return vi.mocked(fetch).mock.calls.map(([input]) => String(input));
  }

  // 로그아웃이 캐시를 비우면 아직 떠 있는 화면이 그 자리에서 다시 조회한다. 쿠키는 이미
  // 지워진 뒤라 그 요청들이 401 → 갱신 실패 → 만료 경로를 깨웠고, 스스로 누른 로그아웃이
  // "세션이 만료되었습니다"로 둔갑했다. 게이트를 막은 뒤로는 만료 대신 "노트를 불러오지
  // 못했습니다"가 수백 ms 떴다 — 어느 쪽이든 원인은 **떠나는 화면을 다시 조회시킨 것**이다.
  it("로그아웃은 남은 화면을 다시 조회시키지 않는다", async () => {
    const loadNotes = vi.fn(() => apiFetch<unknown>("/v1/notes"));
    const { result } = renderWithNotes(loadNotes);

    await waitFor(() => expect(result.current.notes.isSuccess).toBe(true));

    await act(() => result.current.auth.logout());

    expect(loadNotes).toHaveBeenCalledOnce();
    expect(toast.error).not.toHaveBeenCalled();
    expect(requestedUrls().filter((url) => url.includes("/v1/notes"))).toEqual([
      "/v1/notes",
    ]);
    expect(hardNavigate).toHaveBeenCalledWith("/");
    expect(hardNavigate).not.toHaveBeenCalledWith("/?session=expired");
  });

  // 캐시를 안 비우면 진행 중인 요청도 안 끊긴다. 로그아웃 POST와 겹쳐 있던 조회는 쿠키가
  // 지워진 뒤 401을 맞고 갱신까지 부른 다음 화면을 오류로 바꾼다 — 예전엔 `removeQueries()`가
  // AbortSignal로 끊어 주던 자리다.
  it("로그아웃하면 진행 중인 조회를 끊는다", async () => {
    const { result } = renderWithNotes(({ signal }) =>
      apiFetch<unknown>("/v1/transcript", { signal })
    );

    await waitFor(() => expect(result.current.notes.isFetching).toBe(true));

    await act(() => result.current.auth.logout());

    const transcript = vi
      .mocked(fetch)
      .mock.calls.find(([input]) => String(input).includes("/v1/transcript"));

    expect(transcript?.[1]?.signal?.aborted).toBe(true);
    expect(requestedUrls().filter((url) => url.includes("/v1/auth/refresh"))).toEqual(
      []
    );
  });

  // 하드 내비게이션은 현재 히스토리 엔트리만 교체한다. 앱 안에서 여러 번 이동한 뒤
  // 로그아웃하고 뒤로 가면, 브라우저가 이 문서를 BFCache에서 힙째 복원해 이미 로그아웃한
  // 워크스페이스 화면과 그 캐시가 다시 보인다.
  it("로그아웃한 문서가 BFCache로 되살아나면 새로 받는다", async () => {
    const { result } = renderWithNotes(() => apiFetch<unknown>("/v1/notes"));

    await waitFor(() => expect(result.current.notes.isSuccess).toBe(true));

    dispatchRestoreFromBFCache();
    expect(reload).not.toHaveBeenCalled();

    await act(() => result.current.auth.logout());
    dispatchRestoreFromBFCache();

    expect(reload).toHaveBeenCalledOnce();
  });

  // 캐시를 안 건드려도 폴링 타이머·스트림은 새 문서가 뜨기 전까지 살아 있다. 그 요청이
  // 401을 맞으면 다시 만료 경로가 열리므로, 게이트가 네트워크 앞에서 끊어야 한다.
  it("로그아웃 뒤 남은 요청은 네트워크를 타지 않는다", async () => {
    const { result } = renderWithNotes(() => apiFetch<unknown>("/v1/notes"));

    await waitFor(() => expect(result.current.notes.isSuccess).toBe(true));

    await act(() => result.current.auth.logout());

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(
      SessionExpiredError
    );
    expect(requestedUrls().filter((url) => url.includes("/v1/auth/refresh"))).toEqual(
      []
    );
  });
});
