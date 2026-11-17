"use client";

import { useEffect, useRef, useState } from "react";

const DRAIN_MS = 260;

const MIN_CHARS_PER_FRAME = 1;

export function useSmoothText(target: string, active: boolean): string {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  const settle = (next: string) => {
    shownRef.current = next;
    setShown(next);
  };

  useEffect(() => {
    if (!active || !target.startsWith(shownRef.current)) {
      if (shownRef.current !== target) settle(target);
      return;
    }
    if (shownRef.current.length >= target.length) return;

    let raf = 0;
    let previous = 0;
    const step = (now: number) => {
      const elapsed = previous === 0 ? 16 : now - previous;
      previous = now;
      const current = shownRef.current;
      const behind = target.length - current.length;
      if (behind <= 0) return;
      const chars = Math.max(
        MIN_CHARS_PER_FRAME,
        Math.ceil((behind * elapsed) / DRAIN_MS)
      );
      const next = target.slice(0, current.length + chars);
      settle(next);
      if (next.length < target.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);

  return shown;
}
