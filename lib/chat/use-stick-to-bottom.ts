"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { prefersReducedMotion } from "@/lib/utils";

/**
 * 바닥에서 이만큼 안쪽이면 바닥으로 본다. 스크롤 위치는 소수점이고 스트리밍 중 높이가 계속
 * 바뀌어 정확히 0을 기다리면 안 맞는다.
 */
const BOTTOM_THRESHOLD_PX = 48;

/**
 * 떠난 뒤 다시 붙는 폭. 붙어 있을 때보다 좁다 — 한 값이면 흐르는 동안 30px 만 올려도 48px
 * 안쪽이라 다음 토큰에 도로 감긴다. 떠난 뒤에는 끝까지 내려야 다시 붙는다.
 */
const REARM_THRESHOLD_PX = 8;

/**
 * 부드럽게 옮기는 동안 스크롤 이벤트를 안 읽는 시간. smooth 스크롤 길이는 규격에 없어 잰
 * 값이 아니다 — 애니메이션 도중을 「추적을 껐다」로 오해하지 않는 창의 길이일 뿐이다.
 */
export const SMOOTH_GUARD_MS = 700;

/** 위로 가는 키. 손짓과 같은 자리에서 추적을 끊는다. */
const UP_KEYS = new Set(["PageUp", "Home", "ArrowUp"]);

/**
 * 새 내용이 쌓이면 바닥 근처일 때만 따라간다. 위를 읽고 있으면 끌어내리지 않는다.
 *
 * 자동 따라가기는 즉시 옮긴다. 토큰마다 부드럽게 옮기면 애니메이션끼리 덮어써서 끊긴다.
 * 보내는 순간(`scrollToSent`)과 「맨 아래로」만 부드럽게 옮긴다.
 *
 * @param tail 내용이 자랐는지 알리는 키. 바뀔 때마다 따라갈지 판단한다.
 */
export function useStickToBottom(tail: string) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  // 리스너가 등록 시점의 state 를 붙잡으므로 최신 값은 ref 로 읽는다.
  const stickRef = useRef(true);
  /** 다음 `tail` 변화 한 번만 부드럽게 옮긴다. */
  const smoothOnceRef = useRef(false);
  /** 이 시각까지는 스크롤 이벤트를 안 읽는다. 애니메이션 중간 프레임이다. */
  const smoothUntilRef = useRef(0);
  /** 지금 미끄러져 가는 목표. 자라면 다시 겨눈다. */
  const smoothTargetRef = useRef(0);
  const [atBottom, setAtBottom] = useState(true);

  /**
   * 마지막으로 본 스크롤 자리. `scroll` 이벤트에서만 적는다 — 넘겨 쓴 값은 잘리므로 브라우저가
   * 확정한 값이어야 「위로 갔나」가 맞다. null 이면 아무 판정도 안 한다.
   */
  const lastTopRef = useRef<number | null>(null);

  /**
   * 우리가 마지막으로 둔 자리. `jumpToBottom` 에서만, 옮긴 뒤 읽어서 적는다.
   *
   * 스크롤바 드래그는 `wheel`·터치·키 없이 비동기 `scroll` 만 낸다. 그 사이 답이 자라
   * `ResizeObserver` 가 먼저 돌면 바닥으로 되돌려, 뒤늦은 `scroll` 은 「올라갔다」를 못 본다.
   * 그래서 이벤트를 기다리지 않고 이 자리와 비교한다(`use-stick-to-bottom` 라이브러리의
   * `ignoreScrollToTop` 과 같은 생각).
   */
  const anchorRef = useRef<number | null>(null);

  const sync = useCallback((viewport: HTMLDivElement) => {
    // 붙어 있을 때와 떠나 있을 때 폭이 다르다.
    const limit = stickRef.current ? BOTTOM_THRESHOLD_PX : REARM_THRESHOLD_PX;
    const stuck =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
      limit;
    stickRef.current = stuck;
    setAtBottom(stuck);
  }, []);

  /**
   * 바닥으로 옮긴다. `lastTopRef` 는 안 건드리고 `anchorRef` 에 옮긴 뒤 다시 읽은 값을 적는다 —
   * 넘겨 쓴 값은 잘려서 그대로 기억하면 비교가 늘 어긋난다.
   */
  const jumpToBottom = useCallback((viewport: HTMLDivElement) => {
    // 바닥값을 직접 쓴다. 브라우저는 `scrollHeight` 를 넣어도 여기로 자르지만 jsdom 은 안 잘라서
    // 검사에서만 「사람이 옮겼다」로 읽힌다.
    viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight;
    anchorRef.current = viewport.scrollTop;
  }, []);

  /**
   * 내가 둔 자리에서 벗어나 있으면 사람이 옮긴 것이다. 이유는 `anchorRef`.
   *
   * 둘 다 맞아야 참이다. 높이가 줄면(자리가 개키거나 「생각하는 중」이 사라질 때) 브라우저가
   * `scrollTop` 을 끌어내려 자리는 어긋나도 바닥에는 붙어 있다. 사람이 올렸으면 바닥과의
   * 거리도 벌어진다.
   */
  const movedByUser = useCallback((viewport: HTMLDivElement) => {
    const ours = anchorRef.current;
    if (ours === null) return false;
    const away = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    return viewport.scrollTop < ours - REARM_THRESHOLD_PX && away > REARM_THRESHOLD_PX;
  }, []);

  /**
   * 손이 닿는 순간 추적을 끊는다. `scroll` 은 비동기라 토큰마다 바닥으로 되돌리는 이펙트가
   * 큐에 남은 `scroll` 보다 먼저 돌아, 핸들러는 늘 「바닥」만 읽는다. 입력 핸들러는 토큰
   * 이펙트보다 먼저 돌므로 경합이 없다. 내려가는 손짓은 안 끊는다.
   */
  const release = useCallback(() => {
    if (!stickRef.current) return;
    stickRef.current = false;
    smoothOnceRef.current = false;
    // 부드러운 이동 중이어도 손이 이긴다. 창을 닫아야 뒤따르는 `scroll` 이 읽힌다.
    smoothUntilRef.current = 0;
    setAtBottom(false);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // scroll 은 버블링하지 않아 부모의 onScroll 로 못 건다. 부드럽게 옮기는 동안에는 안 읽는다 —
    // 중간 프레임은 바닥이 아니라서 방금 켠 추적을 스스로 끈다.
    const onScroll = () => {
      const top = viewport.scrollTop;
      // 스크롤바 드래그는 `scroll` 만 낸다. 우리는 늘 바닥 쪽으로만 옮기므로 위로 간 것은
      // 사람이 한 것이다.
      const previous = lastTopRef.current;
      lastTopRef.current = top;
      if (previous !== null && top < previous - 1) release();
      if (Date.now() < smoothUntilRef.current) return;
      sync(viewport);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) release();
    };
    let touchStartY = 0;
    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      // 손가락이 아래로 = 내용이 위로 = 옛 대화를 보러 간다.
      if ((event.touches[0]?.clientY ?? 0) > touchStartY) release();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (UP_KEYS.has(event.key)) release();
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    viewport.addEventListener("wheel", onWheel, { passive: true });
    viewport.addEventListener("touchstart", onTouchStart, { passive: true });
    viewport.addEventListener("touchmove", onTouchMove, { passive: true });
    viewport.addEventListener("keydown", onKeyDown);
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("keydown", onKeyDown);
    };
  }, [release, sync]);

  /**
   * 높이 변화를 직접 본다. `tail` 은 React 가 다시 그릴 때만 바뀌는데 높이는 접이식이 열릴 때,
   * 표·코드 블록이 다시 흐를 때, 폰트가 늦게 올 때도 자란다. 뷰포트(컴포저가 자라거나 접힐
   * 때)와 내용을 둘 다 본다. 스크롤 자리를 쓰는 것은 크기를 안 바꾸므로 되먹임이 없다.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    // jsdom 에는 `ResizeObserver` 가 없다.
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const follow = () => {
      const current = viewportRef.current;
      if (!current || !stickRef.current) return;
      // 미끄러지는 중이면 그쪽이 목표를 든다. 여기서 또 옮기면 둘이 다툰다.
      if (Date.now() < smoothUntilRef.current) return;
      if (movedByUser(current)) {
        release();
        return;
      }
      jumpToBottom(current);
    };
    const observer = new ResizeObserver(follow);
    observer.observe(viewport);
    const content = viewport.firstElementChild;
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [jumpToBottom, movedByUser, release]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // 토큰마다 도는 이쪽이 더 자주 되돌리므로 `ResizeObserver` 와 같은 판정이 여기도 있어야 한다.
    if (stickRef.current && movedByUser(viewport)) release();
    if (!stickRef.current) {
      // 따라가지 않아도 상태는 갱신한다. 내용이 자라면 바닥에서 멀어져 버튼이 떠야 한다.
      smoothOnceRef.current = false;
      sync(viewport);
      return;
    }

    // 보내는 순간의 이동·자동 따라가기·사용자의 손이 같은 스크롤을 다툰다. 순서는
    // 1) 사용자가 떠나 있으면 아무도 안 옮긴다(위 갈래) 2) 보내는 순간의 이동이 창 동안 이긴다
    // 3) 그 뒤로 자동 따라가기. 2가 잃는 것이 없는 것은 질문 아래 자리(`pinSlackPx`)가 답이
    // 자라는 만큼 줄어 `scrollHeight` 가 그대로이기 때문이다.
    // jsdom 에는 `Element.scrollTo` 가 없다.
    if (
      smoothOnceRef.current &&
      typeof viewport.scrollTo === "function" &&
      !prefersReducedMotion()
    ) {
      smoothOnceRef.current = false;
      smoothUntilRef.current = Date.now() + SMOOTH_GUARD_MS;
      smoothTargetRef.current = viewport.scrollHeight;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      // 창이 닫힐 때 위치로 「사용자가 가로챘나」를 추측하지 않는다. 창 길이는 잰 값이 아니라
      // 긴 스레드에서는 아직 도착 전이라 추적을 잘못 끈다. 가로챘다면 `release()` 가 이미
      // 동기로 껐으므로, 추적이 켜져 있으면 가던 자리로 마무리한다.
      window.setTimeout(() => {
        const current = viewportRef.current;
        if (current && stickRef.current) jumpToBottom(current);
      }, SMOOTH_GUARD_MS);
      return;
    }
    smoothOnceRef.current = false;
    if (Date.now() < smoothUntilRef.current) {
      // 미끄러지는 동안 바닥이 자라면 다시 겨눈다. 목표를 굳혀 두면 창이 닫히는 순간 남은
      // 거리를 한 프레임에 뛴다. 자랐을 때만 다시 건다 — 매 토큰 걸면 애니메이션이 계속
      // 처음부터 다시 시작한다.
      if (
        viewport.scrollHeight > smoothTargetRef.current + 1 &&
        typeof viewport.scrollTo === "function" &&
        !prefersReducedMotion()
      ) {
        smoothTargetRef.current = viewport.scrollHeight;
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      }
      return;
    }
    jumpToBottom(viewport);
  }, [jumpToBottom, movedByUser, release, tail, sync]);

  /**
   * 방금 보낸 질문으로 옮긴다. 위를 읽고 있었어도 돈다 — 보내기는 지금 한 행동이라 그 결과를
   * 보여 줘야 하고, 추적을 여기서 다시 켜야 답이 화면 밖에서 흐르지 않는다.
   * `prefers-reduced-motion` 이면 애니메이션 없이 즉시 옮긴다.
   */
  const scrollToSent = useCallback(() => {
    stickRef.current = true;
    setAtBottom(true);
    smoothOnceRef.current = true;
    // 자리에 대한 주장을 버린다. 안 버리면 `movedByUser` 가 옛 자리를 읽고 방금 켠 추적을 끈다.
    anchorRef.current = null;
  }, []);

  /** 「맨 아래로」를 눌렀다. 한 프레임에 뛰면 어디로 갔는지 안 보여 미끄러져 내려간다. */
  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // 먼저 붙였다고 쳐 둔다. 사람이 돌아온 것이라 좁은 `REARM_THRESHOLD_PX` 가 아니라 원래
    // 폭으로 재야 흐르는 중에 눌러도 붙는다.
    stickRef.current = true;
    // `scrollToSent` 와 같은 이유로 자리 주장을 버린다.
    anchorRef.current = null;
    // jsdom 에는 `scrollTo` 가 없고, 움직임을 줄여 달라고 한 사람에게는 안 미끄러진다.
    if (typeof viewport.scrollTo !== "function" || prefersReducedMotion()) {
      jumpToBottom(viewport);
      // 옮긴 뒤에 상태를 맞춘다. 먼저 true 로 두면 이동이 실패했을 때 버튼만 사라진다.
      sync(viewport);
      return;
    }
    smoothUntilRef.current = Date.now() + SMOOTH_GUARD_MS;
    smoothTargetRef.current = viewport.scrollHeight;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    // 중간 프레임은 바닥이 아니라서 위치로 재면 버튼이 끝까지 서 있다가 툭 사라진다. 미리 감춘다.
    setAtBottom(true);
    // 그래도 창이 닫히면 위치로 확인한다. 미끄러짐이 아무 일도 안 하는 환경(헤드리스)이 있다.
    window.setTimeout(() => {
      const current = viewportRef.current;
      if (current) sync(current);
    }, SMOOTH_GUARD_MS);
  }, [jumpToBottom, sync]);

  return { viewportRef, atBottom, scrollToBottom, scrollToSent };
}
