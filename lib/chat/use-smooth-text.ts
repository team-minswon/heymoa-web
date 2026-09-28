"use client";

import { useEffect, useRef, useState } from "react";

/** 밀린 글자를 이 시간 안에 다 풀 속도로 매 프레임 낸다. 많이 밀리면 빨라지고 적으면 느려진다. */
export const DRAIN_MS = 260;

/** 한 글자 남았을 때도 끝나도록 프레임마다 최소 이만큼은 낸다. */
const MIN_CHARS_PER_FRAME = 1;

/**
 * 네트워크가 오는 속도와 글자가 보이는 속도를 떼어 놓는다. 토큰은 덩어리로 오므로 받은
 * 것을 곧바로 그리지 않고 고른 속도로 푼다.
 *
 * @param target 지금까지 받은 전문
 * @param active 아직 흐르는 중인가. 꺼지면 남은 것을 그 자리에서 다 보여 준다.
 */
export function useSmoothText(target: string, active: boolean): string {
  // 처음 붙는 글은 안 늦춘다. 재생(`?after=`)이 첫 렌더에 문단을 통째로 넣는데 그걸 흘리면
  // 따라잡기가 타이핑으로 보인다.
  const [shown, setShown] = useState(target);
  // rAF 안에서만 읽고 쓴다. state 로 읽으려면 매 프레임 이펙트를 다시 걸어 리듬이 끊긴다.
  const shownRef = useRef(target);

  // ref 와 state 를 같이 옮겨야 다음 프레임이 안 어긋난다.
  const settle = (next: string) => {
    shownRef.current = next;
    setShown(next);
  };

  useEffect(() => {
    // 끝났거나 앞이 다른 글로 바뀌었다(확정 본문이 갈아 끼웠다·대화를 갈았다). 따라잡지 않고
    // 맞춘다.
    if (!active || !target.startsWith(shownRef.current)) {
      if (shownRef.current !== target) settle(target);
      return;
    }
    if (shownRef.current.length >= target.length) return;

    let raf = 0;
    let previous = 0;
    const step = (now: number) => {
      const elapsed = previous === 0 ? 16 : now - previous;
      previous = now;
      const current = shownRef.current;
      const behind = target.length - current.length;
      if (behind <= 0) return;
      const chars = Math.max(
        MIN_CHARS_PER_FRAME,
        Math.ceil((behind * elapsed) / DRAIN_MS)
      );
      const next = target.slice(0, current.length + chars);
      settle(next);
      if (next.length < target.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);

  return shown;
}
