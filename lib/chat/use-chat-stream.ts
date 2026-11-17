"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { getSubscribeAgentChatTurnEventsUrl } from "@/lib/api/generated/agent-chat/agent-chat";
import { getEventStream } from "@/lib/api/sse";
import { isSessionExpired } from "@/lib/auth/session-gate";
import {
  endStream,
  initialStreamState,
  reduceStreamEvent,
  type ChatStreamState,
} from "@/lib/chat/stream-protocol";

export const IDLE_TIMEOUT_MS = 40_000;

export const RECONNECT_BACKOFF_MS = [
  1_000, 2_000, 4_000, 8_000, 15_000, 15_000,
];

export const RECONNECT_JITTER_MS = 500;
const DRAIN_JITTER_MS = 250;

/** `awaiting_approval` 도 여기입니다 — 승인 요청 뒤 server 가 구독을 닫아, 그 EOF 를 재연결 신호로 읽으면 안 됩니다. */
function isSettled(phase: ChatStreamState["phase"]) {
  return phase !== "streaming";
}

export function useChatStream({
  random = Math.random,
}: { random?: () => number } = {}) {
  const [state, setState] = useState<ChatStreamState>(initialStreamState);
  const stateRef = useRef(initialStreamState);
  const controllerRef = useRef<AbortController | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const userAbortRef = useRef(false);
  const wakeRef = useRef<(() => void) | null>(null);
  const runIdRef = useRef(0);

  const clearIdle = useCallback(() => {
    if (idleRef.current) clearTimeout(idleRef.current);
    idleRef.current = null;
  }, []);

  const apply = useCallback((next: ChatStreamState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const armIdle = useCallback(() => {
    clearIdle();
    idleRef.current = setTimeout(() => {
      controllerRef.current?.abort();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdle]);

  const stop = useCallback(() => {
    if (runningRef.current) {
      userAbortRef.current = true;
      controllerRef.current?.abort();
      wakeRef.current?.();
      return;
    }
    if (stateRef.current.phase === "awaiting_approval") {
      apply(endStream(stateRef.current, "cancelled"));
    }
  }, [apply]);

  const discard = useCallback(() => {
    runIdRef.current += 1;
    controllerRef.current?.abort();
    wakeRef.current?.();
    controllerRef.current = null;
    wakeRef.current = null;
    runningRef.current = false;
    clearIdle();
  }, [clearIdle]);

  const reset = useCallback(() => {
    discard();
    apply(initialStreamState);
  }, [apply, discard]);

  const sleep = useCallback((ms: number) => {
    return new Promise<"woken" | "elapsed">((resolve) => {
      const timer = setTimeout(() => {
        wakeRef.current = null;
        resolve("elapsed");
      }, ms);
      wakeRef.current = () => {
        clearTimeout(timer);
        wakeRef.current = null;
        resolve("woken");
      };
    });
  }, []);

  const open = useCallback(
    async (
      chatId: string,
      turnId: string,
      seed: ChatStreamState
    ): Promise<ChatStreamState | null> => {
      if (runningRef.current) return null;
      runningRef.current = true;
      userAbortRef.current = false;
      runIdRef.current += 1;
      const runId = runIdRef.current;
      const isCurrent = () => runIdRef.current === runId;

      apply(seed);

      let backoff = 0;

      try {
        while (true) {
          const controller = new AbortController();
          controllerRef.current = controller;
          let failure: unknown = null;
          const after = stateRef.current.cursor;
          armIdle();

          try {
            const source = getEventStream(
              getSubscribeAgentChatTurnEventsUrl(
                chatId,
                turnId,
                after === null ? undefined : { after }
              ),
              { signal: controller.signal }
            );

            for await (const event of source) {
              if (!isCurrent()) return null;
              const next = reduceStreamEvent(stateRef.current, event);
              apply(next);
              if (next.phase === "streaming") armIdle();
              else clearIdle();
            }
          } catch (error) {
            failure = error;
          } finally {
            clearIdle();
          }

          if (!isCurrent()) return null;

          if (userAbortRef.current) {
            apply(endStream(stateRef.current, "cancelled"));
            return stateRef.current;
          }

          if (isSettled(stateRef.current.phase)) return stateRef.current;

          if (errorCodeOf(failure) === "SSE_STREAM_GONE") {
            apply({ ...stateRef.current, needsResync: true });
            return stateRef.current;
          }

          if (isSessionExpired()) {
            apply({
              ...stateRef.current,
              phase: "failed",
              blocks: stateRef.current.blocks.filter(
                (block) => block.kind !== "text"
              ),
              error: {
                code: errorCodeOf(failure) ?? "STREAM_FAILED",
                message: errorMessageOf(failure, "") || null,
              },
            });
            return stateRef.current;
          }

          const progressed = stateRef.current.cursor !== after;
          if (progressed) backoff = 0;
          // 진행하다 끝 프레임 없이 깨끗하게 닫혔으면 server 의 배포 드레인입니다.
          const drained =
            progressed && failure === null && !controller.signal.aborted;

          const step = RECONNECT_BACKOFF_MS[backoff];
          if (step === undefined) {
            apply(endStream(stateRef.current, "gaveUp"));
            return stateRef.current;
          }

          const woke = await sleep(
            drained
              ? random() * DRAIN_JITTER_MS
              : step + random() * RECONNECT_JITTER_MS
          );
          if (!isCurrent()) return null;
          if (userAbortRef.current) {
            apply(endStream(stateRef.current, "cancelled"));
            return stateRef.current;
          }
          if (woke === "woken") backoff = 0;
          else if (!drained) backoff += 1;
        }
      } finally {
        if (isCurrent()) {
          controllerRef.current = null;
          wakeRef.current = null;
          runningRef.current = false;
        }
      }
    },
    [apply, armIdle, clearIdle, random, sleep]
  );

  const resume = useCallback(
    (chatId: string, seed: ChatStreamState) =>
      seed.turnId === null
        ? Promise.resolve<ChatStreamState | null>(null)
        : open(chatId, seed.turnId, seed),
    [open]
  );

  const revive = useCallback(
    (
      chatId: string,
      turnId: string,
      pendingApproval: ChatStreamState["pendingApproval"] = null
    ) => {
      const current = stateRef.current;
      if (
        current.turnId !== turnId ||
        current.phase !== "failed" ||
        current.error?.code !== "STREAM_INTERRUPTED"
      ) {
        return Promise.resolve<ChatStreamState | null>(null);
      }
      if (pendingApproval) {
        apply({
          ...current,
          phase: "awaiting_approval",
          pendingApproval,
          retryable: null,
          error: null,
        });
        return Promise.resolve(stateRef.current);
      }
      return open(chatId, turnId, {
        ...current,
        phase: "streaming",
        retryable: null,
        error: null,
      });
    },
    [apply, open]
  );

  const seed = useCallback((next: ChatStreamState) => apply(next), [apply]);

  useEffect(() => {
    const wake = () => wakeRef.current?.();
    const wakeIfVisible = () => {
      if (document.visibilityState === "visible") wake();
    };
    document.addEventListener("visibilitychange", wakeIfVisible);
    window.addEventListener("online", wake);
    return () => {
      document.removeEventListener("visibilitychange", wakeIfVisible);
      window.removeEventListener("online", wake);
    };
  }, []);

  useEffect(() => discard, [discard]);

  return { state, open, resume, revive, seed, stop, reset };
}
