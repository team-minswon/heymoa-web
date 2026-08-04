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
import { toast } from "@/lib/ui/toast";

import {
  AUTH_STATE_CHANGED_EVENT,
  SESSION_EXPIRED_PARAM,
  type AuthStateChangedDetail,
} from "@/lib/auth/events";
import { getMe, logout as requestLogout } from "@/lib/auth/api";
import { isSessionExpired } from "@/lib/auth/session-gate";
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

  /**
   * 인증된 앱을 떠난다. **하드 내비게이션이어야 한다** — 세션 게이트는 모듈 수준 상태이고
   * 새 문서로만 풀린다. 소프트 이동하면 도착지에서도 모든 요청이 거절돼 앱이 죽은 채
   * 남는다(APP-223). 게이트를 클라이언트에서 리셋해 때우지 않는다. 게이트가 있는 이유가
   * 401을 만난 호출부들이 각자 갱신을 시도하는 무한 루프를 막는 것이다(APP-205).
   *
   * **진행 중인 조회만 끊고 캐시는 그대로 둔다.** 쿠키가 사라진 뒤 도착하는 401은 갱신까지
   * 부르고 화면을 오류로 바꾼다. 반대로 캐시를 비우면 아직 떠 있는 화면이 그 자리에서 다시
   * 조회해, 새 문서가 뜨기까지 수백 ms 동안 "노트를 불러오지 못했습니다"가 떴다. 어차피
   * 문서째 버릴 참이라 비울 이유도 없다. 단, "문서째 버린다"가 **뒤로 가기에는 성립하지
   * 않는다** — 남은 히스토리 엔트리로 돌아오면 이 문서가 BFCache에서 힙째 되살아난다.
   * 그 대비는 아래 `pageshow` 핸들러다.
   */
  const leaveAuthenticatedApp = useCallback(
    (destination: string) => {
      void queryClient.cancelQueries();
      window.location.replace(destination);
    },
    [queryClient]
  );

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
      leaveAuthenticatedApp("/");
    } catch {
      toast.error("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsLoggingOut(false);
    }
  }, [beforeLogout, isLoggingOut, leaveAuthenticatedApp]);

  useEffect(() => {
    const handleAuthStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<AuthStateChangedDetail>).detail;

      // reason "logout"은 여기서 할 일이 없다. 캐시는 하드 내비게이션이 문서째 버리고,
      // 이동과 문구는 `logout()`이 정한다. 아래 만료 처리가 부르는 `requestLogout()`도 이
      // 핸들러로 재진입하는데, 거기서 또 이동하거나 토스트를 띄우면 두 번씩 일어난다.
      if (detail?.reason !== "unauthenticated") {
        return;
      }

      releaseAuthenticatedResources();

      // access·refresh 쿠키는 HttpOnly라 JS가 못 지운다. 서버가 만료 Set-Cookie를
      // 내려주는 것이 유일한 방법이고, LogoutService는 토큰도 세션도 없을 때 조용히
      // 반환하므로 이 호출은 안전하다. 실패해도 이동은 그대로 진행한다 — 남은 쿠키는
      // 다음 SSR에서 proxy.ts의 clearAuthCookies()가 정리한다.
      void requestLogout().catch(() => undefined);

      // 사유는 쿼리로 넘긴다 — 토스트는 새 문서와 함께 사라진다.
      leaveAuthenticatedApp(`/?${SESSION_EXPIRED_PARAM}`);
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
