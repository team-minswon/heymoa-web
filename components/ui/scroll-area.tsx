"use client";

import * as React from "react";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { cn } from "@/lib/utils";

function ScrollArea({
  className,
  children,
  overlay,
  viewportRef,
  viewportClassName,
  quietScrollbar = false,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  overlay?: React.ReactNode;
  viewportRef?: React.Ref<HTMLDivElement>;
  /**
   * 뷰포트에 덧붙일 클래스. 세로만 스크롤시키려면 `overflow-x-hidden`이 필요하다 —
   * 뷰포트는 두 축을 다 스크롤하는데 가로 스크롤바를 안 그리면 손잡이 없는 스크롤이 된다.
   */
  viewportClassName?: string;
  /**
   * 스크롤바를 가리키거나 스크롤하는 동안에만 보인다. 늘 서 있으면 내용이 넘치기만 해도(질문 아래 남긴 자리 등) 막대가
   * 줄곧 보여 읽는 면에 군더더기가 된다. 자리는 그대로라 나타나도 내용이 밀리지 않는다.
   */
  quietScrollbar?: boolean;
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          viewportClassName
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {overlay}
      <ScrollBar
        className={
          quietScrollbar
            ? "opacity-0 transition-opacity duration-200 data-hovering:opacity-100 data-scrolling:opacity-100 motion-reduce:transition-none"
            : undefined
        }
      />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
