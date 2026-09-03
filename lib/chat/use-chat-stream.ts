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
 * 아무 이벤트도 오지 않은 채 스트림이 열려 있어도 되는 시간.
 *
 * **승인 대기에서는 이 타이머가 멈춘다.** 계약상 `tool_approval_request`가 스트림을
 * 끝내므로 대기 구간에는 열린 연결이 없다 — 타이머를 그대로 두면 승인 카드가 정지 화면에
 * 덮인다.
 *
 * 그 주석은 이제 `heartbeat` 이벤트로 올라온다. 그래서 이 타이머가 재는 것이 「모델이
 * 느린가」가 아니라 **「연결이 죽었나」**다 — 넘으면 끊고 다시 붙는다.
 */
export const IDLE_TIMEOUT_MS = 40_000;

/**
 * 재연결 간격. **근거가 있는 값이 아니다** — 상수로 두고 실측한 뒤에 고친다.
 * 여섯 번(합 45초) 시도하고 그래도 못 붙으면 포기한다.
 */
export const RECONNECT_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 15_000];

/**
 * 더 볼 것이 없는 상태. 여기 닿으면 재연결하지 않는다.
 *
 * **`awaiting_approval`이 여기 있다.** 승인 요청은 그 구간의 마지막 프레임이고 server가
 * 곧바로 구독을 닫는다 — 그 EOF를 재연결 신호로 읽으면 백오프 여섯 번(45초)을 돌다
 * **포기 표시가 되어 승인 카드가 무효화 카드에 덮인다.** 다음 프레임은 승인 API의
 * 응답으로 온다.
 */
function isSettled(phase: ChatStreamState["phase"]) {
  // 「흐르는 중」만 빠진다 — 계약이 스트림을 닫는 프레임 넷이 나머지 다섯을 다 만든다.
  return phase !== "streaming";
}

/**
 * `getEventStream`을 리듀서에 물려 채팅 한 턴을 굴린다.
 *
 * **끊긴다고 턴이 끝나는 것이 아니다.** 프레임은 턴 스트림에 남아 있으므로, 전송이
 * 닫혀도 턴은 계속 돌고 마지막 `id:` 를 `after` 에 넣어 같은 주소로 이어받을 수 있다.
 * 그래서 EOF는 성공도 실패도 아니고 **재연결 신호**다. `stalled`는 「재연결을 포기했다」에만
 * 쓴다. 예외는 `410` 하나 — 스트림이 사라진 것이라 히스토리를 다시 읽는다.
 */
export function useChatStream() {
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
      // 하트비트조차 안 온다 — 연결이 죽었다. **화면을 정지로 찍지 않고** 끊어서
      // 아래 루프가 다시 붙게 한다. 서버에서는 턴이 계속 돌고 있을 수 있다.
      controllerRef.current?.abort();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdle]);

  /**
   * 사용자가 멈췄다. **재연결 금지 플래그를 함께 세운다** — 안 세우면 끊은 답이
   * 재연결과 함께 다시 나타난다.
   *
   * **승인 대기는 안 도는데도 접는다.** 스트림이 `tool_approval_request`로 정상
   * 종료해 루프가 이미 빠져나와 있어서, 여기서 `runningRef`만 보고 돌아가면 「중지」가
   * 아무 일도 안 하고 `isBusy`가 영영 참이 된다 — 승인 만료가 없어진 지금 이것이
   * 승인 카드를 띄운 대화의 **유일한 탈출구**다.
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
   * ★ 이 스트림을 **버린다.** 대화를 갈아 끼울 때가 유일한 쓰임이다.
   *
   * `runningRef`를 여기서 바로 내린다. `abort()`는 전송이 실제로 풀릴 때까지 비동기라,
   * 그때까지 기다리면 **바로 뒤에 시작하는 턴이 조용히 삼켜진다** — `run()`이 「이미
   * 도는 중」으로 보고 null을 돌려주고, 호출부는 그것을 실패로도 안 읽는다. 대화를
   * 옮기자마자 보내는 것과, 옮긴 대화의 도는 턴을 이어받는 것이 정확히 그 경로다.
   *
   * 버린 루프가 나중에 풀려도 `runIdRef`가 이미 올라가 있어 상태를 못 덮는다.
   */
  const reset = useCallback(() => {
    runIdRef.current += 1;
    stop();
    runningRef.current = false;
    clearIdle();
    apply(initialStreamState);
  }, [apply, clearIdle, stop]);

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
   * 한 턴을 끝까지 굴리고 **최종 상태를 돌려준다.** 호출부는 이걸로 종료 경로를 갈라야 한다 —
   * 훅이 돌려주는 `state`는 호출부 클로저에서 이전 렌더의 값이라 믿을 수 없다.
   * 지나간 스트림(새 대화로 갈아탄 경우)이면 null이다.
   *
   * 첫 연결도 재접속도 `GET …/turns/{turnId}/events` 하나다. `seed` 가 시작 자리를
   * 담는다 — 새 턴이면 `startedState`, 재진입이면 `resumedState`, 승인 뒤면 지금 상태.
   * `after` 는 `seed.cursor` 부터 이어 본 마지막 `id:` 이고 null 이면 빼서 처음부터 받는다.
   *
   * **POST 는 여기 없다.** 턴을 여는 것은 컴포넌트의 생성 훅이고, 그 실패는 mutation
   * 실패로 처리된다 — 못 열린 POST 는 재연결 대상이 아니다.
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

      /**
       * 다음에 얼마나 기다리나. **연결 횟수가 아니라 시간표의 자리다** — 탭이 돌아오면
       * 0으로 되감는다.
       */
      let backoff = 0;

      try {
        while (true) {
          const controller = new AbortController();
          controllerRef.current = controller;
          let failure: unknown = null;
          armIdle();

          try {
            const after = stateRef.current.cursor;
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
              // 흐르는 중일 때만 다시 건다. 승인 대기에는 열린 연결이 없고,
              // `message_end`·`error` 뒤에는 전송이 닫히기까지 시간이 걸려도 이미 끝난
              // 것이다 — 거기서 타이머가 돌면 완료된 답변이 "중간에 끊겼습니다"로 덮인다.
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

          // 이미 끝난 스트림은 덮지 않는다. `message_end`를 받은 뒤 전송이 깨끗이 닫히지
          // 않고 reject해도 답변은 이미 왔고 서버에도 남았다.
          if (isSettled(stateRef.current.phase)) return stateRef.current;

          // **410 — 턴은 끝났고 스트림은 사라졌다.** 다시 붙어도 같은 답이다. 상태는
          // 그대로 두고 `needsResync` 만 세운다 — 컴포넌트의 resync 효과가 히스토리를
          // 다시 읽어 그 사이 굳은 답을 세운다.
          if (errorCodeOf(failure) === "SSE_STREAM_GONE") {
            apply({ ...stateRef.current, needsResync: true });
            return stateRef.current;
          }

          // 세션 만료는 재시도가 게이트를 계속 두드릴 뿐이다.
          if (isSessionExpired()) {
            apply({
              ...stateRef.current,
              phase: "failed",
              // 생각·도구 블록은 남긴다 — 무엇을 하다 끊겼는지가 사유의 절반이다.
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

          // 여기부터가 **EOF ≠ 성공**이다. 턴은 서버에서 살아 있을 수 있으므로 다시 붙는다.
          const delay = RECONNECT_BACKOFF_MS[backoff];
          if (delay === undefined) {
            // 시간표를 다 썼다. **새 상태를 안 만든다** — 기존 오류 배너에 접는다.
            apply(endStream(stateRef.current, "gaveUp"));
            return stateRef.current;
          }

          const woke = await sleep(delay);
          if (!isCurrent()) return null;
          if (userAbortRef.current) {
            apply(endStream(stateRef.current, "cancelled"));
            return stateRef.current;
          }
          // 탭이 돌아왔거나 네트워크가 붙었다 — 기다리던 시간표를 처음부터 다시 센다.
          backoff = woke === "woken" ? 0 : backoff + 1;
        }
      } finally {
        // **버려진 루프는 공용 손잡이를 안 건드린다.** 늦게 풀린 옛 루프가 그 사이
        // 시작된 턴의 컨트롤러·깨우기·「도는 중」을 지우면, 새 턴이 중지도 재연결도
        // 안 되는 채로 남는다.
        if (isCurrent()) {
          controllerRef.current = null;
          wakeRef.current = null;
          runningRef.current = false;
        }
      }
    },
    [apply, armIdle, clearIdle, sleep]
  );

  /**
   * 돌아왔더니 턴이 아직 돈다 — `GET /messages`가 준 자리(`resumedState`)에서 이어받는다.
   * `seed.cursor` 가 null 이면 처음부터다.
   */
  const resume = useCallback(
    (chatId: string, seed: ChatStreamState) =>
      seed.turnId === null
        ? Promise.resolve<ChatStreamState | null>(null)
        : open(chatId, seed.turnId, seed),
    [open]
  );

  /**
   * 연결 없이 상태만 세운다. 마지막 턴이 실패로 끝나 있던 재진입이 유일한 쓰임이다 —
   * 이을 스트림이 없고 배너만 있으면 된다.
   */
  const seed = useCallback((next: ChatStreamState) => apply(next), [apply]);

  /**
   * 탭이 돌아오거나 네트워크가 붙으면 백오프를 안 기다린다.
   *
   * 배경 탭에서는 브라우저가 타이머를 1초 이상으로 늦추고 소켓도 정리하므로, 돌아온 순간이
   * 다시 붙기 가장 좋은 때다. 자고 있지 않으면 아무 일도 일어나지 않는다.
   */
  useEffect(() => {
    const wake = () => wakeRef.current?.();
    // 탭이 **보이게 됐을 때만**이다. 숨겨질 때 깨우면 배경에서 재연결이 돈다.
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

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (idleRef.current) clearTimeout(idleRef.current);
    },
    []
  );

  return { state, open, resume, seed, stop, reset };
}
