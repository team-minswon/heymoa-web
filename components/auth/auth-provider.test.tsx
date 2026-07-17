import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { AUTH_STATE_CHANGED_EVENT } from "@/lib/auth/events";
import type { AuthUser } from "@/lib/auth/types";

const router = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const authApi = vi.hoisted(() => ({
  getMe: vi.fn(),
  logout: vi.fn(),
}));

const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/lib/auth/api", () => ({
  getMe: authApi.getMe,
  logout: authApi.logout,
}));

vi.mock("sonner", () => ({ toast }));

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
    toast.error.mockReset();
    router.replace.mockReset();
    router.refresh.mockReset();
  });

  it("exposes logout pending state and clears client state before returning home", async () => {
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
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();

    await act(async () => {
      request.resolve();
      await logoutPromise;
    });

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(result.current.isLoggingOut).toBe(false);
    expect(
      queryClient.getQueryData(["workspace", "workspace-1"])
    ).toBeUndefined();
    expect(queryClient.getQueryData(["user"])).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/");
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(router.replace.mock.invocationCallOrder[0]).toBeLessThan(
      router.refresh.mock.invocationCallOrder[0]
    );
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
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("releases browser resources when authentication expires", async () => {
    const beforeLogout = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["workspace", "workspace-1"], {
      name: "회의 워크스페이스",
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={user} beforeLogout={beforeLogout}>
          {children}
        </AuthProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      window.dispatchEvent(
        new CustomEvent(AUTH_STATE_CHANGED_EVENT, {
          detail: { reason: "unauthenticated" },
        })
      );
    });

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(beforeLogout).toHaveBeenCalledOnce();
    expect(authApi.logout).not.toHaveBeenCalled();
    expect(
      queryClient.getQueryData(["workspace", "workspace-1"])
    ).toBeUndefined();
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
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요."
    );
  });
});
