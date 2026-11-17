import { useEffect, useRef, useState } from "react";

export const NUDGE_DELAYS_MS = [20_000, 30_000, 60_000, 120_000];
export const NUDGE_SHOW_MS = 2_400;
export const NUDGE_RETRY_MS = 10_000;

function isTyping() {
  const el = document.activeElement;
  return (
    el instanceof HTMLElement &&
    (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
  );
}

export function useAgentNudge(enabled: boolean) {
  const [nudging, setNudging] = useState(false);
  const shown = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const delay = NUDGE_DELAYS_MS[shown.current];
      if (delay !== undefined) timer = setTimeout(fire, delay);
    };
    const fire = () => {
      if (document.hidden || isTyping()) {
        timer = setTimeout(fire, NUDGE_RETRY_MS);
        return;
      }
      shown.current += 1;
      setNudging(true);
      timer = setTimeout(() => {
        setNudging(false);
        schedule();
      }, NUDGE_SHOW_MS);
    };
    const onVisibility = () => {
      if (document.hidden) setNudging(false);
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      setNudging(false);
    };
  }, [enabled]);

  return nudging && enabled;
}
