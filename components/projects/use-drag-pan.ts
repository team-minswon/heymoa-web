"use client";

import { useEffect, type RefObject } from "react";

import {
  glideDone,
  glideStep,
  panGesture,
  releaseVelocity,
  type PanAxis,
  type PanSample,
} from "@/lib/projects/drag-pan";
import { reducedMotion } from "@/components/projects/agenda-ribbon-motion";

const NO_PAN = "input, textarea, select, [data-no-pan]";
const SAMPLES = 8;

function scrollParentOf(from: HTMLElement | null): HTMLElement | null {
  for (let element: HTMLElement | null = from; element; element = element.parentElement) {
    const overflow = getComputedStyle(element).overflowY;
    if (overflow === "auto" || overflow === "scroll") return element;
  }
  return null;
}

export function useDragPan(
  ref: RefObject<HTMLElement | null>,
  { onStart, onEnd, skip }: { onStart?: () => void; onEnd?: () => void;  skip?: string } = {}
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const pan = panGesture();
    let pointerId = -1;
    let vertical: HTMLElement | null = null;
    let swallow = false;
    let cursor: HTMLDivElement | null = null;
    let samples: PanSample[] = [];
    let glideFrame = 0;

    const axes = () => ({ x: element.scrollWidth > element.clientWidth + 1, y: vertical !== null });
    const refresh = () => {
      const parent = element.scrollHeight > element.clientHeight + 1 ? element : scrollParentOf(element.parentElement);
      vertical = parent && parent.scrollHeight > parent.clientHeight + 1 ? parent : null;
      const movable = axes();
      const want = movable.x || movable.y ? "grab" : "default";
      if (element.style.cursor !== want) element.style.cursor = want;
    };
    refresh();
    const resize = new ResizeObserver(refresh);
    resize.observe(element);
    const watched = scrollParentOf(element.parentElement);
    if (watched) {
      resize.observe(watched);
      if (watched.firstElementChild) resize.observe(watched.firstElementChild);
    }

    const stopGlide = () => {
      if (glideFrame) cancelAnimationFrame(glideFrame);
      glideFrame = 0;
    };
    const glide = (axis: PanAxis, pointer: { vx: number; vy: number }) => {
      let v = { x: axis === "y" ? 0 : -pointer.vx, y: axis === "x" ? 0 : -pointer.vy };
      const start = performance.now();
      let last = start;
      const tick = (now: number) => {
        const dt = Math.min(now - last, 32);
        last = now;
        const elapsed = now - start;
        const [sx, sy] = [glideStep(v.x, dt), glideStep(v.y, dt)];
        if (v.x !== 0) {
          const before = element.scrollLeft;
          element.scrollLeft = before + sx.delta;
          v = { ...v, x: Math.abs(element.scrollLeft - before) < Math.abs(sx.delta) / 2 ? 0 : sx.v };
        }
        if (v.y !== 0 && vertical) {
          const before = vertical.scrollTop;
          vertical.scrollTop = before + sy.delta;
          v = { ...v, y: Math.abs(vertical.scrollTop - before) < Math.abs(sy.delta) / 2 ? 0 : sy.v };
        }
        glideFrame = glideDone(v.x, elapsed) && glideDone(v.y, elapsed) ? 0 : requestAnimationFrame(tick);
      };
      glideFrame = requestAnimationFrame(tick);
    };

    const down = (event: PointerEvent) => {
      if (event.button !== 0 || (event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
      stopGlide();
      if ((event.target as Element).closest(NO_PAN)) return;
      if (skip && (event.target as Element).closest(skip)) return;
      refresh();
      const movable = axes();
      if (!movable.x && !movable.y) return;
      pointerId = event.pointerId;
      samples = [];
      pan.down(event.clientX, event.clientY, element.scrollLeft, vertical?.scrollTop ?? 0, movable);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const step = pan.move(event.clientX, event.clientY, event.shiftKey);
      if (!step?.dragging) return;
      samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY });
      if (samples.length > SAMPLES) samples.shift();
      if (!element.hasAttribute("data-panning")) {
        element.setAttribute("data-panning", "");
        try {
          element.setPointerCapture(event.pointerId);
        } catch {
          // 이미 사라진 포인터면 붙들지 못한다. 끌기는 창에서 받으니 그대로 이어진다
        }
        // 글자 선택을 막는다. 문서에 `user-select` 를 걸면 상속으로 모든 요소의 스타일을 다시 계산하니 이벤트로 막는다
        document.addEventListener("selectstart", noSelect);
        window.getSelection()?.removeAllRanges();
        // 끄는 동안의 커서(`grabbing`)는 화면을 덮는 빈 요소 하나가 낸다. `cursor` 는 상속되는 속성이라 컨테이너에 걸면 자손 수천 개의 스타일을 다시 계산한다
        cursor = document.createElement("div");
        cursor.setAttribute("data-pan-cursor", "");
        cursor.style.cssText = "position:fixed;inset:0;z-index:2147483000;cursor:grabbing";
        document.body.appendChild(cursor);
        onStart?.();
      }
      if (step.axis !== "y") element.scrollLeft = step.left;
      if (step.axis !== "x" && vertical) vertical.scrollTop = step.top;
    };
    const end = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = -1;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      const axis = pan.axis;
      if (!pan.up() || !axis) return;
      element.removeAttribute("data-panning");
      document.removeEventListener("selectstart", noSelect);
      cursor?.remove();
      cursor = null;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      swallow = true;
      window.setTimeout(() => (swallow = false), 0);
      if (event.type === "pointerup" && !reducedMotion()) {
        const speed = releaseVelocity(samples, event.timeStamp);
        if (Math.abs(speed.vx) > 0 || Math.abs(speed.vy) > 0) glide(axis, speed);
      }
      onEnd?.();
    };
    const click = (event: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      event.preventDefault();
      event.stopPropagation();
    };
    // 링크·이미지를 잡고 끌면 브라우저가 끌어다 놓기를 시작해 포인터 이벤트가 끊긴다
    const dragStart = (event: DragEvent) => event.preventDefault();
    const noSelect = (event: Event) => event.preventDefault();

    element.addEventListener("pointerdown", down);
    element.addEventListener("pointerenter", refresh);
    element.addEventListener("wheel", stopGlide, { passive: true });
    element.addEventListener("click", click, true);
    element.addEventListener("dragstart", dragStart);
    return () => {
      stopGlide();
      resize.disconnect();
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointerenter", refresh);
      element.removeEventListener("wheel", stopGlide);
      element.removeEventListener("click", click, true);
      element.removeEventListener("dragstart", dragStart);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      document.removeEventListener("selectstart", noSelect);
      element.removeAttribute("data-panning");
      cursor?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
