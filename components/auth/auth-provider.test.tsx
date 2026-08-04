import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { AUTH_STATE_CHANGED_EVENT } from "@/lib/auth/events";
import type { AuthUser } from "@/lib/auth/types";

const authApi = vi.hoisted(() => ({
  getMe: vi.fn(),
  logout: vi.fn(),
}));

const toast = vi.hoisted(() => ({ error: vi.fn() }));

// jsdom은 실제 이동을 구현하지 않아 location.replace가 "Not implemented"로 터진다.
// href는 document.URL로 위임해 history.replaceState가 반영되게 둔다.
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

vi.mock("@/lib/auth/api", () => ({
  getMe: authApi.getMe,
  logout: authApi.logout,
}));

vi.mock("@/lib/ui/toast", () => ({ toast }));

const user: AuthUser = {
  userId: "user-12345",
  name: "테스트 유저",
  email: "test@heymoa.com",
  image: null,
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("AuthProvider", () => {
  beforeEach(() => {
    authApi.getMe.mockResolvedValue(user);
    authApi.logout.mockReset();
    // 만료 처리가 logout을 best-effort로 부르므로 기본 구현이 promise여야 한다.
    authApi.logout.mockResolvedValue(undefined);
    toast.error.mockReset();
    // jsdom은 실제 이동을 구현하지 않는다. 로그아웃도 만료도 하드 내비게이션이라 여기서 잡는다.
    hardNavigate.mockReset();
    window.history.replaceState(null, "", "/");
  });

  // AuthProvider가 window에 리스너를 건다. 언마운트하지 않으면 앞선 테스트의 provider가
  // 남아 다음 테스트의 이벤트에도 반응해 호출 횟수가 부풀려진다.
  afterEach(() => {
    cleanup();
  });

  it("로그아웃 대기 상태를 노출하고 홈으로 하드 이동한다", async () => {
    const request = deferred<void>();
    authApi.logout.mockReturnValueOnce(request.promise);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["workspace", "workspace-1"], {
      name: "회의 워크스페이스",
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    let logoutPromise!: Promise<void>;
    act(() => {
      logoutPromise = result.current.logout();
    });

    expect(authApi.logout).toHaveBeenCalledOnce();
    expect(result.current.isLoggingOut).toBe(true);
    expect(result.current.user).toEqual(user);
    expect(hardNavigate).not.toHaveBeenCalled();

    await act(async () => {
      request.resolve();
      await logoutPromise;
    });

    await waitFor(() => expect(result.current.isLoggingOut).toBe(false));
    // 세션 게이트가 열린 채 소프트 이동하면 홈에서도 모든 요청이 거절된다 — 만료 처리와
    // 같은 이유로 하드 내비게이션이다.
    expect(hardNavigate).toHaveBeenCalledWith("/");
    // **캐시를 비우지 않는다.** 문서를 통째로 버리는 참이라 비울 이유가 없고, 비우면 아직
    // 떠 있는 화면이 다시 조회해 "노트를 불러오지 못했습니다"가 뜬 뒤에 로그아웃된다.
    expect(queryClient.getQueryData(["workspace", "workspace-1"])).toEqual({
      name: "회의 워크스페이스",
    });
  });

  it("stops active browser resources before requesting logout", async () => {
    const order: string[] = [];
    const beforeLogout = vi.fn(async () => {
      order.push("disconnect-recording");
    });
    authApi.logout.mockImplementationOnce(async () => {
      order.push("logout-request");
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={user} beforeLogout={beforeLogout}>
          {children}
        </AuthProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(() => result.current.logout());

    expect(order).toEqual(["disconnect-recording", "logout-request"]);
    expect(hardNavigate).toHaveBeenCalledWith("/");
  });

  it("releases browser resources when authentication expires", async () => {
    const beforeLogout = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={user} beforeLogout={beforeLogout}>
          {children}
        </AuthProvider>
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

    await waitFor(() => expect(beforeLogout).toHaveBeenCalledOnce());
    // APP-205부터 만료 처리가 logout을 부른다. HttpOnly 쿠키는 JS가 못 지우므로
    // 서버가 만료 Set-Cookie를 내려주는 것이 유일한 정리 수단이다.
    expect(authApi.logout).toHaveBeenCalledTimes(1);
  });

  it("keeps the authenticated state and reports a recoverable logout failure", async () => {
    authApi.logout.mockRejectedValueOnce(new Error("network down"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(() => result.current.logout());

    expect(result.current.user).toEqual(user);
    expect(result.current.isLoggingOut).toBe(false);
    expect(hardNavigate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요."
    );
  });

  function renderWithProvider() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </QueryClientProvider>
    );

    return renderHook(() => useAuth(), { wrapper });
  }

  function dispatchExpired() {
    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_STATE_CHANGED_EVENT, {
          detail: { reason: "unauthenticated" },
        })
      );
    });
  }

  // 세션 게이트는 모듈 수준 상태이고 새 문서로만 풀린다. 소프트 이동으로 보내면 홈에
  // 도착해도 게이트가 열린 채라 이후 모든 요청이 거절된다 — 앱이 죽은 채 남았다(APP-223).
  it("만료 이벤트를 받으면 로그아웃하고 홈으로 하드 이동한다", async () => {
    authApi.logout.mockResolvedValue(undefined);
    renderWithProvider();

    dispatchExpired();

    await waitFor(() => {
      expect(hardNavigate).toHaveBeenCalledWith("/?session=expired");
    });
    expect(hardNavigate).toHaveBeenCalledOnce();
    expect(authApi.logout).toHaveBeenCalledTimes(1);
  });

  it("로그아웃 호출이 실패해도 홈으로 보낸다", async () => {
    authApi.logout.mockRejectedValue(new Error("네트워크"));
    renderWithProvider();

    dispatchExpired();

    await waitFor(() => {
      expect(hardNavigate).toHaveBeenCalledWith("/?session=expired");
    });
  });

  // 토스트는 하드 이동과 함께 사라지므로 사유를 쿼리로 넘긴다. 도착한 문서에서 한 번
  // 보이고 주소를 정리한다 — 안 지우면 새로고침·뒤로가기마다 다시 뜬다.
  it("만료로 도착하면 사유를 한 번 보이고 쿼리를 지운다", async () => {
    window.history.replaceState(null, "", "/?session=expired");

    renderWithProvider();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "세션이 만료되었습니다. 다시 로그인해 주세요."
      );
    });
    expect(window.location.href).not.toContain("session=expired");
  });

  it("평범하게 홈에 오면 만료 안내를 띄우지 않는다", () => {
    renderWithProvider();

    expect(toast.error).not.toHaveBeenCalled();
  });
});
