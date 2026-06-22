"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();

  const { data: user, status: queryStatus } = useQuery<AuthUser | null>({
    queryKey: ["user"],
    queryFn: getMe,
    initialData: initialUser,
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
