import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** 커스텀 radius 유틸은 등록하지 않으면 tailwind-merge 가 기본 radius 와 충돌로 보지 않아 둘 다 살아남습니다. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [
        "rounded-panel",
        "rounded-block",
        "rounded-control",
        "rounded-chip",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** jsdom 에는 `matchMedia` 가 없습니다. */
export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
