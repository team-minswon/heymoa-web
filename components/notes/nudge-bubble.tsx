"use client";

import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

export function useNudgeMotion(transformOrigin: string) {
  const reduced = useReducedMotion();
  if (reduced) return { initial: false, style: { transformOrigin } } as const;
  return {
    initial: { opacity: 0, y: -8, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.15 } },
    transition: { duration: 0.22, ease: "easeOut" },
    style: { transformOrigin },
  } as const;
}

export function CountdownBar({
  ms,
  paused = false,
  className,
  barClassName,
}: {
  ms: number;
  paused?: boolean;
  className?: string;
  barClassName?: string;
}) {
  return (
    <div
      aria-hidden
      data-testid="countdown-bar"
      className={cn(
        "absolute inset-x-0 bottom-0 h-0.5 overflow-hidden motion-reduce:hidden",
        className
      )}
    >
      <span
        className={cn("block h-full", barClassName)}
        style={{
          animation: `end-nudge-countdown ${ms}ms linear forwards`,
          animationPlayState: paused ? "paused" : "running",
        }}
      />
    </div>
  );
}
