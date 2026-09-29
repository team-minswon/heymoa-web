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

/**
 * 아무 이벤트 없이 스트림이 열려 있어도 되는 시간. 서버가 `heartbeat` 를 보내므로 이것은
 * 「모델이 느린가」가 아니라 「연결이 죽었나」를 잰다 — 넘으면 끊고 다시 붙는다.
 * 승인 대기에는 열린 연결이 없어 타이머가 멈춘다.
 */
export const IDLE_TIMEOUT_MS = 40_000;

/** 재연결 간격. 근거 있는 값이 아니라 실측 뒤 고칠 자리다. 커서가 안 움직인 연결이 여섯 번(합 45초) 이어지면 포기한다. */
export const RECONNECT_BACKOFF_MS = [
  1_000, 2_000, 4_000, 8_000, 15_000, 15_000,
];

/** 시간표 칸에 더하는 지터 상한. 배포 드레인이 끊은 연결들이 같은 순간 다시 붙지 않게 흩는다. */
export const RECONNECT_JITTER_MS = 500;
/** 진행한 연결이 끝 프레임 없이 깨끗하게 닫혔을 때(배포 드레인)의 지터 상한. 시간표를 안 탄다. */
export const DRAIN_JITTER_MS = 250;

/**
 * 더 볼 것이 없는 상태. 여기 닿으면 재연결하지 않는다. `awaiting_approval` 도 여기다 — 승인
 * 요청 뒤 server 가 구독을 닫는데, 그 EOF 를 재연결 신호로 읽으면 45초 뒤 포기 표시가
 * 승인 카드를 덮는다. 다음 프레임은 승인 API 응답 뒤에 온다.
 */
function isSettled(phase: ChatStreamState["phase"]) {
  // 스트림을 닫는 프레임들이 `streaming` 을 뺀 나머지를 만든다.
  return phase !== "streaming";
}

/**
 * `getEventStream` 을 리듀서에 물려 채팅 한 턴을 굴린다. 끊겨도 턴은 서버에서 계속 돌고
 * 마지막 `id:` 를 `after` 에 넣어 이어받을 수 있으므로, EOF 는 성공도 실패도 아니고 재연결
 * 신호다. 예외는 `410` 하나 — 스트림이 사라져 히스토리를 다시 읽는다.
 */
export function useChatStream({
  random = Math.random,
}: { random?: () => number } = {}) {
  const [state, setState] = useState<ChatStreamState>(initialStreamState);
  const stateRef = useRef(initialStreamState);
  const controllerRef = useRef<AbortController | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const userAbortRef = useRef(false);
  /** 백오프를 자고 있는 중이면 깨우는 손잡이. 탭 복귀·온라인 복귀가 당긴다. */
  const wakeRef = useRef<(() => void) | null>(null);
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
      // 하트비트조차 안 온다. 화면을 정지로 찍지 않고 끊어서 아래 루프가 다시 붙게 한다.
      controllerRef.current?.abort();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdle]);

  /**
   * 사용자가 멈췄다. 재연결 금지 플래그를 같이 세운다 — 안 세우면 끊은 답이 재연결과 함께
   * 돌아온다.
   *
   * 승인 대기는 루프가 이미 빠져나와 있어도 접는다. 승인 만료가 없어서 이것이 승인 카드를
   * 띄운 대화의 유일한 탈출구다.
   */
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

  /**
   * 도는 루프를 버린다. `runIdRef` 를 먼저 올려 버려진 루프가 EOF 에서 풀리든 백오프에서
   * 깨든 `isCurrent()` 에서 빠지게 한다. `abort()` 만 하면 루프가 그 EOF 를 재연결 신호로 읽고
   * provider 가 내려간 뒤에도 45초 동안 다시 붙는다.
   */
  const discard = useCallback(() => {
    runIdRef.current += 1;
    controllerRef.current?.abort();
    wakeRef.current?.();
    controllerRef.current = null;
    wakeRef.current = null;
    runningRef.current = false;
    clearIdle();
  }, [clearIdle]);

  /**
   * 이 스트림을 버린다. 대화를 갈아 끼우거나 다음 턴을 시작할 때 쓴다.
   *
   * `runningRef` 를 여기서 바로 내린다. `abort()` 는 비동기라 기다리면 바로 뒤에 시작하는
   * 턴을 `open()` 이 「이미 도는 중」으로 보고 null 을 돌려 조용히 삼킨다.
   */
  const reset = useCallback(() => {
    discard();
    apply(initialStreamState);
  }, [apply, discard]);

  /** 백오프. 탭 복귀·온라인 복귀가 깨우면 남은 시간을 안 기다린다. */
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

  /**
   * 한 턴을 끝까지 굴리고 최종 상태를 돌려준다. 훅의 `state` 는 호출부 클로저에서 이전
   * 렌더의 값이라 종료 경로는 이 반환값으로 가른다. 버려진 스트림이면 null 이다.
   *
   * 첫 연결도 재접속도 `GET …/turns/{turnId}/events` 하나다. `seed` 는 새 턴이면
   * `startedState`, 재진입이면 `resumedState`, 승인 뒤면 지금 상태다. POST 는 여기 없다 —
   * 못 열린 POST 는 mutation 실패이지 재연결 대상이 아니다.
   */
  const open = useCallback(
    async (
      chatId: string,
      turnId: string,
      seed: ChatStreamState
    ): Promise<ChatStreamState | null> => {
      // 한 번에 한 턴이다. 계약도 같은 규칙을 건다.
      if (runningRef.current) return null;
      runningRef.current = true;
      userAbortRef.current = false;
      runIdRef.current += 1;
      const runId = runIdRef.current;
      const isCurrent = () => runIdRef.current === runId;

      apply(seed);

      // 연결 횟수가 아니라 시간표의 자리다. 커서가 움직인 연결·탭 복귀가 0으로 되감는다.
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
              // 흐르는 중일 때만 다시 건다. `message_end` 뒤 전송이 늦게 닫힐 때 타이머가 돌면
              // 끝난 답이 「중간에 끊겼습니다」로 덮인다.
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

          // 이미 끝난 스트림은 덮지 않는다. `message_end` 뒤 전송이 reject 해도 답은 왔다.
          if (isSettled(stateRef.current.phase)) return stateRef.current;

          // 410: 턴은 끝났고 스트림은 사라졌다. `needsResync` 만 세우면 컴포넌트가 히스토리를
          // 다시 읽는다.
          if (errorCodeOf(failure) === "SSE_STREAM_GONE") {
            apply({ ...stateRef.current, needsResync: true });
            return stateRef.current;
          }

          // 세션 만료는 재시도가 게이트를 계속 두드릴 뿐이다.
          if (isSessionExpired()) {
            apply({
              ...stateRef.current,
              phase: "failed",
              // 생각·도구 블록은 남긴다. 무엇을 하다 끊겼는지가 사유의 절반이다.
              blocks: stateRef.current.blocks.filter(
                (block) => block.kind !== "text"
              ),
              error: {
                code: errorCodeOf(failure) ?? "STREAM_FAILED",
                message: errorMessageOf(failure, "응답을 받지 못했습니다."),
              },
            });
            return stateRef.current;
          }

          // 커서가 움직였으면 턴이 살아 있다는 증거라 시간표를 되감는다. 하트비트는 id 가 없어 못
          // 되감는다 — 하트비트 뒤 끊기는 장애에서 1초 재시도가 끝없이 돌지 않게.
          const progressed = stateRef.current.cursor !== after;
          if (progressed) backoff = 0;
          // 진행하다 끝 프레임 없이 깨끗하게 닫혔다 = server 의 배포 드레인. 곧바로 새 태스크로
          // 붙는다. 받자마자 닫는 경우(Redis 실패·끝난 턴)는 커서가 안 움직여 시간표로 간다.
          const drained =
            progressed && failure === null && !controller.signal.aborted;

          // 턴은 서버에서 살아 있을 수 있으므로 다시 붙는다.
          const step = RECONNECT_BACKOFF_MS[backoff];
          if (step === undefined) {
            // 진행 없이 시간표를 다 썼다. 기존 오류 배너에 접는다.
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
          // 탭이 돌아왔거나 네트워크가 붙었으면 시간표를 처음부터 센다.
          if (woke === "woken") backoff = 0;
          else if (!drained) backoff += 1;
        }
      } finally {
        // 버려진 루프는 공용 손잡이를 안 건드린다. 늦게 풀린 옛 루프가 새 턴의 컨트롤러·
        // 깨우기·「도는 중」을 지우면 새 턴이 중지도 재연결도 안 된다.
        if (isCurrent()) {
          controllerRef.current = null;
          wakeRef.current = null;
          runningRef.current = false;
        }
      }
    },
    [apply, armIdle, clearIdle, random, sleep]
  );

  /** 돌아왔더니 턴이 아직 돈다. `resumedState` 에서 이어받는다. */
  const resume = useCallback(
    (chatId: string, seed: ChatStreamState) =>
      seed.turnId === null
        ? Promise.resolve<ChatStreamState | null>(null)
        : open(chatId, seed.turnId, seed),
    [open]
  );

  /**
   * 포기한 턴을 server 가 아직 돈다고 하면 지금 커서부터 다시 붙는다(N3). 승인을 기다리고 있으면
   * 스트림이 닫혀 있으므로 연결 없이 승인 대기로 옮긴다. 재조회를 기다리는 사이 대화를 갈아
   * 끼웠거나 다른 턴이 섰으면 아무것도 안 한다.
   */
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

  /** 연결 없이 상태만 세운다. 마지막 턴이 실패로 끝나 있던 재진입이 쓴다. */
  const seed = useCallback((next: ChatStreamState) => apply(next), [apply]);

  /**
   * 탭이 돌아오거나 네트워크가 붙으면 백오프를 안 기다린다. 배경 탭은 타이머를 늦추고
   * 소켓을 정리하므로 돌아온 순간이 다시 붙기 가장 좋다.
   */
  useEffect(() => {
    const wake = () => wakeRef.current?.();
    // 보이게 됐을 때만 깨운다. 숨겨질 때 깨우면 배경에서 재연결이 돈다.
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

  // 언마운트하면 루프를 버린다.
  useEffect(() => discard, [discard]);

  return { state, open, resume, revive, seed, stop, reset };
}
