import type { CSSProperties } from "react";

export const TV_VARS = {
  "--tv-ink": "#1c1845",
  "--tv-body": "#433f69",
  "--tv-muted": "#625f8a",
  "--tv-rule": "#e4e0f5",
  "--tv-rule-strong": "#d3ccf2",
  "--tv-brand": "#5a3df0",
  "--tv-brand-deep": "#4328c9",
  "--tv-on-brand": "#e4dcff",
  "--tv-lav": "#ece8ff",
  "--tv-lav-soft": "#f4f1ff",
  "--tv-butter": "#fff2bf",
  "--tv-butter-soft": "#fff8dc",
  "--tv-mint": "#d5f3e6",
  "--tv-mint-deep": "#9fd9bf",
  "--tv-peach": "#ffe3d6",
  "--tv-pop": "#ffd23f",
} as CSSProperties;

export const vars = (values: Record<`--${string}`, string | number>) =>
  values as CSSProperties;

export const CONTAINER = "mx-auto w-full max-w-[1120px] px-5 lg:px-10";
export const STAGE_WRAP = "mx-auto w-full max-w-[1280px] lg:px-6";
export const SECTION_Y = { color: "py-16 lg:py-28", white: "py-14 lg:py-24" } as const;

export const LABEL =
  "text-[12px] font-extrabold tracking-[0.02em] text-[var(--tv-muted)]";
export const CAPTION =
  "m-0 text-[14px] leading-[1.65] text-[var(--tv-muted)]";
export const BODY = "m-0 text-[16px] leading-[1.75] text-[var(--tv-body)]";
export const LEAD =
  "m-0 text-[16px] leading-[1.75] text-[var(--tv-body)] lg:text-[18px]";
export const CARD_TITLE =
  "m-0 text-[22px] font-extrabold leading-[1.3] tracking-[-0.03em] text-[var(--tv-ink)]";
export const H2 =
  "m-0 text-balance text-[28px] font-extrabold leading-[1.22] tracking-[-0.035em] text-[var(--tv-ink)] lg:text-[44px] lg:leading-[1.16] lg:tracking-[-0.04em]";
export const CLOSING_H =
  "m-0 text-balance text-[30px] font-extrabold leading-[1.18] tracking-[-0.04em] text-white lg:text-[56px] lg:leading-[1.1] lg:tracking-[-0.045em]";
export const H1 =
  "m-0 text-[clamp(28px,9vw,34px)] lg:text-[64px] font-extrabold leading-[1.12] lg:leading-[1.08] tracking-[-0.04em] lg:tracking-[-0.045em] text-[var(--tv-ink)]";
export const HAND =
  "text-[14px] font-extrabold leading-[1.35] tracking-[-0.01em] text-[var(--tv-ink)]";

export const MARKER =
  "-mx-1 px-1 bg-[linear-gradient(var(--tv-pop),var(--tv-pop))] bg-no-repeat [background-size:100%_0.42em] [background-position:0_88%] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";
export const MARKER_DRAW = `${MARKER} tv-mark`;
export const MARKER_REVEAL = `${MARKER} tv-rmark`;

export const SHADOW = {
  panel:
    "shadow-[0_24px_48px_-24px_rgba(40,24,120,0.35),0_2px_6px_rgba(12,10,9,0.05)]",
  sticky: "shadow-[0_6px_14px_-6px_rgba(60,40,0,0.35)]",
  app: "shadow-e2",
} as const;

export const RADIUS = {
  face: "rounded-[28px] lg:rounded-[40px]",
  card: "rounded-[24px] lg:rounded-[28px]",
  window: "rounded-[16px]",
} as const;

/**
 * 진짜 컨트롤의 포커스 링. 밝은 면에서는 보라 진한 색(8.8:1), 보라 면 위에서는 흰색(6.25:1).
 * `outline-solid` 를 같이 건다 — Tailwind 4 의 `outline-none` 은 `--tw-outline-style` 을 none 으로
 * 두어서, `outline-2` 만으로는 포커스 때도 선이 안 그려진다.
 */
export const FOCUS =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-[var(--tv-brand-deep)]";
export const FOCUS_ON_BRAND =
  "outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-white";

export const APP = {
  ink: "text-[var(--el-ink)]",
  body: "text-[var(--el-body)]",
  bodyStrong: "text-[var(--el-body-strong)]",
  muted: "text-[var(--el-muted)]",
  faint: "text-[var(--el-muted-soft)]",
  line: "border-[var(--el-hairline)]",
  lineSoft: "border-[var(--el-hairline-soft)]",
  chipBg: "bg-[var(--el-surface-strong)]",
  softBg: "bg-[var(--el-canvas-soft)]",
  primary: "bg-[var(--el-primary)] text-white",
  rec: "text-[var(--el-error)]",
  recBg: "bg-[var(--el-error)]",
  recStrong: "text-[var(--el-error-strong)]",
  success: "bg-[var(--el-success)]/10 text-[var(--el-success-strong)]",
} as const;

export const ROLE_COLOR = {
  decision: "#2a78d6",
  task: "#1baf7a",
  open: "#eb6834",
} as const;
