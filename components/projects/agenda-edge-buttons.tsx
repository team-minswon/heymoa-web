"use client";

import { useEffect, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 가장자리 이동 버튼: 지름과, 한 번에 옮기는 폭의 비율 */
export const EDGE_BUTTON = 32;
const EDGE_STEP = 0.8;

const SIDES = ["left", "right"] as const;

/**
 * 가로로 스크롤되는 상자(`scroller`)의 왼쪽·오른쪽 가장자리의 둥근 버튼(shadcn `Button`). 레이아웃 공간을 쓰지 않는 오버레이라 스크롤 상자는 틀의 안쪽 끝까지 쓴다.
 * 그 방향으로 더 갈 수 있으면 포인터와 상관없이 늘 보이고, 더 갈 수 없으면 120ms 페이드로 사라진다(보이지 않을 때는 눌리지도 포커스되지도 않는다).
 * 누르면 상자 폭의 80% 만큼 옮긴다(움직임 줄이기 설정이면 바로). 켜지고 꺼져도 상자의 크기·스크롤은 바뀌지 않는다.
 * 배경은 판 면 토큰의 94% 불투명 + 옅은 그림자라 점·글자 위에 서도 읽히고, 어디 서는지를 계산하지 않는다.
 *
 * 세로로는 **CSS `position: sticky` 만으로** 따라온다(JS 가 스크롤마다 위치를 계산·보간하지 않아 지연이 없다). 스크롤 상자 밖, 상자를 감싼 틀 안에서
 * 위·아래 간격을 둘 다 주어 버튼이 늘 보이는 구간의 한가운데(`inset`: 화면 맨 위에서 가운데까지의 보정. 위에 붙는 머리 띠가 있으면 그 높이의 절반)에 서고,
 * 틀을 벗어나지 않는다. 높이가 없는 줄(`-mb`)이라 레이아웃을 바꾸지 않는다. 가로 스크롤에서 나타남·숨김은 passive 리스너가 값이 바뀔 때만 상태를 갱신한다.
 */
export function EdgeButtons({
  scroller,
  reduced,
  inset = 0,
  className,
}: {
  scroller: RefObject<HTMLElement | null>;
  reduced: boolean;
  /** 화면 위쪽을 덮는 머리 띠의 높이. 보이는 구간은 그 아래부터다 */
  inset?: number;
  className?: string;
}) {
  const [edge, setEdge] = useState({ left: false, right: false });
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const read = () => {
      const next = { left: element.scrollLeft > 1, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1 };
      setEdge((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
    };
    read();
    element.addEventListener("scroll", read, { passive: true });
    const observer = new ResizeObserver(read);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      element.removeEventListener("scroll", read);
      observer.disconnect();
    };
  }, [scroller]);

  const go = (direction: -1 | 1) => {
    const element = scroller.current;
    if (element) element.scrollBy({ left: direction * Math.round(element.clientWidth * EDGE_STEP), behavior: reduced ? "auto" : "smooth" });
  };
  const middle = inset / 2;
  const shown = edge.left || edge.right;
  return (
    <div
      data-edge-buttons=""
      className={cn("pointer-events-none sticky z-[5] w-full", className)}
      style={{
        top: `calc(50% + ${middle - EDGE_BUTTON / 2}px)`,
        bottom: `calc(50% - ${middle + EDGE_BUTTON / 2}px)`,
        height: EDGE_BUTTON,
        marginBottom: -EDGE_BUTTON,
      }}
    >
      {shown
        ? SIDES.map((side) => {
            const Icon = side === "left" ? ChevronLeft : ChevronRight;
            return (
              <div key={side} inert={!edge[side]} className={cn("absolute top-0", side === "left" ? "left-2" : "right-2")}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={side === "left" ? "왼쪽으로" : "오른쪽으로"}
                  onClick={() => go(side === "left" ? -1 : 1)}
                  className={cn(
                    "rounded-full border-border bg-[color-mix(in_srgb,var(--el-surface-card)_94%,transparent)] shadow-e2 transition-opacity duration-[120ms] motion-reduce:duration-100",
                    edge[side] ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                </Button>
              </div>
            );
          })
        : null}
    </div>
  );
}
