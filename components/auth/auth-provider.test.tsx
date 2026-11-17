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
  language: null,
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
    authApi.logout.mockResolvedValue(undefined);
    toast.error.mockReset();
    hardNavigate.mockReset();
    window.history.replaceState(null, "", "/");
  });

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

    expect(result.current.isLoggingOut).toBe(true);
    expect(hardNavigate).toHaveBeenCalledWith("/");
    expect(queryClient.getQueryData(["workspace", "workspace-1"])).toEqual({
      name: "회의 워크스페이스",
    });
    await act(() => result.current.logout());
    expect(authApi.logout).toHaveBeenCalledOnce();
  });

  it("영어 화면에서 로그아웃하면 영어 랜딩(/en)으로 간다 (APP-1285)", async () => {
    document.documentElement.lang = "en";
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(hardNavigate).toHaveBeenCalledWith("/en");
    document.documentElement.lang = "";
  });

  it("한 렌더에서 연속 클릭해도 리소스 정리와 로그아웃은 한 번만 시작한다", async () => {
    const resources = deferred<void>();
    const beforeLogout = vi.fn(() => resources.promise);
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
    let first!: Promise<void>;
    act(() => {
      const logout = result.current.logout;
      first = logout();
      void logout();
    });
    expect(beforeLogout).toHaveBeenCalledOnce();
    expect(authApi.logout).not.toHaveBeenCalled();
    await act(async () => {
      resources.resolve();
      await first;
    });
    expect(authApi.logout).toHaveBeenCalledOnce();
    expect(hardNavigate).toHaveBeenCalledOnce();
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
    await act(() => result.current.logout());
    expect(authApi.logout).toHaveBeenCalledTimes(2);
    expect(hardNavigate).toHaveBeenCalledWith("/");
    expect(result.current.isLoggingOut).toBe(true);
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

  it("일시 로그인 조회 실패를 전파하고 기존 사용자와 캐시를 보존한다", async () => {
    const failure = new Error("temporary network failure");
    authApi.getMe.mockRejectedValueOnce(failure);
    const { result } = renderWithProvider();

    await act(async () => {
      await expect(result.current.refreshUser()).rejects.toBe(failure);
    });

    expect(result.current.user).toEqual(user);
    expect(result.current.status).toBe("authenticated");
    expect(hardNavigate).not.toHaveBeenCalled();
    expect(authApi.logout).not.toHaveBeenCalled();
  });

  it("캐시 재조회가 실패해도 로그인된 사용자와 제품 캐시를 보존한다", async () => {
    const failure = new Error("temporary API failure");
    authApi.getMe.mockRejectedValueOnce(failure);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["workspace", "workspace-1"], { name: "회의" });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={user}>{children}</AuthProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(() => queryClient.invalidateQueries({ queryKey: ["user"] }));

    expect(queryClient.getQueryState(["user"])?.error).toBe(failure);
    expect(result.current.user).toEqual(user);
    expect(result.current.status).toBe("authenticated");
    expect(queryClient.getQueryData(["workspace", "workspace-1"])).toEqual({
      name: "회의",
    });
    expect(hardNavigate).not.toHaveBeenCalled();
    expect(authApi.logout).not.toHaveBeenCalled();
  });

  it("확정된 익명 응답은 사용자 캐시를 비운다", async () => {
    authApi.getMe.mockResolvedValueOnce(null);
    const { result } = renderWithProvider();

    await act(async () => {
      expect(await result.current.refreshUser()).toBeNull();
    });

    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.status).toBe("anonymous");
    });
    expect(hardNavigate).not.toHaveBeenCalled();
  });

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
