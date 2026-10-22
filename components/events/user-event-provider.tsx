"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/auth-provider";
import { AuthRefreshError } from "@/lib/api/fetcher";
import { getSubscribeUserEventsUrl } from "@/lib/api/generated/events/events";
import { getEventStream, sseHttpFailureOf } from "@/lib/api/sse";
import { SessionExpiredError } from "@/lib/auth/session-gate";
import {
  IDLE_TIMEOUT_MS,
  RECONNECT_BACKOFF_MS,
  RECONNECT_JITTER_MS,
} from "@/lib/chat/use-chat-stream";
import {
  filterOf,
  OWNED_TARGET,
  targetsForHint,
  type InvalidationTarget,
} from "@/lib/events/invalidation";
import { isNoteSocketOpen } from "@/lib/events/note-sockets";
import { parseUserEvent } from "@/lib/events/protocol";

/** 재연결·재조회를 흩는 창(배포 드레인 때 한꺼번에 붙지 않게). */
const RESYNC_JITTER_MS = 3_000;
/** 같은 쿼리의 연속 힌트를 합치는 창. */
const COALESCE_MS = 300;
/**
 * 다시 붙지 않는 응답. 404·501 은 스트림이 꺼진 서버(롤링 중 옛 인스턴스 포함), 429 는 사용자당 연결 상한 — 이 탭은
 * 지금 간격의 폴링으로 돈다. 401·403 은 갱신까지 실패한 인증이다.
 */
const TERMINAL_STATUS = new Set([401, 403, 404, 429, 501]);

const HealthContext = createContext(false);

/** 이벤트 스트림이 건강한가 — `ready` 를 받았고 끊기거나 `degraded` 가 오지 않았다. provider 밖이면 늘 `false`. */
export function useEventStreamHealthy() {
  return useContext(HealthContext);
}

type Timers = {
  setTimeout: (run: () => void, ms: number) => ReturnType<typeof setTimeout>;
  random: () => number;
};
const REAL_TIMERS: Timers = {
  setTimeout: (run, ms) => setTimeout(run, ms),
  random: Math.random,
};

/**
 * 사용자 단위 이벤트 스트림 provider(PRO-67 I02). **탭 하나에 연결 하나** — 워크스페이스를 바꿔도 다시 마운트되지 않는
 * `app/(product)/w/layout.tsx` 에 하나 둔다. 로그인한 경우만 연다.
 *
 * - `ready`: 첫 연결은 구독 전에 읽은 소유 쿼리를 바로 한 번 다시 검증하고, 재연결은 0~3초 지터 뒤 다시 읽는다
 * - 힌트: 대상 쿼리만 무효화한다. 같은 대상은 300ms 안에서 합치고, **숨은 탭은 모으기만 하다가 보일 때 한 번** 반영한다
 * - 끊김: 깨끗한 종료(최대 수명·드레인)는 0~3초 뒤 다시 붙고, 실패는 채팅 백오프로 **포기하지 않고** 다시 붙는다(상한
 *   15초, 503 이면 `Retry-After`). 404·501·429 와 인증 실패는 멈춘다. 끊긴 동안은 `healthy=false` 라 쿼리가 원래 간격으로 돈다
 * - 40초 동안 아무것도(하트비트 포함) 안 오면 끊고 다시 붙는다. 온라인 복귀는 기다리던 재연결을 바로 깨운다
 */
export function UserEventProvider({
  children,
  timers = REAL_TIMERS,
}: {
  children: React.ReactNode;
  /** 검사에서만 넘긴다 */
  timers?: Timers;
}) {
  const queryClient = useQueryClient();
  const { status } = useAuth();
  const [healthy, setHealthy] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let stopped = false;
    let controller: AbortController | null = null;
    let wake: (() => void) | null = null;
    let attempt = 0;
    let connectedOnce = false;
    const pending = new Set<InvalidationTarget>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const visible = () => document.visibilityState === "visible";

    const flush = () => {
      flushTimer = null;
      if (stopped || !visible()) return;
      const targets = [...pending];
      pending.clear();
      for (const target of targets)
        void queryClient.invalidateQueries(filterOf(target));
    };
    const enqueue = (targets: InvalidationTarget[]) => {
      for (const target of targets) pending.add(target);
      if (pending.size === 0 || !visible() || flushTimer !== null) return;
      flushTimer = timers.setTimeout(flush, COALESCE_MS);
    };
    const later = (ms: number, run: () => void) =>
      timers.setTimeout(() => !stopped && run(), ms);
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = timers.setTimeout(done, ms);
        function done() {
          clearTimeout(timer);
          wake = null;
          resolve();
        }
        wake = done;
      });

    const onVisibility = () => visible() && enqueue([]);
    const onOnline = () => {
      attempt = 0;
      wake?.();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    const run = async () => {
      while (!stopped) {
        const current = new AbortController();
        controller = current;
        let idle: ReturnType<typeof setTimeout> | undefined;
        const resetIdle = () => {
          clearTimeout(idle);
          idle = timers.setTimeout(() => current.abort(), IDLE_TIMEOUT_MS);
        };
        let failure: unknown = null;
        try {
          resetIdle();
          for await (const frame of getEventStream(
            getSubscribeUserEventsUrl(),
            {
              signal: current.signal,
            }
          )) {
            resetIdle();
            const event = parseUserEvent(frame);
            if (!event) continue;
            switch (event.type) {
              case "ready":
                attempt = 0;
                setHealthy(true);
                if (!connectedOnce) {
                  connectedOnce = true;
                  enqueue([OWNED_TARGET]);
                } else {
                  later(timers.random() * RESYNC_JITTER_MS, () =>
                    enqueue([OWNED_TARGET])
                  );
                }
                break;
              case "degraded":
                setHealthy(false);
                break;
              case "resync":
                later(timers.random() * RESYNC_JITTER_MS, () =>
                  enqueue([OWNED_TARGET])
                );
                break;
              default:
                enqueue(targetsForHint(event, { isNoteSocketOpen }));
            }
          }
        } catch (error) {
          failure = error;
        }
        clearTimeout(idle);
        setHealthy(false);
        if (stopped) return;
        if (failure === null) {
          await sleep(timers.random() * RESYNC_JITTER_MS);
          continue;
        }
        const http = sseHttpFailureOf(failure);
        if (
          failure instanceof SessionExpiredError ||
          (failure instanceof AuthRefreshError && failure.expired) ||
          (http && TERMINAL_STATUS.has(http.httpStatus))
        )
          return;
        const step =
          RECONNECT_BACKOFF_MS[
            Math.min(attempt, RECONNECT_BACKOFF_MS.length - 1)
          ];
        attempt += 1;
        await sleep(
          http?.retryAfterMs ?? step + timers.random() * RECONNECT_JITTER_MS
        );
      }
    };
    void run();

    return () => {
      stopped = true;
      controller?.abort();
      wake?.();
      if (flushTimer !== null) clearTimeout(flushTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      setHealthy(false);
    };
  }, [queryClient, status, timers]);

  return (
    <HealthContext.Provider value={healthy}>{children}</HealthContext.Provider>
  );
}
