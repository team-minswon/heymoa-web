"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 펼치고 접히는 자리. 높이를 재지 않고 grid 행을 `0fr → 1fr` 로 옮겨 내용 높이만큼 자란다.
 * 제품 면의 층 전이와 같은 200ms `ease-out` 이고, 움직임을 줄인 환경에서는 바로 바뀐다.
 *
 * [lazy] 면 처음 펼칠 때 내용을 만든다 — 줄마다 수정 기록을 미리 부르지 않는다.
 * 한 번 만든 뒤에는 접어도 두어서, 다시 펼칠 때 튀지 않고 읽던 자리가 남는다.
 */
export function Collapse({
  open,
  lazy = false,
  children,
  className,
}: {
  open: boolean;
  lazy?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);

  return (
    <div
      data-state={open ? "open" : "closed"}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
    >
      <div className="min-h-0 overflow-hidden">{!lazy || opened ? children : null}</div>
    </div>
  );
}
