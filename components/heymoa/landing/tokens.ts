import type { CSSProperties } from "react";

import type { TimelineTone } from "@/lib/notes/proposals/timeline";

/*
 * tl;dv 판의 값. **두 목소리를 색으로 가른다.**
 *   - 창 안(앱 화면 하나) = 앱의 `--el-*` 와 아래 `APP` · `ROLE_*`. 보라 · 라벤더 · 노랑은 한 픽셀도 없다.
 *   - 창 밖 · 창 위 주석(쪽지 · 손글씨 · 화살표 · 형광펜 · 커서 · 섬광) = 이 페이지의 `--tv-*`.
 * 구간 파일은 여기와 `marks.tsx` · `app.tsx` 에 없는 색 · 그림자 · 반경을 새로 만들지 않는다.
 */

/**
 * 페이지 팔레트. 바탕은 흰색 하나(`--tv-bg` 없음)이고, 색은 면(라벤더 · 버터 · 민트 · 복숭아)과
 * 보라 하나 · 노랑 하나가 전부다. 앱 상태색(기록 중 · 확정됨 · 역할 색)은 여기 두지 않는다 — 그건
 * 창 안의 말이라 `APP` · `ROLE_*` 로 쓴다.
 *
 * 대비: 흰 면 · 라벤더 면 위 글자 muted 5.0:1 이상, body 8:1 이상. 노랑(`--tv-pop`) 위에는 ink 만
 * 얹는다(11.5:1). 보라(`--tv-brand`) 위 글자는 흰색 · `--tv-on-brand` 만 쓴다. 노란 버튼은 노랑 + ink.
 */
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
  /** 맨 끝 예시 고지 띠. 바로 아래 마케팅 푸터의 파도 위 면(`.landing-footer` 배경)과 같은 값이라 띠가 파도로 이어진다. */
  "--tv-paper": "#faf8f5",
} as CSSProperties;

/** 사용자 정의 속성(`--i` 순번 · `--d` 지연 · `--n` 반복)을 style 로 넘길 때. */
export const vars = (values: Record<`--${string}`, string | number>) =>
  values as CSSProperties;

/* ── 자리 ─────────────────────────────────────────────────────────────── */

/** 본문 기둥. 1440 에서 좌우 40 을 빼고 남는 1120. */
export const CONTAINER = "mx-auto w-full max-w-[1120px] px-5 lg:px-10";
/** 히어로 무대만 1120 기둥보다 넓다. 모바일에서는 화면 끝까지 간다. */
export const STAGE_WRAP = "mx-auto w-full max-w-[1280px] lg:px-6";
/** 섹션 위아래. 색 면이 흰 면보다 한 숨 크다. */
export const SECTION_Y = { color: "py-16 lg:py-28", white: "py-14 lg:py-24" } as const;

/* ── 창 밖 글자 8단(창 안은 앱 값) ───────────────────────────────────────── */

export const LABEL =
  "text-[12px] font-extrabold tracking-[0.02em] text-[var(--tv-muted)]";
export const CAPTION =
  "m-0 break-keep text-[14px] leading-[1.65] text-[var(--tv-muted)]";
export const BODY = "m-0 break-keep text-[16px] leading-[1.75] text-[var(--tv-body)]";
export const LEAD =
  "m-0 break-keep text-[16px] leading-[1.75] text-[var(--tv-body)] lg:text-[18px]";
export const CARD_TITLE =
  "m-0 break-keep text-[22px] font-extrabold leading-[1.3] tracking-[-0.03em] text-[var(--tv-ink)]";
/** 섹션 제목 — 모바일 28 / 데스크톱 44. */
export const H2 =
  "m-0 text-balance break-keep text-[28px] font-extrabold leading-[1.22] tracking-[-0.035em] text-[var(--tv-ink)] lg:text-[44px] lg:leading-[1.16] lg:tracking-[-0.04em]";
/** 마무리 보라 블록의 제목. 보라 위라 흰 글자다. */
export const CLOSING_H =
  "m-0 text-balance break-keep text-[30px] font-extrabold leading-[1.18] tracking-[-0.04em] text-white lg:text-[56px] lg:leading-[1.1] lg:tracking-[-0.045em]";
export const H1 =
  "m-0 text-[clamp(28px,9vw,34px)] lg:text-[64px] font-extrabold leading-[1.12] lg:leading-[1.08] tracking-[-0.04em] lg:tracking-[-0.045em] text-[var(--tv-ink)] break-keep";
/** 손글씨 결 — 먹색 굵은 짧은 말. 설명 주석용. */
export const HAND =
  "text-[14px] font-extrabold leading-[1.35] tracking-[-0.01em] text-[var(--tv-ink)]";

/* ── 형광펜 ───────────────────────────────────────────────────────────── */

/**
 * 글자 아래 0.42em 을 노랗게 칠한다. **정지 상태가 곧 다 칠한 상태다** — 모션을 줄이거나 JS 가
 * 없어도 칠이 남는다. 줄이 바뀌어도 줄마다 칠한다(`box-decoration-break: clone`).
 */
export const MARKER =
  "-mx-1 px-1 bg-[linear-gradient(var(--tv-pop),var(--tv-pop))] bg-no-repeat [background-size:100%_0.42em] [background-position:0_88%] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";
/** 마운트될 때 왼쪽에서 오른쪽으로 칠한다. 지연은 style `--d`. */
export const MARKER_DRAW = `${MARKER} tv-mark`;
/** 조상 `Reveal` 이 화면에 들어오면 칠한다. 지연은 style `--d`(기본 300ms). */
export const MARKER_REVEAL = `${MARKER} tv-rmark`;

/* ── 그림자 · 반경 · 포커스 ────────────────────────────────────────────── */

/**
 * 그림자는 이 셋뿐이다. 창 · 카드 = panel, 쪽지 · 도장 · 종이 = sticky, 창 안에 떠 있는 앱
 * 부품(독 · 확정 막대) = app(앱의 `shadow-e2` 그대로).
 */
export const SHADOW = {
  panel:
    "shadow-[0_24px_48px_-24px_rgba(40,24,120,0.35),0_2px_6px_rgba(12,10,9,0.05)]",
  sticky: "shadow-[0_6px_14px_-6px_rgba(60,40,0,0.35)]",
  app: "shadow-e2",
} as const;

/** 색 면(무대 · 타일 · 마무리) = face, 회의 카드 = card, 앱 창 = window. 창 안은 앱 값(16/10/8/6/4). */
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

/* ── 창 안 전용(앱 값) ────────────────────────────────────────────────── */

/**
 * 창 안 글자 · 선 · 면. **창 안에서 `--tv-*` 를 쓰면 틀린 것이다.** 값은 `app/globals.css` 의
 * `--el-*` 그대로다.
 */
export const APP = {
  ink: "text-[var(--el-ink)]",
  body: "text-[var(--el-body)]",
  bodyStrong: "text-[var(--el-body-strong)]",
  muted: "text-[var(--el-muted)]",
  /** 점 · 아이콘 · 셰브런 색. **글자에는 쓰지 않는다 — 흰 바탕 2.5:1.** 글자는 `muted`(4.8:1). */
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

/** 유형 이름의 글자색 — `note-timeline.tsx` 의 `TONE_TEXT` 그대로. */
export const ROLE_TEXT: Record<TimelineTone, string> = {
  decision: "text-[#1d5fa8]",
  task: "text-[#13805a]",
  open: "text-[#b4501f]",
  answered: "text-[var(--el-muted)]",
  reference: "text-[var(--el-muted)]",
};

/** 타임라인 줄 제목의 무게 · 색 — `note-timeline.tsx` 의 `TONE_TITLE` 그대로. */
export const TONE_TITLE: Record<TimelineTone, string> = {
  decision: "font-medium text-[var(--el-ink)]",
  task: "font-medium text-[var(--el-ink)]",
  open: "text-[var(--el-ink)]",
  answered: "text-[var(--el-muted)]",
  reference: "text-[var(--el-body)]",
};

/** 앱 역할 색(`role-dot.tsx` 의 `ROLE_COLOR`). 「언제 정해졌나」 막대처럼 면 · 선에 쓴다. */
export const ROLE_COLOR = {
  decision: "#2a78d6",
  task: "#1baf7a",
  open: "#eb6834",
} as const;
