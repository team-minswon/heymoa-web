"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
  isLoggingOut: boolean;
  setUser: (user: AuthUser | null) => void;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser,
  beforeLogout,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
  beforeLogout?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { data: user, status: queryStatus } = useQuery<AuthUser | null>({
    queryKey: ["user"],
    queryFn: getMe,
    ...(initialUser !== null ? { initialData: initialUser } : {}),
    staleTime: 5 * 60 * 1000, // 5 minutes cache stale time
    retry: false,
    refetchOnWindowFocus: false,
  });

  const setUser = useCallback(
    (nextUser: AuthUser | null) => {
      queryClient.setQueryData(["user"], nextUser);
    },
    [queryClient]
  );

  const clearAuthenticatedState = useCallback(() => {
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "user",
    });
    queryClient.getMutationCache().clear();
    setUser(null);
  }, [queryClient, setUser]);

  const refreshUser = useCallback(async () => {
    try {
      const nextUser = await getMe();
      setUser(nextUser);
      return nextUser;
    } catch {
      setUser(null);
      return null;
    }
  }, [setUser]);

  const releaseAuthenticatedResources = useCallback(() => {
    if (!beforeLogout) return;

    try {
      void Promise.resolve(beforeLogout()).catch(() => undefined);
    } catch {
      // 인증은 이미 만료된 상태이므로 로컬 리소스 정리는 best-effort로 끝낸다.
    }
  }, [beforeLogout]);

  const logout = useCallback(async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      if (beforeLogout) await beforeLogout();
      await requestLogout();
      clearAuthenticatedState();
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoggingOut(false);
    }
  }, [beforeLogout, clearAuthenticatedState, isLoggingOut, router]);

  useEffect(() => {
    const handleAuthStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<AuthStateChangedDetail>).detail;

      if (detail?.reason === "logout" || detail?.reason === "unauthenticated") {
        if (detail.reason === "unauthenticated") {
          releaseAuthenticatedResources();
        }

        clearAuthenticatedState();
      }
    };

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);

    return () => {
      window.removeEventListener(
        AUTH_STATE_CHANGED_EVENT,
        handleAuthStateChanged
      );
    };
  }, [clearAuthenticatedState, releaseAuthenticatedResources]);

  const status = useMemo<AuthStatus>(() => {
    if ((queryStatus as string) === "pending") {
      return "checking";
    }
    return user ? "authenticated" : "anonymous";
  }, [queryStatus, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      status,
      isLoggingOut,
      setUser,
      refreshUser,
      logout,
    }),
    [user, status, isLoggingOut, setUser, refreshUser, logout]
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
