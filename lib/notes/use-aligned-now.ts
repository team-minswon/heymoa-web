"use client";

import { useEffect, useState } from "react";

export function useAlignedNow(
  intervalMs: number,
  active = true,
  alignmentOriginsMs: readonly number[] = []
): number | null {
  const [now, setNow] = useState<number | null>(null);
  const offsetsKey = alignmentOriginsMs
    .filter(Number.isFinite)
    .map((origin) => ((origin % intervalMs) + intervalMs) % intervalMs)
    .sort((a, b) => a - b)
    .join(",");

  useEffect(() => {
    if (!active) return;

    const offsets = offsetsKey ? offsetsKey.split(",").map(Number) : [0];
    let timeout: number | undefined;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      timeout = window.setTimeout(
        tick,
        Math.max(
          1,
          Math.min(
            ...offsets.map((offset) => {
              const elapsed = (current - offset) % intervalMs;
              return (
                intervalMs - (elapsed < 0 ? elapsed + intervalMs : elapsed)
              );
            })
          )
        )
      );
    };
    const initial = window.setTimeout(tick, 0);
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timeout);
      tick();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active, intervalMs, offsetsKey]);

  return active ? now : null;
}
