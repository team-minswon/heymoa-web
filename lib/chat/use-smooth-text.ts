"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 네트워크가 오는 속도와 **글자가 보이는 속도를 떼어 놓는다.**
 *
 * 토큰은 고르게 오지 않는다 — 모델이 한 번 멈췄다가 200자를 한꺼번에 뱉고, server 가
 * 프레임을 모아 보내고, 도구 왕복이 끼면 몇 초가 비었다가 문단 하나가 통째로 떨어진다.
 * 그대로 그리면 **덩어리로 툭툭** 나타난다 — 애니메이션을 아무리 예쁘게 걸어도 이 리듬은
 * 안 고쳐진다. 「스르륵 안 나온다」의 실제 원인이 여기다.
 *
 * 그래서 받은 것을 곧바로 안 그리고 **일정한 속도로 풀어 놓는다.** ChatGPT·Claude 도,
 * Vercel AI SDK 의 `smoothStream` 도 같은 일을 한다.
 *
 * ### 속도를 어떻게 정하나
 *
 * 고정 속도는 두 쪽에서 다 진다 — 느리면 답이 끝난 뒤에도 한참 흐르고, 빠르면 안 고르다.
 * **밀린 만큼에 비례해** 푼다: 남은 글자를 `DRAIN_MS` 안에 다 풀 속도로 매 프레임 낸다.
 * 그래서 많이 밀렸으면 빨라지고 조금 밀렸으면 느려지되, 리듬 자체는 프레임마다 이어진다.
 *
 * @param target 지금까지 받은 전문
 * @param active 아직 흐르는 중인가. 꺼지면 남은 것을 **그 자리에서** 다 보여 준다 —
 *   턴은 끝났는데 글자가 뒤늦게 기어가면 「끝났나?」가 애매해진다.
 */
export const DRAIN_MS = 260;

/** 프레임마다 최소 이만큼은 나간다. 안 그러면 한 글자 남았을 때 영영 안 끝난다. */
const MIN_CHARS_PER_FRAME = 1;

export function useSmoothText(target: string, active: boolean): string {
  /**
   * ★ **처음 붙는 글은 안 늦춘다.** 고르게 풀 것은 **자라는 것**이지 처음부터 거기
   * 있던 것이 아니다. 되이어받기(`GET /events?after=`)는 버퍼를 통째로 재생하므로 첫
   * 렌더에 문단이 통째로 들어오는데, 그것을 한 글자씩 흘리면 **따라잡기가 타이핑으로**
   * 보인다 — 이미 지난 일이다.
   */
  const [shown, setShown] = useState(target);
  /**
   * rAF 안에서 읽고 쓰는 값. **렌더 중에는 안 건드린다** — 프레임마다 state 를 읽으려면
   * 이펙트를 다시 걸어야 하는데, 그러면 매 프레임 rAF 를 새로 잡느라 리듬이 끊긴다.
   */
  const shownRef = useRef(target);

  /** 따라잡을 것이 아니라 맞출 때. 둘을 같이 옮겨야 다음 프레임이 안 어긋난다. */
  const settle = (next: string) => {
    shownRef.current = next;
    setShown(next);
  };

  useEffect(() => {
    // 끝났거나, 받은 것이 앞이 다른 글로 바뀌었다(확정 본문이 갈아 끼웠다·대화를 갈았다).
    // 둘 다 **따라잡을 것이 아니라 맞춰야** 하는 자리다.
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
