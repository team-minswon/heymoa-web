"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getMe, logout as requestLogout } from "@/lib/auth/api";
import {
  AUTH_STATE_CHANGED_EVENT,
  type AuthStateChangedDetail,
} from "@/lib/auth/events";
import type { AuthUser } from "@/lib/auth/types";

type AuthStatus = "checking" | "authenticated" | "anonymous";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
  initialUser: AuthUser | null;
};

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [status, setStatus] = useState<AuthStatus>(
    initialUser ? "authenticated" : "checking"
  );

  const refreshUser = useCallback(async () => {
    setStatus((currentStatus) =>
      currentStatus === "authenticated" ? currentStatus : "checking"
    );

    try {
      const nextUser = await getMe();
      setUser(nextUser);
      setStatus("authenticated");
      return nextUser;
    } catch {
      setUser(null);
      setStatus("anonymous");
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await requestLogout();
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    if (!initialUser) {
      const timeoutId = window.setTimeout(() => {
        void refreshUser();
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [initialUser, refreshUser]);

  useEffect(() => {
    const handleAuthStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<AuthStateChangedDetail>).detail;

      if (detail?.reason === "logout" || detail?.reason === "unauthenticated") {
        setUser(null);
        setStatus("anonymous");
      }
    };

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);

    return () => {
      window.removeEventListener(
        AUTH_STATE_CHANGED_EVENT,
        handleAuthStateChanged
      );
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      refreshUser,
      logout,
    }),
    [user, status, refreshUser, logout]
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
