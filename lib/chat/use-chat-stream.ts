"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { postEventStream } from "@/lib/api/sse";
import {
  endStream,
  initialStreamState,
  reduceStreamEvent,
  type ChatStreamState,
} from "@/lib/chat/stream-protocol";

/**
 * 아무 이벤트도 오지 않은 채 스트림이 열려 있어도 되는 시간.
 *
 * **승인 대기 구간에서는 이 타이머가 멈춘다.** 계약의 승인 대기 상한은 300초이고 그동안
 * 스트림에는 keepalive 주석만 흐른다 — 타이머를 그대로 두면 승인 카드가 정지 화면에 덮인다.
 */
export const IDLE_TIMEOUT_MS = 40_000;

/**
 * `postEventStream`을 리듀서에 물려 채팅 한 턴을 굴린다.
 *
 * 개인 챗봇·공유 챗봇이 같은 이벤트 계약을 쓰므로 이 훅은 URL과 body만 받는다.
 */
export function useChatStream() {
  const [state, setState] = useState<ChatStreamState>(initialStreamState);
  const stateRef = useRef(initialStreamState);
  const controllerRef = useRef<AbortController | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const userAbortRef = useRef(false);
  /** 지나간 스트림이 새로 시작된 대화의 상태를 덮어쓰지 않게 한다. */
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
      // 열려 있는데 아무것도 오지 않는다 — 종료 이벤트 없이 끊긴 경로와 같은 결말이다.
      apply(endStream(stateRef.current, "stalled"));
      controllerRef.current?.abort();
    }, IDLE_TIMEOUT_MS);
  }, [apply, clearIdle]);

  const stop = useCallback(() => {
    if (!runningRef.current) return;
    userAbortRef.current = true;
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    stop();
    clearIdle();
    apply(initialStreamState);
  }, [apply, clearIdle, stop]);

  /**
   * 한 턴을 끝까지 굴리고 **최종 상태를 돌려준다.** 호출부는 이걸로 종료 경로를 갈라야 한다 —
   * 훅이 돌려주는 `state`는 호출부 클로저에서 이전 렌더의 값이라 믿을 수 없다.
   * 지나간 스트림(새 대화로 갈아탄 경우)이면 null이다.
   */
  const send = useCallback(
    async (
      url: string,
      body: Record<string, unknown>
    ): Promise<ChatStreamState | null> => {
      // 한 번에 한 턴이다. 계약도 공유 챗봇에서 CHAT_LOCKED로 같은 규칙을 건다.
      if (runningRef.current) return null;
      runningRef.current = true;
      userAbortRef.current = false;
      runIdRef.current += 1;
      const runId = runIdRef.current;
      const isCurrent = () => runIdRef.current === runId;

      const controller = new AbortController();
      controllerRef.current = controller;
      apply({ ...initialStreamState, phase: "streaming" });
      armIdle();

      try {
        for await (const event of postEventStream(url, body, {
          signal: controller.signal,
        })) {
          if (!isCurrent()) return null;
          const next = reduceStreamEvent(stateRef.current, event);
          apply(next);
          // 흐르는 중일 때만 다시 건다. 승인 대기는 계약상 300초까지 조용하고,
          // `message_end`·`error` 뒤에는 전송이 닫히기까지 시간이 걸려도 이미 끝난 것이다 —
          // 거기서 타이머가 돌면 완료된 답변이 "중간에 끊겼습니다"로 덮인다.
          if (next.phase === "streaming") armIdle();
          else clearIdle();
        }
        clearIdle();
        if (!isCurrent()) return null;
        apply(
          endStream(stateRef.current, userAbortRef.current ? "aborted" : "closed")
        );
      } catch (error) {
        clearIdle();
        if (!isCurrent()) return null;
        // 이미 끝난 스트림은 덮지 않는다. `message_end`를 받은 뒤 전송이 깨끗이 닫히지
        // 않고 reject해도 답변은 이미 왔고 서버에도 남았다 — 여기서 failed로 바꾸면
        // 있는 답변을 숨기고 재전송을 권한다. 유휴 타이머가 끊은 stalled도 마찬가지다.
        const phase = stateRef.current.phase;
        const isSettled =
          phase === "idle" || phase === "failed" || phase === "stalled";
        if (isSettled) return stateRef.current;

        if (userAbortRef.current) {
          apply(endStream(stateRef.current, "aborted"));
        } else {
          // 스트림을 열지 못했거나 중간에 끊긴 것이다.
          apply({
            ...stateRef.current,
            phase: "failed",
            text: "",
            error: {
              code: errorCodeOf(error) ?? "STREAM_FAILED",
              message: errorMessageOf(error, "응답을 받지 못했습니다."),
            },
          });
        }
      } finally {
        if (isCurrent()) controllerRef.current = null;
        runningRef.current = false;
      }
      return stateRef.current;
    },
    [apply, armIdle, clearIdle]
  );

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (idleRef.current) clearTimeout(idleRef.current);
    },
    []
  );

  return { state, send, stop, reset };
}
