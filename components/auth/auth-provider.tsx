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
import { toast } from "@/lib/ui/toast";

import {
  AUTH_STATE_CHANGED_EVENT,
  SESSION_EXPIRED_PARAM,
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

      if (detail?.reason === "logout") {
        clearAuthenticatedState();
        return;
      }

      if (detail?.reason !== "unauthenticated") {
        return;
      }

      releaseAuthenticatedResources();
      clearAuthenticatedState();

      // access·refresh 쿠키는 HttpOnly라 JS가 못 지운다. 서버가 만료 Set-Cookie를
      // 내려주는 것이 유일한 방법이고, LogoutService는 토큰도 세션도 없을 때 조용히
      // 반환하므로 이 호출은 안전하다. 실패해도 이동은 그대로 진행한다 — 남은 쿠키는
      // 다음 SSR에서 proxy.ts의 clearAuthCookies()가 정리한다.
      //
      // 이 호출이 끝나면 logout()이 reason "logout" 이벤트를 다시 쏘아 이 핸들러에
      // 재진입한다. 위 갈래가 캐시만 비우고 끝내는 이유가 그것이다 — 거기서 이동이나
      // 토스트를 하면 두 번씩 일어난다.
      void requestLogout().catch(() => undefined);

      // **하드 내비게이션이어야 한다.** 세션 게이트는 모듈 수준 상태이고 "만료는 새 문서로만
      // 풀린다"가 그 모듈의 규칙이다(닫는 함수는 테스트 전용). router.replace는 같은 문서라
      // 홈에 도착해도 게이트가 열린 채여서, 이후 모든 요청이 네트워크도 안 타고 거절된다 —
      // 수동 새로고침 전까지 앱이 죽어 있었다.
      //
      // 게이트를 클라이언트에서 리셋해 때우지 않는다. 게이트가 있는 이유가 401을 만난
      // 호출부들이 각자 갱신을 시도하는 무한 루프를 막는 것이다(APP-205).
      //
      // 사유는 쿼리로 넘긴다 — 토스트는 새 문서와 함께 사라진다.
      window.location.replace(`/?${SESSION_EXPIRED_PARAM}`);
    };

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleAuthStateChanged);

    return () => {
      window.removeEventListener(
        AUTH_STATE_CHANGED_EVENT,
        handleAuthStateChanged
      );
    };
  }, [clearAuthenticatedState, releaseAuthenticatedResources, router]);

  // 만료로 쫓겨나 도착한 문서에서 사유를 한 번 보이고 쿼리를 지운다. 안 지우면 새로고침·
  // 뒤로가기마다 다시 뜬다. `history.replaceState`라 이동이 아니라 주소만 정리된다.
  useEffect(() => {
    const [key, value] = SESSION_EXPIRED_PARAM.split("=");
    const url = new URL(window.location.href);

    if (url.searchParams.get(key) !== value) return;

    toast.error("세션이 만료되었습니다. 다시 로그인해 주세요.");
    url.searchParams.delete(key);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, []);

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
