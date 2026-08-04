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
import { resetSessionGate } from "@/lib/auth/session-gate";
import type { AuthUser } from "@/lib/auth/types";

// 이 파일만 `@/lib/auth/api`를 목하지 않는다. 버그가 살던 자리가 **로그아웃 요청과 그 뒤에
// 남은 쿼리 사이**라서, api를 목하면 재현할 구간이 통째로 사라진다.
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@/lib/ui/toast", () => ({ toast }));

// jsdom은 실제 이동을 구현하지 않아 location.replace가 "Not implemented"로 터진다.
const hardNavigate = vi.fn();
Object.defineProperty(window, "location", {
  configurable: true,
  value: {
    replace: hardNavigate,
    get href() {
      return document.URL;
    },
  },
});

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

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

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
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", serverThatLogsOut());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // 로그아웃이 캐시를 비우면 아직 마운트된 제품 쿼리들이 그 자리에서 다시 조회한다 —
  // 사이드바처럼 `useAuth()`를 함께 구독하는 화면이 로그아웃 상태 변화로 리렌더되기
  // 때문이다. 쿠키는 이미 지워진 뒤라 그 요청들이 401 → 갱신 실패 → 만료 경로를 깨웠고,
  // 스스로 누른 로그아웃이 "세션이 만료되었습니다"로 둔갑한 채 홈에 떨어졌다.
  // Grafana에도 로그아웃 완료 직후 리프레시 요청이 매번 남았다.
  it("스스로 로그아웃한 사용자를 만료로 취급하지 않는다", async () => {
    const loadNotes = vi.fn(() => apiFetch<unknown>("/v1/notes"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({
        auth: useAuth(),
        notes: useQuery({ queryKey: ["notes"], queryFn: loadNotes }),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.notes.isSuccess).toBe(true));

    await act(() => result.current.auth.logout());

    // 캐시가 비었으니 쿼리는 실제로 다시 조회한다. 재현 조건이 사라지면 이 테스트는
    // 아무것도 안 지키게 되므로 여기서 확인한다.
    await waitFor(() => expect(loadNotes).toHaveBeenCalledTimes(2));

    const requested = vi
      .mocked(fetch)
      .mock.calls.map(([input]) => String(input));

    // 두 번째 조회는 네트워크를 타지 않고 세션 게이트에서 끝난다 — 401도, 갱신도 없다.
    expect(requested.filter((url) => url.includes("/v1/notes"))).toHaveLength(1);
    expect(requested.filter((url) => url.includes("/v1/auth/refresh"))).toEqual(
      []
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(hardNavigate).toHaveBeenCalledWith("/");
    expect(hardNavigate).not.toHaveBeenCalledWith("/?session=expired");
  });
});
