import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * v5 형태 스케일(`rounded-panel`·`block`·`control`·`chip`)은 커스텀 유틸이라
 * tailwind-merge가 기본 radius와 같은 충돌 그룹으로 보지 않는다. 등록하지 않으면
 * `rounded-panel rounded-none`이 **둘 다 살아남고 CSS 선언 순서가 이긴다** —
 * 실제로 모바일 설정 다이얼로그가 `rounded-none`인데 16px로 그려졌다(APP-210).
 *
 * 프리미티브 기본값을 시맨틱 클래스로 옮기면 호출부 오버라이드가 전부 이 경로를 지난다.
 */
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
