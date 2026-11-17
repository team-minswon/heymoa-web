"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

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
