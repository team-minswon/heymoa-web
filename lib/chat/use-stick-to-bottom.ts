"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { prefersReducedMotion } from "@/lib/utils";

// 스크롤 위치는 소수점이고 스트리밍 중 높이가 계속 바뀌어 정확히 0 을 기다리면 안 맞습니다.
const BOTTOM_THRESHOLD_PX = 48;

const REARM_THRESHOLD_PX = 8;

// smooth 스크롤 길이는 규격에 없어 잰 값이 아닙니다. 애니메이션 중간을 「추적을 껐다」로 오해하지 않는 창입니다.
export const SMOOTH_GUARD_MS = 700;

const UP_KEYS = new Set(["PageUp", "Home", "ArrowUp"]);

export function useStickToBottom(tail: string) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  const smoothOnceRef = useRef(false);
  const smoothUntilRef = useRef(0);
  const smoothTargetRef = useRef(0);
  const [atBottom, setAtBottom] = useState(true);

  const lastTopRef = useRef<number | null>(null);

  // 스크롤바 드래그는 wheel·터치·키 없이 비동기 `scroll` 만 냅니다. 그 사이 ResizeObserver 가 바닥으로 되돌리면
  // 뒤늦은 `scroll` 은 「올라갔다」를 못 보므로, 이벤트를 기다리지 않고 우리가 둔 이 자리와 비교합니다.
  const anchorRef = useRef<number | null>(null);

  const sync = useCallback((viewport: HTMLDivElement) => {
    const limit = stickRef.current ? BOTTOM_THRESHOLD_PX : REARM_THRESHOLD_PX;
    const stuck =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
      limit;
    stickRef.current = stuck;
    setAtBottom(stuck);
  }, []);

  const jumpToBottom = useCallback((viewport: HTMLDivElement) => {
    // 바닥값을 직접 씁니다. 브라우저는 scrollHeight 를 넣어도 잘라 주지만 jsdom 은 안 잘라서 검사에서만 어긋납니다.
    viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight;
    anchorRef.current = viewport.scrollTop;
  }, []);

  // 높이가 줄면 브라우저가 scrollTop 을 끌어내려 자리는 어긋나도 바닥에 붙어 있으므로, 바닥과의 거리도 함께 봅니다.
  const movedByUser = useCallback((viewport: HTMLDivElement) => {
    const ours = anchorRef.current;
    if (ours === null) return false;
    const away = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    return viewport.scrollTop < ours - REARM_THRESHOLD_PX && away > REARM_THRESHOLD_PX;
  }, []);

  const release = useCallback(() => {
    if (!stickRef.current) return;
    stickRef.current = false;
    smoothOnceRef.current = false;
    smoothUntilRef.current = 0;
    setAtBottom(false);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // scroll 은 버블링하지 않아 부모의 onScroll 로 걸 수 없습니다.
    const onScroll = () => {
      const top = viewport.scrollTop;
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

  useEffect(() => {
    const viewport = viewportRef.current;
    // jsdom 에는 ResizeObserver 가 없습니다.
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const follow = () => {
      const current = viewportRef.current;
      if (!current || !stickRef.current) return;
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
    if (stickRef.current && movedByUser(viewport)) release();
    if (!stickRef.current) {
      smoothOnceRef.current = false;
      sync(viewport);
      return;
    }

    // jsdom 에는 Element.scrollTo 가 없습니다.
    if (
      smoothOnceRef.current &&
      typeof viewport.scrollTo === "function" &&
      !prefersReducedMotion()
    ) {
      smoothOnceRef.current = false;
      smoothUntilRef.current = Date.now() + SMOOTH_GUARD_MS;
      smoothTargetRef.current = viewport.scrollHeight;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      window.setTimeout(() => {
        const current = viewportRef.current;
        if (current && stickRef.current) jumpToBottom(current);
      }, SMOOTH_GUARD_MS);
      return;
    }
    smoothOnceRef.current = false;
    if (Date.now() < smoothUntilRef.current) {
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

  const scrollToSent = useCallback(() => {
    stickRef.current = true;
    setAtBottom(true);
    smoothOnceRef.current = true;
    anchorRef.current = null;
  }, []);

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    stickRef.current = true;
    anchorRef.current = null;
    // jsdom 에는 scrollTo 가 없습니다.
    if (typeof viewport.scrollTo !== "function" || prefersReducedMotion()) {
      jumpToBottom(viewport);
      sync(viewport);
      return;
    }
    smoothUntilRef.current = Date.now() + SMOOTH_GUARD_MS;
    smoothTargetRef.current = viewport.scrollHeight;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    setAtBottom(true);
    // 미끄러짐이 아무 일도 안 하는 환경(헤드리스)이 있어 창이 닫히면 위치로 다시 확인합니다.
    window.setTimeout(() => {
      const current = viewportRef.current;
      if (current) sync(current);
    }, SMOOTH_GUARD_MS);
  }, [jumpToBottom, sync]);

  return { viewportRef, atBottom, scrollToBottom, scrollToSent };
}
