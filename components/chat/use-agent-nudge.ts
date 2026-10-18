import { useEffect, useRef, useState } from "react";

/**
 * 에이전트 버튼이 시선을 끄는 간격. 배열 길이가 곧 상한이다 — 처음엔 20초 뒤(안내 카드를 닫은 뒤에도 최소 20초), 그다음 30·60·120초로 벌어지고
 * 네 번 뒤엔 멈춘다. 「과하지 않게」가 목표라 무한히 반복하지 않는다.
 */
export const NUDGE_DELAYS_MS = [20_000, 30_000, 60_000, 120_000];
/** 파동 두 번의 길이(1.2초 × 2). CSS 와 맞춘다 */
export const NUDGE_SHOW_MS = 2_400;
/** 지금 방해될 때(입력 중·탭 숨김) 다시 살피는 간격. 횟수는 쓰지 않는다 */
export const NUDGE_RETRY_MS = 10_000;

function isTyping() {
  const el = document.activeElement;
  return (
    el instanceof HTMLElement &&
    (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
  );
}

/**
 * 약 30초마다 잠깐 `nudging`(버튼 둘레 파동)이 켜진다. `enabled` 가 꺼지면(채팅 열림·녹음 중·hover 등) 타이머를 걷고 켜진 것도
 * 끈다. 타이머는 `setTimeout` 체인 하나이고 마운트 뒤 클라이언트에서만 돈다. 방해되는 순간(탭이 숨겨졌거나
 * 입력란에 포커스)에는 횟수를 쓰지 않고 미룬다.
 */
export function useAgentNudge(enabled: boolean) {
  const [nudging, setNudging] = useState(false);
  const shown = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const delay = NUDGE_DELAYS_MS[shown.current];
      if (delay !== undefined) timer = setTimeout(fire, delay);
    };
    const fire = () => {
      if (document.hidden || isTyping()) {
        timer = setTimeout(fire, NUDGE_RETRY_MS);
        return;
      }
      shown.current += 1;
      setNudging(true);
      timer = setTimeout(() => {
        setNudging(false);
        schedule();
      }, NUDGE_SHOW_MS);
    };
    // 도는 중에 탭이 숨겨지면 접는다
    const onVisibility = () => {
      if (document.hidden) setNudging(false);
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      setNudging(false);
    };
  }, [enabled]);

  return nudging && enabled;
}
