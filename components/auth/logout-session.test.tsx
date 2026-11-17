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

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@/lib/ui/toast", () => ({ toast }));

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

/** BFCache 복원. jsdom 에는 `PageTransitionEvent` 생성자가 없어 직접 만듭니다. */
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
  language: null,
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function serverThatLogsOut() {
  let loggedIn = true;

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

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
    expect(
      requestedUrls().filter((url) => url.includes("/v1/auth/refresh"))
    ).toEqual([]);
  });

  it("로그아웃한 문서가 BFCache로 되살아나면 새로 받는다", async () => {
    const { result } = renderWithNotes(() => apiFetch<unknown>("/v1/notes"));

    await waitFor(() => expect(result.current.notes.isSuccess).toBe(true));

    dispatchRestoreFromBFCache();
    expect(reload).not.toHaveBeenCalled();

    await act(() => result.current.auth.logout());
    dispatchRestoreFromBFCache();

    expect(reload).toHaveBeenCalledOnce();
  });

  it("로그아웃 뒤 남은 요청은 네트워크를 타지 않는다", async () => {
    const { result } = renderWithNotes(() => apiFetch<unknown>("/v1/notes"));

    await waitFor(() => expect(result.current.notes.isSuccess).toBe(true));

    await act(() => result.current.auth.logout());

    await expect(apiFetch("/v1/notes")).rejects.toBeInstanceOf(
      SessionExpiredError
    );
    expect(
      requestedUrls().filter((url) => url.includes("/v1/auth/refresh"))
    ).toEqual([]);
  });
});
