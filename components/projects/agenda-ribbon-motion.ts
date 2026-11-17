import type { Transition } from "motion/react";

export const MOVE: Transition = { type: "spring", bounce: 0, duration: 0.25 };
export const FADE: Transition = { duration: 0.16, ease: "easeOut" };
export const FADE_OUT: Transition = { duration: 0.1, ease: "easeOut" };
export const FADE_REDUCED: Transition = { duration: 0.12, ease: "easeOut" };
export const INSTANT: Transition = { duration: 0 };
export const COLUMN_WIDTH: Transition = { duration: 0.34, ease: [0.45, 0, 0.25, 1] };
export const EXPAND: Transition = COLUMN_WIDTH;
export const COLLAPSE: Transition = COLUMN_WIDTH;
export const OPEN_FADE_MS = 160;
export const OPEN_DELAY_MS = 100;
export const CLOSED_OUT_MS = 100;
export const CHOREO_MS = 420;
export const staggerOf = () => ({ step: 0, total: OPEN_FADE_MS });
export const widthOf = (instant: boolean): Transition => (instant ? INSTANT : COLUMN_WIDTH);
export const SWAP: Transition = { duration: 0.2, ease: "easeOut" };
export const SWAP_MS = 200;
export const RISE = 8;
export const HOVER_IN: Transition = { duration: 0.14, ease: "easeOut" };
export const HOVER_OUT: Transition = { duration: 0.1, ease: "easeOut" };
export const DIM_MS = 160;

export const moveOf = (instant: boolean): Transition => (instant ? INSTANT : MOVE);
export const fadeOf = (reduced: boolean): Transition => (reduced ? FADE_REDUCED : FADE);
export const swapIn = (reduced: boolean) => ({
  initial: { opacity: 0, y: reduced ? 0 : RISE },
  animate: { opacity: 1, y: 0, transition: reduced ? FADE_REDUCED : SWAP },
});

export const reducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const columnMotion = (open: boolean, instant: boolean, reduced: boolean): Transition => {
  if (reduced)
    return { default: INSTANT, "--oc": FADE_REDUCED, "--lc": FADE_REDUCED, "--oo": FADE_REDUCED, "--lo": FADE_REDUCED, "--ti": FADE_REDUCED } as Transition;
  if (instant) return INSTANT;
  const out = { duration: CLOSED_OUT_MS / 1000, ease: "easeOut" } as const;
  return open
    ? ({ width: COLUMN_WIDTH, "--o": COLUMN_WIDTH, "--oc": out, "--lc": out, "--lo": out, "--oo": { delay: OPEN_DELAY_MS / 1000, duration: OPEN_FADE_MS / 1000, ease: "easeOut" }, "--ti": FADE } as Transition)
    : ({
        width: COLUMN_WIDTH,
        "--o": COLUMN_WIDTH,
        "--oo": out,
        "--lc": { duration: 0.06, ease: "easeOut" },
        "--lo": { delay: 0.06, duration: 0.1, ease: "easeOut" },
        "--oc": { delay: OPEN_DELAY_MS / 1000, duration: OPEN_FADE_MS / 1000, ease: "easeOut" },
        "--ti": FADE,
      } as Transition);
};
export const layoutOf = (instant: boolean): Transition => (instant ? INSTANT : MOVE);
