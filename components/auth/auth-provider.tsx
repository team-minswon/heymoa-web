"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getMe,
  isAuthApiConfigured,
  logout as requestLogout,
  refreshToken,
} from "@/lib/auth/api";
import type { AuthUser } from "@/lib/auth/types";

type AuthStatus = "checking" | "authenticated" | "anonymous";

type AuthContextValue = {
  accessToken: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    isAuthApiConfigured ? "checking" : "anonymous",
  );

  const applyTokenResponse = useCallback(
    async (token: string, responseUser?: AuthUser | null) => {
      const nextUser = responseUser ?? (await getMe(token));

      setAccessToken(token);
      setUser(nextUser);
      setStatus("authenticated");
    },
    [],
  );

  const refresh = useCallback(async () => {
    const tokenResponse = await refreshToken();
    await applyTokenResponse(tokenResponse.accessToken, tokenResponse.user);
  }, [applyTokenResponse]);

  const logout = useCallback(async () => {
    try {
      await requestLogout();
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    if (!isAuthApiConfigured) {
      return;
    }

    let active = true;

    refreshToken()
      .then(async (tokenResponse) => {
        const nextUser =
          tokenResponse.user ?? (await getMe(tokenResponse.accessToken));

        if (!active) {
          return;
        }

        setAccessToken(tokenResponse.accessToken);
        setUser(nextUser);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setAccessToken(null);
        setUser(null);
        setStatus("anonymous");
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      user,
      status,
      refresh,
      logout,
    }),
    [accessToken, user, status, refresh, logout],
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
