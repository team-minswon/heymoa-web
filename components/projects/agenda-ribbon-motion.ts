import type { Transition } from "motion/react";

/**
 * 연결 지도의 움직임 값. 움직임은 사용자가 한 행동의 결과를 눈이 따라가야 할 때 쓰고, 이동은 부드럽게 옮겨 간다. 출렁임(오버슈트·바운스)은 없다.
 * - 열을 눌러 펼치고 접을 때 폭, 줄기를 골라 갈래가 펴질 때 줄 높이, 패널이 열릴 때 폭: 같은 스프링 하나(`MOVE`, 출렁임 없음, 0.25초)
 * - 호버 카드가 뜨고 질 때, 고른 줄기 밖이 흐려질 때, 사용자가 연 열의 제목이 나타날 때: easeOut 페이드(`FADE` 0.16초, `FADE_OUT` 0.1초)
 * - 화면이 바뀔 때(전체 지도 ↔ 줄기 포커스, 포커스 안에서 줄기·갈래를 옮길 때): 새 화면이 옅게 나타나며 `RISE`(8px) 올라온다(`SWAP` 0.2초).
 *   점·카드가 옛 자리에서 날아오는 움직임(FLIP)과 갈래 칩의 가로 스크롤 애니메이션은 쓰지 않는다 — 한꺼번에 여러 것이 날아 눈이 어지럽다
 * 움직임 줄이기 설정에서는 이동을 모두 끄고(`INSTANT`) 나타나고 사라지는 것만 짧은 페이드(`FADE_REDUCED`)로 남긴다.
 */
export const MOVE: Transition = { type: "spring", bounce: 0, duration: 0.25 };
export const FADE: Transition = { duration: 0.16, ease: "easeOut" };
export const FADE_OUT: Transition = { duration: 0.1, ease: "easeOut" };
export const FADE_REDUCED: Transition = { duration: 0.12, ease: "easeOut" };
export const INSTANT: Transition = { duration: 0 };
/**
 * 열을 펼치고 접는 움직임은 시안 6 과 같다: 열 폭·줄 높이는 `MOVE` 스프링(출렁임 없음, 0.25초), 제목은 0.16초 페이드(0.1초 지연).
 * 층 구조(접힌 모양·펼친 모양)는 점이 열 폭에 따라 미끄러지지 않게 하려는 것이고, 선은 두 층에서 겹쳐 있다가 뒤에 거둔다(번쩍임·끊김 없음).
 */
/** 열 폭: 처음에 몰아서 끝나지 않는 부드러운 곡선(처음 2프레임 25% 이하, 50% 도달 약 140ms, 90% 약 270ms, 오버슈트 없음). 펼침·접힘이 같다 */
export const COLUMN_WIDTH: Transition = { duration: 0.34, ease: [0.45, 0, 0.25, 1] };
export const EXPAND: Transition = COLUMN_WIDTH;
export const COLLAPSE: Transition = COLUMN_WIDTH;
/** 펼친 내용이 나타나는 시간(ms)과 지연, 접힌 내용이 나타나는 시간, 옛 층을 거두는 시간 */
export const OPEN_FADE_MS = 160;
export const OPEN_DELAY_MS = 100;
export const CLOSED_OUT_MS = 100;
export const CHOREO_MS = 420;
export const staggerOf = () => ({ step: 0, total: OPEN_FADE_MS });
/** 열 폭이 움직이는 것과 같은 값: 이웃 열·열 머리·줄기 이름이 열 폭에 맞춰 같이 움직인다 */
export const widthOf = (instant: boolean): Transition => (instant ? INSTANT : COLUMN_WIDTH);
/** 화면이 바뀔 때 새 화면이 옅게 나타나며 올라오는 시간과 거리 */
export const SWAP: Transition = { duration: 0.2, ease: "easeOut" };
export const SWAP_MS = 200;
export const RISE = 8;
/** 호버 카드가 뜨고 질 때 */
export const HOVER_IN: Transition = { duration: 0.14, ease: "easeOut" };
export const HOVER_OUT: Transition = { duration: 0.1, ease: "easeOut" };
/** 고른 줄기 밖이 흐려지는 시간(ms) */
export const DIM_MS = 160;

/** `instant` 면(움직임 줄이기, 또는 사용자가 한 행동이 아닌 재배치) 이동 없이 바로 */
export const moveOf = (instant: boolean): Transition => (instant ? INSTANT : MOVE);
export const fadeOf = (reduced: boolean): Transition => (reduced ? FADE_REDUCED : FADE);
/** 새 화면이 나타나는 처음 값과 끝 값. 움직임 줄이기에서는 올라오지 않고 옅어지기만 한다 */
export const swapIn = (reduced: boolean) => ({
  initial: { opacity: 0, y: reduced ? 0 : RISE },
  animate: { opacity: 1, y: 0, transition: reduced ? FADE_REDUCED : SWAP },
});

export const reducedMotion = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 열 하나의 CSS 변수별 움직임. 폭과 면(`--o`)은 `MOVE` 스프링, 층의 투명도(`--oc`·`--lc`·`--oo`·`--lo`)는 짧은 페이드다.
 * `instant`: 움직임 없이 바로. `reduced`: 폭·이동 없이 내용만 120ms 크로스페이드.
 */
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
        // 새 선이 먼저 서고 옛 선이 거두어진다
        "--lc": { duration: 0.06, ease: "easeOut" },
        "--lo": { delay: 0.06, duration: 0.1, ease: "easeOut" },
        "--oc": { delay: OPEN_DELAY_MS / 1000, duration: OPEN_FADE_MS / 1000, ease: "easeOut" },
        "--ti": FADE,
      } as Transition);
};
/** 줄 높이·판 높이: 시안 6 과 같은 `MOVE` 스프링 */
export const layoutOf = (instant: boolean): Transition => (instant ? INSTANT : MOVE);
