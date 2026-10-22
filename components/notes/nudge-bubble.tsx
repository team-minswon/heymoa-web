"use client";

import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * 잠깐 떴다 저절로 사라지는 안내 말풍선이 같이 쓰는 움직임과 남은 시간 막대.
 * 회의 중지 뒤 종료 안내(`meeting-controls`)와 타임라인 첫 항목 안내(`timeline-hint`)가 쓴다 —
 * 같은 면에서 뜨는 말풍선이 저마다 다르게 움직이면 한 물건으로 안 읽힌다.
 *
 * `AnimatePresence` 안의 `motion.div` 에 펼쳐 넣는다. 둘 다 버튼·탭 **아래**에 서고 위 꼬리가
 * 그쪽을 가리키므로, 꼬리 쪽(위)에서 내려오며 펴지고 그쪽으로 접힌다.
 * 움직임 줄이기 설정이면 등장·퇴장 모두 즉시다 — `exit` 가 없으면 `AnimatePresence` 가 바로 뺀다.
 */
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

/**
 * 말풍선 아래 가장자리의 2px 막대. `ms` 에 걸쳐 줄어든다. 닫는 타이머는 호출부가 갖고,
 * 타이머를 멈출 때 `paused` 로 막대도 같이 세운다. 움직임 줄이기 설정이면 그리지 않는다.
 */
export function CountdownBar({
  ms,
  paused = false,
  className,
  barClassName,
}: {
  ms: number;
  paused?: boolean;
  /** 말풍선 모서리에 맞춰 자르는 둥글기(`rounded-b-*`). */
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
