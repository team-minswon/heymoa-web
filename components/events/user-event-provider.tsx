"use client";

import { useEffect, useState } from "react";
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
import { EventStreamHealthContext } from "@/lib/events/health";

const RESYNC_JITTER_MS = 3_000;
const COALESCE_MS = 300;
const TERMINAL_STATUS = new Set([401, 403, 404, 429, 501]);

export { useEventStreamHealthy } from "@/lib/events/health";

type Timers = {
  setTimeout: (run: () => void, ms: number) => ReturnType<typeof setTimeout>;
  random: () => number;
};
const REAL_TIMERS: Timers = {
  setTimeout: (run, ms) => setTimeout(run, ms),
  random: Math.random,
};

export function UserEventProvider({
  children,
  timers = REAL_TIMERS,
}: {
  children: React.ReactNode;
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
    <EventStreamHealthContext.Provider value={healthy}>
      {children}
    </EventStreamHealthContext.Provider>
  );
}
