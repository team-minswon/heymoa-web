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

/** 이 요소 안에서 누르면 끌지 않는다(글을 고르거나 입력하는 자리) */
const NO_PAN = "input, textarea, select, [data-no-pan]";
/** 속도를 재려고 기억하는 포인터 표본의 수 */
const SAMPLES = 8;

/** 세로로 스크롤되는 가장 가까운 부모(넘치지 않아도). 페이지가 길어지는지 지켜볼 대상이다 */
function scrollParentOf(from: HTMLElement | null): HTMLElement | null {
  for (let element: HTMLElement | null = from; element; element = element.parentElement) {
    const overflow = getComputedStyle(element).overflowY;
    if (overflow === "auto" || overflow === "scroll") return element;
  }
  return null;
}

/**
 * 마우스로 잡아 끌어서 지도 앱처럼 움직인다. 좌우는 이 요소 자체(가로 스크롤 컨테이너)를, 상하는 가장 가까운 세로 스크롤 부모(페이지)를 옮긴다.
 *
 * - **움직일 수 있는 축으로만.** 가로로 넘치면 좌우, 세로 부모가 넘치면 상하다. 둘 다 아니면 `grab` 커서도 없고 끌기도 시작하지 않는다.
 * - **한 축으로 고정.** 5px 문턱을 넘는 순간 더 많이 움직인 축을 고르고 그 끌기가 끝날 때까지 반대 축은 움직이지 않는다(Shift 를 누르고 끌면 두 축).
 *   문턱을 넘은 자리의 포인터가 새 원점이라 시작할 때 내용이 튀지 않는다.
 * - 문턱을 넘기 전에는 아무것도 막지 않아 점·버튼의 평소 클릭이 그대로 된다. 끌기가 되면 포인터를 붙들어(`setPointerCapture`) 요소 밖으로 나가도
 *   이어지고, 텍스트 선택을 막고, 끝난 뒤 따라오는 클릭 하나를 삼킨다.
 * - **관성.** 놓기 직전 80ms 의 속도로 짧게(최대 0.4초) 더 굴러가고 끝에 닿으면 바로 선다. 새로 누르거나 휠을 돌리면 즉시 멈추고, 움직임 줄이기
 *   설정에서는 쓰지 않는다. 스크롤 값은 프레임마다 한 번만 쓴다.
 * - 마우스·펜만 쓴다. 터치는 브라우저의 스크롤이 이미 있고, 터치패드 두 손가락 스크롤·키보드·Shift+휠도 손대지 않는다.
 * - 이동 중에는 DOM 을 읽지 않는다. 누를 때 한 번 스크롤 부모를 찾고, 움직일 때는 스크롤 값만 쓴다.
 * - 커서: 끌 수 있을 때의 `grab` 은 이 훅이 요소에 단다(상속되는 속성이라 상태가 바뀔 때만 건드린다). 끄는 동안의 `grabbing` 은 화면을 덮는 빈 요소
 *   (`data-pan-cursor`)가 낸다. 끄는 중인지는 요소의 `data-panning` 속성으로 알 수 있다(스타일 규칙은 걸지 않는다).
 */
export function useDragPan(
  ref: RefObject<HTMLElement | null>,
  { onStart, onEnd, skip }: { onStart?: () => void; onEnd?: () => void; /** 이 안에서 누르면 이 훅은 시작하지 않는다(안쪽에 따로 건 끌기가 있을 때) */ skip?: string } = {}
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

    // 어느 축으로 끌 수 있나: 가로로 넘치는 이 요소, 세로로 넘치는 스크롤 부모. 커서(`grab`)도 이 값을 따르고, 아무 축도 아니면 `default` 다
    const axes = () => ({ x: element.scrollWidth > element.clientWidth + 1, y: vertical !== null });
    const refresh = () => {
      // 이 요소 자신이 세로로도 넘치면(스크롤 상자 높이가 제한된 판) 그것을, 아니면 가장 가까운 세로 스크롤 부모(페이지)를 옮긴다
      const parent = element.scrollHeight > element.clientHeight + 1 ? element : scrollParentOf(element.parentElement);
      vertical = parent && parent.scrollHeight > parent.clientHeight + 1 ? parent : null;
      const movable = axes();
      const want = movable.x || movable.y ? "grab" : "default";
      if (element.style.cursor !== want) element.style.cursor = want;
    };
    refresh();
    // 판 크기가 바뀔 때, 그리고 페이지가 길어지거나 짧아질 때(띠가 열리고 닫힐 때) 다시 본다
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
    /** 놓은 뒤 더 굴러간다. 한 프레임에 한 번만 쓰고, 끝에 닿은 축은 그 자리에서 멈춘다 */
    const glide = (axis: PanAxis, pointer: { vx: number; vy: number }) => {
      // 포인터가 오른쪽으로 가면 내용은 왼쪽으로(스크롤 값은 줄어든다)
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
          // 끝에 닿았다: 움직이려던 만큼 못 움직였으면 거기서 선다
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
      // 끌기를 시작하면 포인터가 요소 밖으로 나가거나 덮개 위에 있어도 이어지게 창에서 받는다
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
      // 이어서 오는 클릭 하나를 삼킨다. 클릭이 오지 않아도 다음 틱에 풀어서 그 다음 진짜 클릭을 막지 않는다
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
    // 콜백은 최신 값이 아니라도 되는 가벼운 알림이다(호버 카드 숨김)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
