"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/ui/toast";

import {
  AUTH_STATE_CHANGED_EVENT,
  SESSION_EXPIRED_PARAM,
  type AuthStateChangedDetail,
} from "@/lib/auth/events";
import { resetAnalytics } from "@/lib/analytics/track";
import { clearUserFlags } from "@/lib/storage/user-flags";
import { getMe, logout as requestLogout } from "@/lib/auth/api";
import { isSessionExpired } from "@/lib/auth/session-gate";
import type { AuthUser } from "@/lib/auth/types";
import { documentLocale } from "@/lib/i18n/document-locale";
import { DEFAULT_LOCALE, localePath } from "@/lib/i18n/locales";

type AuthStatus = "checking" | "authenticated" | "anonymous";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  isLoggingOut: boolean;
  setUser: (user: AuthUser | null) => void;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  leave: (destination: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function landingHome() {
  return localePath(documentLocale() ?? DEFAULT_LOCALE, "/");
}

export function AuthProvider({
  children,
  initialUser,
  beforeLogout,
}: {
  children: React.ReactNode;
  initialUser: AuthUser | null;
  beforeLogout?: () => Promise<void> | void;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("auth");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutStarted = useRef(false);

  const { data: user, status: queryStatus } = useQuery<AuthUser | null>({
    queryKey: ["user"],
    queryFn: getMe,
    ...(initialUser !== null ? { initialData: initialUser } : {}),
    staleTime: 5 * 60 * 1000,
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
    const nextUser = await getMe();
    setUser(nextUser);
    return nextUser;
  }, [setUser]);

  const leaveAuthenticatedApp = useCallback(
    (destination: string) => {
      void queryClient.cancelQueries();
      resetAnalytics();
      clearUserFlags();
      window.location.replace(destination);
    },
    [queryClient]
  );

  const releaseAuthenticatedResources = useCallback(() => {
    if (!beforeLogout) return;

    try {
      void Promise.resolve(beforeLogout()).catch(() => undefined);
    } catch {}
  }, [beforeLogout]);

  const logout = useCallback(async () => {
    if (logoutStarted.current) return;

    logoutStarted.current = true;
    setIsLoggingOut(true);
    try {
      if (beforeLogout) await beforeLogout();
      await requestLogout();
      leaveAuthenticatedApp(landingHome());
    } catch {
      logoutStarted.current = false;
      setIsLoggingOut(false);
      toast.error(t("logoutFailed"));
    }
    // location.replace starts navigation asynchronously. Keep controls locked
    // until the new document replaces this one instead of flashing active again.
  }, [beforeLogout, leaveAuthenticatedApp, t]);

  useEffect(() => {
    const handleAuthStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<AuthStateChangedDetail>).detail;

      if (detail?.reason !== "unauthenticated") {
        return;
      }

      releaseAuthenticatedResources();

      // access·refresh 쿠키는 HttpOnly라 JS가 못 지운다. 서버가 만료 Set-Cookie를
      // 내려주는 것이 유일한 방법이고, LogoutService는 토큰도 세션도 없을 때 조용히
      // 반환하므로 이 호출은 안전하다. 실패해도 이동은 그대로 진행한다 — 남은 쿠키는
      // 다음 SSR에서 proxy.ts의 clearAuthCookies()가 정리한다.
      void requestLogout().catch(() => undefined);

      leaveAuthenticatedApp(`${landingHome()}?${SESSION_EXPIRED_PARAM}`);
    };

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);

    return () => {
      window.removeEventListener(
        AUTH_STATE_CHANGED_EVENT,
        handleAuthStateChanged
      );
    };
  }, [leaveAuthenticatedApp, releaseAuthenticatedResources]);

  // **세션이 끝난 문서는 되살리지 않는다.** 하드 내비게이션은 현재 히스토리 엔트리만
  // 교체하므로, 앱 안에서 여러 번 이동한 뒤 로그아웃했다면 이전 엔트리가 남는다. 거기로
  // 뒤로 가면 브라우저가 이 문서를 BFCache에서 힙째 복원한다 — 쿼리 캐시도 Next의 라우터
  // 캐시도 로그아웃 직전 그대로라, 이미 로그아웃한 워크스페이스 화면이 다시 보인다.
  // 복원된 문서에서는 새로 받는다. 게이트가 열려 있다는 것이 "이 문서의 세션은 끝났다"는
  // 뜻이므로 살아 있는 세션의 뒤로 가기는 건드리지 않는다.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !isSessionExpired()) return;

      window.location.reload();
    };

    window.addEventListener("pageshow", handlePageShow);

    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    const [key, value] = SESSION_EXPIRED_PARAM.split("=");
    const url = new URL(window.location.href);

    if (url.searchParams.get(key) !== value) return;

    toast.error(t("sessionExpired"));
    url.searchParams.delete(key);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [t]);

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
      leave: leaveAuthenticatedApp,
    }),
    [
      user,
      status,
      isLoggingOut,
      setUser,
      refreshUser,
      logout,
      leaveAuthenticatedApp,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthUserId(): string | undefined {
  return useContext(AuthContext)?.user?.userId;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
