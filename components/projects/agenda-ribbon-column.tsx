"use client";

import { memo, useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { motion, type TargetAndTransition, type Transition } from "motion/react";

import { Badge } from "@/components/ui/badge";

import type { HoverApi } from "@/components/projects/agenda-ribbon-hover";
import { CHOREO_MS, INSTANT, columnMotion, staggerOf, widthOf } from "@/components/projects/agenda-ribbon-motion";
import { getAppDateKey } from "@/lib/format/date";
import { meetingHeading, shortMeetingDate, type MapAgenda, type MapMeeting } from "@/lib/projects/agenda-map";
import type { RibbonColumn, RibbonLayout, RibbonRoute, RibbonTopic } from "@/lib/projects/agenda-ribbon";
import { cn } from "@/lib/utils";

// ── 치수 ───────────────────────────────────────────────────────────────────────
/** 열 머리(연도 줄 · 날짜 줄 · 회의 이름 줄 · 건수 줄). 접힌 열이든 펼친 열이든 같은 틀이고, 판 위에 따로 붙어 세로 스크롤 때 화면 위에 남는다 */
export const HEAD_H = 78;
/** 머리 글자가 시작하는 높이. 연도 줄(0~16) 아래에서 모든 열이 같다 */
const HEAD_TEXT_TOP = 20;
/** 스크롤 상자 안쪽의 왼쪽·오른쪽 여백. 스크롤 상자는 판 테두리 안쪽 끝까지 쓰고, 이동 버튼은 레이아웃 공간 없이 그 위에 뜬다 */
export const PAD = 12;
/** 가로 스크롤 내용 양 끝의 여유(px). 스크롤 상자 바깥이 아니라 스크롤 내용 안쪽 앞뒤 패딩이라, 맨 왼쪽·맨 오른쪽까지 스크롤했을 때만 빈 여유가 보인다. 열 폭 계산은 `PAD` 를 그대로 쓴다 */
export const BOARD_END_GUTTER = 96;
/**
 * 줄 하나의 치수. `TOP` 머리 띠 아래 첫 줄까지, `P` 줄 높이(갈래 길이 없는 줄), `PT` 갈래 길이 있는 줄의 높이, `Y` 굵은 노선의 높이, `T` 갈래 길의 높이,
 * `SUB` 줄기를 골라 갈래를 모두 펼칠 때 갈래 한 길의 높이, `NAME` 줄기 이름의 위치, `ROW` 점 옆 제목 한 줄의 높이, `FS` 제목 글자 크기,
 * `ZGAP`·`ZHEAD`·`ZROW` 아래 「그 밖의 안건」 구역의 윗 간격·머리·한 줄.
 *
 * 제목 줄(`T - Y`, `SUB`)은 어느 틀에서나 46px 간격이다. 열이 넓어 제목이 보이는 판(`roomy`)은 줄 사이(`TOP`·`P`·`PT`)를 더 성기게 잡아 마지막 줄의 점 아래에서
 * 다음 줄기 이름까지 24px 이상, 줄기 이름과 첫 안건 사이는 8px 이상이다. 제목을 숨기는 좁은 판(`compact`, 회의 수백 개 포함)은 줄 사이만 촘촘하다.
 */
export type Grid = {
  TOP: number;
  P: number;
  PT: number;
  Y: number;
  T: number;
  SUB: number;
  NAME: number;
  ROW: number;
  FS: number;
  ZROW: number;
  ZGAP: number;
  ZHEAD: number;
  LABEL: number;
};
/** 줄 안의 자리(Y·T·SUB·NAME·ROW·FS·LABEL 과 구역 치수)는 두 틀이 같다 — 열을 펼쳐 틀이 바뀔 때 점·선·곡선이 줄 안에서 움직이지 않고 줄 사이 간격(TOP·P·PT)만 변해서, 줄 높이를 열 폭과 같은 트윈으로 연속해서 바꿀 수 있다 */
const INLANE = { Y: 42, T: 88, SUB: 46, NAME: 4, ROW: 22, FS: 13, ZROW: 32, ZGAP: 28, ZHEAD: 32, LABEL: 15 };
/** 줄 사이 간격(TOP·P·PT)도 열을 펼치든 접든 같다 — 틀이 바뀌면 줄 높이·이름표·왼쪽 열의 점과 선이 세로로 움직인다. 줄 높이는 줄기를 고를 때(갈래 펴짐)와 알약 자리에서만 바뀐다 */
export const GRID_ROOMY: Grid = { ...INLANE, TOP: 14, P: 75, PT: 120 };
export const GRID_COMPACT: Grid = GRID_ROOMY;
/** 접힌 안건 알약(「+N」)은 점 아래 따로 행을 쓴다. 알약 높이와 간격(점·다음 행·다음 줄기 이름 사이 8px)은 `laneGeom` 이 줄 높이로 만든다 */
export const PILL_H = 20;
export const PILL_GAP = 8;
/** 알약의 오른쪽 끝이 점 가운데에서 왼쪽으로 떨어진 거리: 점 아래로 곧게 내려가는 갈래 선과 8px(선 굵기 표본 ±1 포함) 이상 */
export const PILL_SIDE = 9;
const CAP_HALF = 12;
/** 좁은 열의 갈고리 표식 크기(점 아래 왼쪽에 붙는다) */
export const HOOK_W = 8;
export const HOOK_H = 9;
/** 갈고리와 아래 갈래 길 점 사이 최소 간격 */
const HOOK_GAP = 4;
/**
 * 접힌 안건 표식이 있는 줄기의 세로 치수. `kind` 가 "pill" 이면 알약 행만큼, "hook" 이면 갈고리만큼 갈래 길(`t`)과 줄 높이(`P`·`PT`)가 늘고 null 이면 틀 그대로다.
 * 갈래 길 위에 앉는 것의 반 높이는 가장 큰 캡슐(12)·펼친 열의 제목 줄(ROW/2) 중 큰 쪽(갈래 길 점은 6.5)으로 잡는다.
 */
export function laneGeom(g: Grid, kind: "pill" | "hook" | null) {
  if (!kind) return { t: g.T, P: g.P, PT: g.PT };
  const reach = Math.max(CAP_HALF, g.ROW / 2);
  const t =
    kind === "pill"
      ? Math.ceil(g.Y + CAP_HALF + PILL_GAP + PILL_H + PILL_GAP + reach)
      : Math.ceil(g.Y + CAP_HALF + HOOK_H - 2 + HOOK_GAP + 6.5);
  const tall = Math.max(g.T, t);
  const bottom = g.Y + CAP_HALF + (kind === "pill" ? PILL_GAP + PILL_H : HOOK_H - 2);
  return { t: tall, P: kind === "pill" ? Math.max(g.P, bottom + PILL_GAP - g.NAME) : g.P, PT: Math.max(g.PT, tall + (g.PT - g.T)) };
}

/** 굵은 노선(그 회의가 다룬 칸)과 가는 선의 굵기. 고른 흐름은 둘 다 한 단계 굵다 */
const RIBBON = 4;
const RIBBON_PICKED = 6;
export const THIN = 1.5;
const THIN_PICKED = 2;
/** 점의 안쪽 지름(테두리 제외). 테두리 2px 를 더하면 14px — 지름 12px 이상 */
const DOT = 12;
/**
 * 열 폭의 아래쪽 한계. 이웃한 점(14px)·캡슐(24px)·알약 사이에 8px 이상 남도록 캡슐 하나와 이웃 점이 들어갈 폭(12 + 8 + 7 + 여유)이다
 */
export const MIN_COL = 28;
/** 접힌 안건 알약(숫자와 함께)이 서는 열 폭의 아래쪽 한계. 이보다 좁은 열은 숫자 없는 갈고리만 서고 개수는 호버 카드에 있다 */
export const PILL_COL = 58;
/** 열 폭의 위쪽 한계. 회의가 몇 개 안 되면 판을 균등하게 채우되 이보다는 넓어지지 않는다 */
export const MAX_COL = 960;
/**
 * 열이 이만큼 넓으면 안건 제목을 기본으로 점 옆에 보인다(눌러서 펼치는 열과 같은 표현). 이보다 좁으면 접어 두고 머리를 눌러 펼친다.
 * 패널이 열려 판이 좁아졌을 때도 같은 기준이다 — 보이는 판 폭 ÷ 회의 수가 이보다 좁으면 제목은 접고 점·캡슐만 남긴다(제목은 호버·패널에서).
 */
export const TITLE_COL = 260;
/** 눌러서 펼친 열의 폭의 기본값(실제 폭은 가장 긴 제목에 맞춘다). 점은 열 폭의 25%, 열 머리 글자는 가운데 */
export const OPEN_W = 220;
/** 펼친 열 아래 「그 밖의 안건」 목록의 왼쪽 들여쓰기 */
export const ZONE_INSET = 24;
export const ACCENT = "var(--el-scope-project)";

export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
/** 캡슐 높이(테두리 제외). 테두리 2px 를 더하면 20~24px — 높이 20px 이상 */
const capHeight = (count: number) => (count <= 2 ? 18 : count === 3 ? 20 : 22);
const capWidth = (count: number, height: number, col: number) =>
  Math.max(height, (col >= 30 ? height + 8 : height) + (String(count).length - 1) * 7);

export type StopLike = { meeting: number; agendas: MapAgenda[] };

export type Paint = { ribbon: string; thin: string; stroke: string; text: string; ribbonW: number; thinW: number };
/** 이어짐 선의 색: 판 배경(#fafafa)과 3:1 이상 */
export const LINE = "color-mix(in srgb, var(--el-muted) 82%, #fafafa)";
export const NORMAL: Paint = { ribbon: LINE, thin: LINE, stroke: "var(--el-muted)", text: "var(--el-ink)", ribbonW: RIBBON, thinW: THIN };
/** 고른 흐름: 강조색은 여기에만 쓰고, 색뿐 아니라 선 굵기로도 구분한다 */
const PICKED: Paint = {
  ribbon: `color-mix(in srgb, ${ACCENT} 78%, #fafafa)`,
  thin: ACCENT,
  stroke: ACCENT,
  text: ACCENT,
  ribbonW: RIBBON_PICKED,
  thinW: THIN_PICKED,
};
/** 고른 점 둘레의 고리 — 색뿐 아니라 크기로도 눈에 띄게 */
const RING = `0 0 0 3px color-mix(in srgb, ${ACCENT} 28%, transparent)`;

/** 점·캡슐 하나의 치수. 열 안의 점과 범례의 기호가 같은 모양이도록 한 곳에서 낸다. `outer` 는 테두리를 포함한 높이 */
export function stopMetrics(n: number, small: boolean, col: number) {
  // 갈래 길의 점·캡슐도 지름 12px·높이 20px 아래로 줄이지 않는다(테두리 포함)
  const h = small ? (n > 1 ? 19 : 0) : n > 1 ? capHeight(n) : 0;
  const w = small ? Math.max(h, 19 + (String(n).length - 1) * 7) : capWidth(n, h, col);
  const radius = small ? 5.5 : DOT / 2;
  const stroke = small ? 1.5 : 2;
  return { h, w, radius, stroke, half: (n > 1 ? w : radius * 2) / 2, outer: n > 1 ? h + stroke : radius * 2 + stroke };
}

/** 점(안건 하나) 또는 숫자 캡슐(안건 여럿). 가운데 기준으로 놓이고, 놓는 자리는 `className` 이 정한다 */
export function StopGlyph({
  n,
  small = false,
  col,
  on = false,
  paint = NORMAL,
  className,
}: {
  n: number;
  small?: boolean;
  col: number;
  on?: boolean;
  paint?: Paint;
  className?: string;
}) {
  const { h, w, radius, stroke } = stopMetrics(n, small, col);
  const face = on ? ACCENT : "var(--el-surface-card)";
  const line = on ? ACCENT : paint.stroke;
  return n > 1 ? (
    // 숫자 캡슐은 선 위에 올라가는 표식이라 `Badge`(outline)에 판 바탕 토큰을 깐다. 점과 한 쌍이라 둥근 알약(`rounded-full`)으로 둔다
    <Badge
      variant="outline"
      aria-hidden
      className={cn(
        "justify-center rounded-full border-solid bg-[var(--el-surface-card)] px-0 py-0 font-semibold tabular-nums transition-colors duration-75 motion-reduce:transition-none",
        className
      )}
      style={{
        width: w + stroke,
        height: h + stroke,
        borderWidth: stroke,
        borderColor: line,
        background: face,
        color: on ? "#fff" : paint.text,
        fontSize: 12,
        lineHeight: 1,
        boxShadow: on ? RING : undefined,
      }}
    >
      {n}
    </Badge>
  ) : (
    <span
      aria-hidden
      className={cn("rounded-full border-solid transition-colors duration-75 motion-reduce:transition-none", className)}
      style={{
        width: radius * 2 + stroke,
        height: radius * 2 + stroke,
        borderWidth: stroke,
        borderColor: line,
        background: face,
        boxShadow: on ? RING : undefined,
      }}
    />
  );
}

/** 앞 안건이 둘인 점의 표식: 다른 줄에서 오는 이어짐이 하나 더 있다. 점 가운데를 원점으로 그린다 */
export function JoinMark({ half, className }: { half: number; className?: string }) {
  return (
    <svg aria-hidden width={0} height={0} className={cn("overflow-visible", className)} stroke="var(--el-muted)" fill="var(--el-surface-card)">
      <path d={`M${-half - 1},-3 L${-half - 6},-9`} fill="none" strokeWidth={1.5} strokeDasharray="2 1.5" />
      <circle cx={-half - 7.5} cy={-10.5} r={2.5} strokeWidth={1.5} />
    </svg>
  );
}

/** 갈래 곡선: 갈라진 점에서 갈래 길로 비스듬히 내려앉는다(원점 = 갈라진 점) */
export const forkPath = (run: number, drop: number, down = true) =>
  `M0,${down ? 0 : drop} C${run / 2},${down ? 0 : drop} ${run / 2},${down ? drop : 0} ${run},${down ? drop : 0}`;

/**
 * 「+N」 접힌 갈래 표식. `Badge`(outline) 위에 판 바탕 토큰을 깔아 선·점 위에서 글자가 선과 겹치지 않는다. 클릭할 수 있는 곳은 `render` 로 `button` 이 된다.
 * 올리면(호버) 바탕과 테두리색이 바뀌고 테두리 바깥에 1px 선이 더해져 색뿐 아니라 굵기로도 구분된다.
 */
export function FoldPill({ folded, className, ...props }: { folded: number } & React.ComponentProps<typeof Badge>) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 border-[var(--el-muted)] bg-[var(--el-surface-card)] px-1.5 font-semibold text-[var(--el-ink)] tabular-nums",
        "hover:border-[var(--el-ink)] hover:bg-[var(--el-surface-strong)] hover:shadow-[0_0_0_1px_var(--el-ink)]",
        className
      )}
      {...props}
    >
      +{folded}
    </Badge>
  );
}

export type ColumnProps = {
  at: number;
  meeting: MapMeeting;
  data: RibbonColumn;
  layout: RibbonLayout;
  joinTargets: ReadonlySet<string>;
  /** 이 회의에서 줄 위에 서지 않는 안건(이어짐 없음 + 접힌 갈래) */
  zone: readonly MapAgenda[];
  g: Grid;
  /** 줄마다 갈래 길의 높이(알약이 있는 줄기는 더 아래) */
  laneT: readonly number[];
  width: number;
  /** 접힌 열의 폭 */
  col: number;
  /** 안건 제목이 점 옆에 서는 열(눌러서 펼쳤거나 자동으로 펼쳐진 열) */
  open: boolean;
  selected: boolean;
  /** 판의 첫 열(1)·마지막 열(2). 판 테두리와 겹치는 쪽에는 면의 테두리선을 긋지 않는다 */
  edge: number;
  monthEdge: boolean;
  /** 고른 주제(이 열에 그릴 것이 있을 때만) */
  topicId: string | null;
  /** 고른 안건(이 열에 있을 때만) */
  agendaId: string | null;
  /** 이동 없이 바로 바꾼다: 움직임 줄이기 설정이거나, 사용자가 누른 열이 아닌 재배치(창 크기)일 때 */
  instant: boolean;
  /** 움직임 줄이기: 폭·이동 없이 내용만 짧게 크로스페이드한다 */
  reduced: boolean;
  /** 안건 제목을 보인다. 판이 좁아 접으면 점·캡슐만 남고(열의 모양은 그대로) 제목이 옅어진다 */
  titles: boolean;
  /** 방향키로 오가는 점의 키(roving tabindex): 이 열에 있을 때만 값이 있고, 그 점만 탭으로 들어와 선다 */
  rove: string | null;
};

/** 제목이 보이는 펼친 열에서는 가는 선이 제목 줄(글자 뒤의 선)로 이어지니 점 뒤의 가는 선은 그만큼 옅어진다. `--ti` 는 제목이 보이는 정도(0~1), `--c` 는 그 줄기의 펼친 내용이 나타난 정도(0~1)다 —
 * 제목이 나타나기 시작하면(17%) 점 뒤의 가는 선은 이미 물러나 있어서 줄기 선이 도중에 끊기지 않는다 */
const NO_TITLE = "clamp(0, calc(1 - 6 * var(--c, 1) * var(--o) * var(--ti)), 1)";

/** 열의 면 가장자리 선. 펼친 정도(`--o`)에 따라 옅어졌다 진해진다 */
const EDGE_LINE = "color-mix(in srgb, var(--el-hairline-strong) calc(var(--o) * 100%), transparent)";
const edgeShadow = (edge: number) =>
  [edge & 1 ? null : `inset 1px 0 0 ${EDGE_LINE}`, edge & 2 ? null : `inset -1px 0 0 ${EDGE_LINE}`].filter(Boolean).join(",") || undefined;
/** 열의 면 바탕은 없다(투명): 줄기 행의 줄무늬가 열을 가로질러 이어지고, 열이 열려 있음은 좌우 1px 경계선과 머리 아래 강조선이 보인다 */
const FACE = undefined;

/** 옛 모양 층을 남겨 두는 시간(ms) */
const TRAIL_MS = CHOREO_MS;

type Lane = { topic: string; lines: ReactNode[]; nodes: ReactNode[]; titles: ReactNode[] };

/**
 * 열 하나(판의 몸). 접힌 모양(점이 열 폭의 50%)과 펼친 모양(점이 25%, 제목이 오른쪽에 한 줄)은 **서로 다른 층**이고, 각 층은 자기 점 자리를 px 로 쥐고 있다(`--cx`).
 * 그래서 폭이 늘고 줄어드는 동안 점·캡슐·제목·알약은 가로로 움직이지 않는다 — 접힌 층은 그 자리에서 옅어지고 펼친 층은 최종 자리에 놓인 채 옅게 나타난다.
 * 가로 선은 열 오른쪽 끝에 붙어 있어 폭이 늘어난 만큼 그냥 길어진다. 전환이 끝나면 한 층만 남는다(전환 중에만 둘 다 그린다).
 * 열 폭·면(`--o`)·층의 투명도(`--oc`·`--lc`·`--oo`·`--lo`)만 `motion` 이 움직이고(`columnMotion`), 안의 요소는 따로 애니메이션하지 않는다.
 * 줄의 세로 자리는 판이 내려 주는 `--lt-N` 변수라 줄기를 골라 줄이 길어져도 이 열은 다시 그리지 않는다. 열 머리는 `HeadColumn` 이 판 위에 따로 그리고 같은 트윈으로 폭을 따라간다.
 */
export const Column = memo(function Column(props: ColumnProps) {
  const { at, meeting, data, layout, joinTargets, zone, g, laneT, width, col, open, selected, edge, monthEdge, topicId, agendaId, instant, reduced, titles, rove } = props;

  const date = shortMeetingDate(meeting.startedAt);
  /** 접힌 열에서 굵은 선이 점 양옆으로 닿는 길이, 갈래 곡선이 점에서 빠지는 길이 */
  const reachClosed = clamp(col * 0.3, 5, 22);
  const runClosed = clamp(Math.floor(col / 2) - 2, 8, 44);

  // 모양이 바뀌는 중에는 옛 모양 층을 남겨 둔다(끝나면 타이머가 거둔다). 펼친 폭은 접는 동안에도 펼친 층이 쥐고 있어야 한다
  const [shown, setShown] = useState(open);
  const [trail, setTrail] = useState(false);
  const [openW, setOpenW] = useState(width);
  if (shown !== open) {
    setShown(open);
    setTrail(reduced || !instant);
  }
  if (open && openW !== width) setOpenW(width);
  // 옛 모양 층은 안무가 끝난 뒤(펼침 최대 약 320ms · 접힘 260ms)에 거둔다. 도중에 다시 눌러 모양이 또 바뀌면 시간을 다시 잰다
  useEffect(() => {
    if (!trail) return;
    const timer = window.setTimeout(() => setTrail(false), TRAIL_MS);
    return () => window.clearTimeout(timer);
  }, [trail, shown]);

  const yOf = (route: RibbonRoute, topic: RibbonTopic) =>
    route === topic.main ? g.Y : laneT[topic.lane] + (topicId === topic.id ? (topic.sub.get(route.id) ?? 0) : 0) * g.SUB;

  const piece = (key: string, y: number, h: number, style: CSSProperties) => (
    <div key={key} aria-hidden className="absolute" style={{ top: y - h / 2, height: h, ...style }} />
  );
  const thin = (key: string, y: number, left: string, rest: { right?: string; width?: string; opacity?: string }, paint: Paint) =>
    piece(key, y, paint.thinW, { left, background: paint.thin, ...rest });

  /** 한 모양(`mode`)의 줄기별 요소. 선(`lines`)과 점·곡선·제목(`nodes`·`titles`)은 서로 다른 시간표로 옅어지고 나타나서 따로 모은다 */
  const build = (mode: "closed" | "open") => {
    const isOpen = mode === "open";
    const lanes = new Map<number, Lane>();
    const laneOf = (topic: RibbonTopic) => {
      let lane = lanes.get(topic.lane);
      if (!lane) lanes.set(topic.lane, (lane = { topic: topic.id, lines: [], nodes: [], titles: [] }));
      return lane;
    };

    // 갈래 길은 줄기를 고르기 전까지 한 줄(`laneT`)을 같이 쓴다. 그 줄에 이 열의 제목 줄이 서면, 같은 줄을 지나가는 다른 갈래의 선(곡선 뒤 이어지는 선·지나가는 선)이
    // 제목 글자를 가로지르지 않게 글자 앞에서 끊고 글자 뒤 선이 대신 이어 준다(`NO_TITLE`)
    const rowKey = (topic: RibbonTopic, y: number) => `${topic.lane}:${y}`;
    const titleRows = new Set<string>();
    const carried = new Set<string>();
    if (isOpen) for (const cell of data.cells) if (!(cell.route.kind === "folded" && topicId !== cell.topic.id)) titleRows.add(rowKey(cell.topic, yOf(cell.route, cell.topic)));
    for (const fork of data.forks) if (fork.first !== at && !(fork.route.kind === "folded" && topicId !== fork.topic.id)) carried.add(rowKey(fork.topic, yOf(fork.route, fork.topic)));
    for (const pass of data.passes) if (!(pass.route.kind === "folded" && topicId !== pass.topic.id)) carried.add(rowKey(pass.topic, yOf(pass.route, pass.topic)));

    for (const cell of data.cells) {
      const { topic, route, stop } = cell;
      if (route.kind === "folded" && topicId !== topic.id) continue;
      const lane = laneOf(topic);
      const picked = topicId === topic.id;
      const paint = picked ? PICKED : NORMAL;
      const branch = route !== topic.main;
      const y = yOf(route, topic);

      // ── 선. 굵기는 데이터로만 정한다(열이 접혔든 펼쳤든 같다): 앞뒤로 바로 이어진 회의(둘 다에 이 줄기의 안건이 있다)와의 구간은 굵은 선(`ext`), 회의를 건너뛴 구간은 가는 선이고,
      // 점 둘레의 짧은 굵은 막대(`thick`)는 두 모양에서 같은 길이다. 펼친 모양에서 점 뒤 구간은 제목 줄이 이어 주고(글자 뒤 선도 같은 굵기), 제목이 안 보일 때만(`NO_TITLE`) 점 뒤에 직접 그린다
      const nextAdj = cell.next !== null && cell.next - stop.meeting === 1;
      const prevAdj = cell.prev !== null && stop.meeting - cell.prev === 1;
      if (!branch) {
        lane.nodes.push(
          piece(`${cell.key}:thick`, y, paint.ribbonW, {
            left: "calc(var(--cx) - var(--r))",
            width: "calc(var(--r) * 2)",
            background: paint.ribbon,
            borderRadius: paint.ribbonW / 2,
          })
        );
        if (prevAdj) lane.lines.push(piece(`${cell.key}:ext-in`, y, paint.ribbonW, { left: 0, width: "var(--cx)", background: paint.ribbon }));
        else if (cell.prev !== null) lane.lines.push(thin(`${cell.key}:in`, y, "0px", { width: "calc(var(--cx) - var(--r))" }, paint));
        if (nextAdj) lane.lines.push(piece(`${cell.key}:ext-out`, y, paint.ribbonW, { left: "var(--cx)", right: 0, background: paint.ribbon, opacity: NO_TITLE }));
        else if (cell.next !== null) lane.lines.push(thin(`${cell.key}:out`, y, "calc(var(--cx) + var(--r))", { right: "0px", opacity: NO_TITLE }, paint));
      } else {
        if (cell.prev !== null) lane.lines.push(thin(`${cell.key}:in`, y, "0px", { width: "var(--cx)" }, paint));
        if (cell.next !== null) lane.lines.push(thin(`${cell.key}:out`, y, "var(--cx)", { right: "0px", opacity: NO_TITLE }, paint));
      }

      // ── 점·캡슐
      const n = stop.agendas.length;
      const small = branch;
      const on = agendaId !== null && stop.agendas.some((agenda) => agenda.agendaId === agendaId);
      const { w, half, outer } = stopMetrics(n, small, col);
      const hitW = Math.max(w, 14) + 8;
      const hitH = Math.max(28, outer + 8);
      const ring = [Math.max(w, 14) + 10, outer + 10];
      const joined = stop.agendas.some((agenda) => joinTargets.has(agenda.agendaId));
      const folded = !picked && !branch ? stop.agendas.reduce((sum, agenda) => sum + (layout.folded.get(agenda.agendaId) ?? 0), 0) : 0;
      const shownAgenda = stop.agendas.find((agenda) => agenda.agendaId === agendaId) ?? stop.agendas[0];

      lane.nodes.push(
        <div
          key={cell.key}
          data-stop={cell.key}
          data-members={stop.agendas.map((agenda) => agenda.agendaId).join(" ")}
          role="button"
          tabIndex={rove === cell.key ? 0 : -1}
          aria-pressed={on}
          aria-label={`${date} ${stop.agendas.map((agenda) => agenda.title).join(", ")}`}
          className="group/stop pointer-events-auto absolute z-[1] cursor-pointer outline-none"
          style={{ left: `calc(var(--cx) - ${hitW / 2}px)`, top: y - hitH / 2, width: hitW, height: hitH }}
        >
          {/* 올리면 고리 */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--el-scope-project)] opacity-0 transition-opacity duration-75 group-hover/stop:opacity-60 group-focus-visible/stop:opacity-100 motion-reduce:transition-none"
            style={{ width: ring[0], height: ring[1] }}
          />
          <StopGlyph
            n={n}
            small={small}
            col={col}
            on={on}
            paint={paint}
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          />
          {joined ? <JoinMark half={half} className="pointer-events-none absolute top-1/2 left-1/2" /> : null}
          {folded > 0 ? (
            <FoldBadge folded={folded} hitW={hitW} hitH={hitH} outer={outer} rowHalf={g.ROW / 2} open={isOpen} narrow={!isOpen && col < PILL_COL} stroke={paint.stroke} line={paint.thin} />
          ) : null}
        </div>
      );

      if (isOpen) {
        // 제목 줄: 점(펼친 열은 열 폭의 25%) 오른쪽에 선다. 점·캡슐(테두리 포함 half+1) 끝에서 8px 띄운 한 줄 글자(열 폭이 가장 긴 제목에 맞춰 넓어져 있어 말줄임은 극단적인 제목뿐), 그 뒤 8px 띄운 가는 선.
        // 글자 뒤에 바탕을 깔지 않고 선이 글자에 닿지 않는다
        const textOffset = Math.max(half + 9, reachClosed + 8);
        lane.titles.push(
          <div
            key={cell.key}
            aria-hidden
            className="absolute flex items-center gap-2"
            style={{ left: `calc(var(--cx) + ${textOffset}px)`, right: 0, top: y - g.ROW / 2, height: g.ROW, fontSize: g.FS, opacity: "var(--ti)" }}
          >
            <button
              type="button"
              tabIndex={-1}
              data-stop={cell.key}
              data-title=""
              className={cn("group/title flex min-w-0 items-center gap-1 text-left", titles ? "pointer-events-auto" : "pointer-events-none")}
            >
              <span
                className={cn(
                  "min-w-0 truncate group-hover/title:underline",
                  // 안건 제목은 줄기 이름(진한 잉크·한 단계 큰 글자)보다 한 단계 옅고 보통 굵기다
                  on ? "font-semibold text-[var(--el-scope-project)]" : small ? SUBTLE : "text-[var(--el-body)]"
                )}
                style={{ lineHeight: `${g.ROW}px` }}
              >
                {shownAgenda.title}
              </span>
              {n > 1 ? <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">외 {n - 1}</span> : null}
            </button>
            {cell.next !== null || carried.has(rowKey(topic, y)) ? (
              <span className="min-w-0 flex-1" style={!branch && nextAdj ? { height: paint.ribbonW, background: paint.ribbon, borderRadius: paint.ribbonW / 2 } : { height: paint.thinW, background: paint.thin }} />
            ) : null}
          </div>
        );
      }
    }

    for (const pass of data.passes) {
      if (pass.route.kind === "folded" && topicId !== pass.topic.id) continue;
      const lane = laneOf(pass.topic);
      const paint = topicId === pass.topic.id ? PICKED : NORMAL;
      const y = yOf(pass.route, pass.topic);
      if (titleRows.has(rowKey(pass.topic, y)))
        lane.lines.push(
          thin(`${pass.key}:l`, y, "0px", { width: "calc(var(--cx) - var(--r))" }, paint),
          thin(pass.key, y, "calc(var(--cx) + var(--r))", { right: "0px", opacity: NO_TITLE }, paint)
        );
      else lane.lines.push(thin(pass.key, y, "0px", { right: "0px" }, paint));
    }

    // 갈래 곡선: 갈라진 점에서 갈래 길로 내려앉고, 그 뒤는 길 위를 수평으로 간다
    for (const fork of data.forks) {
      const { topic, route } = fork;
      if (route.kind === "folded" && topicId !== topic.id) continue;
      const lane = laneOf(topic);
      const paint = topicId === topic.id ? PICKED : NORMAL;
      const y0 = fork.parent && fork.parent !== topic.main ? yOf(fork.parent, topic) : g.Y;
      const yb = yOf(route, topic);
      const [top, drop] = [Math.min(y0, yb), Math.abs(yb - y0)];
      const down = yb >= y0;
      if (fork.first === at) {
        lane.nodes.push(piece(`${fork.key}:drop`, top + drop / 2, drop, { left: `calc(var(--cx) - ${paint.thinW / 2}px)`, width: paint.thinW, background: paint.thin }));
        continue;
      }
      // 접힌 모양은 점에서 비스듬히 빠지고, 펼친 모양은 점 옆에 제목이 서니 점 바로 아래로 내려서 간다
      lane.nodes.push(
        isOpen ? (
          <svg key={`${fork.key}:curve-o`} aria-hidden width={10} height={drop} className="pointer-events-none absolute overflow-visible" style={{ left: "var(--cx)", top }}>
            <path d={`M0,6 L0,${drop - 8} Q0,${drop} 8,${drop}`} fill="none" stroke={paint.thin} strokeWidth={paint.thinW} />
          </svg>
        ) : (
          <svg key={`${fork.key}:curve-c`} aria-hidden width={runClosed + 1} height={drop} className="pointer-events-none absolute overflow-visible" style={{ left: "var(--cx)", top }}>
            <path d={forkPath(runClosed, drop, down)} fill="none" stroke={paint.thin} strokeWidth={paint.thinW} />
          </svg>
        )
      );
      lane.lines.push(thin(`${fork.key}:lead`, yb, "calc(var(--cx) + var(--run))", { right: "0px", ...(titleRows.has(rowKey(topic, yb)) ? { opacity: NO_TITLE } : null) }, paint));
    }
    return lanes;
  };

  const { step, total } = staggerOf();

  const layer = (mode: "closed" | "open") => {
    const isOpen = mode === "open";
    const lanes = build(mode);
    const order = [...lanes.keys()].sort((a, b) => a - b);
    const current = isOpen === open;
    return (
      <div
        key={mode}
        data-layer={mode}
        // 지나가는 옛 모양은 눌리지도 읽히지도 않는다
        inert={!current}
        className="pointer-events-none absolute inset-0"
        style={
          {
                        "--o": isOpen ? 1 : 0,
            // 점의 가운데는 이 모양이 쥔 px 자리다: 접힌 모양은 접힌 폭의 가운데, 펼친 모양은 펼친 폭의 25%
            "--cx": isOpen ? `${openW * 0.25}px` : `${col / 2}px`,
            "--r": `${reachClosed}px`,
            "--run": isOpen ? "8px" : `${runClosed}px`,
          } as CSSProperties
        }
      >
        {order.map((lane, k) => {
          const entry = lanes.get(lane)!;
          const content = isOpen ? `clamp(0, calc((var(--oo) * ${total} - ${k * step}) / ${160}), 1)` : undefined;
          return (
            <div
              key={lane}
              data-topic={entry.topic}
              data-lane={lane}
              data-on={topicId === entry.topic ? "" : undefined}
              className="pointer-events-none absolute top-0 left-0 h-0 w-full"
              style={{ transform: `translateY(calc(var(--lt-${lane}) * 1px))`, ...(content ? ({ "--c": content } as CSSProperties) : null) }}
            >
              <div className="absolute inset-0" style={{ opacity: isOpen ? "var(--lo)" : "var(--lc)" }}>
                {entry.lines}
              </div>
              <div className="absolute inset-0" style={{ opacity: isOpen ? "var(--c)" : "var(--oc)" }}>
                {entry.nodes}
                {entry.titles.length > 0 ? <div className="absolute inset-x-0 top-0 h-0 overflow-x-clip">{entry.titles}</div> : null}
              </div>
            </div>
          );
        })}
        {isOpen && zone.length > 0 ? (
          <div className="absolute inset-0" style={{ opacity: `clamp(0, calc((var(--oo) * ${total} - ${order.length * step}) / ${160}), 1)` }}>
            <Zone zone={zone} layout={layout} topicId={topicId} agendaId={agendaId} g={g} />
          </div>
        ) : null}
      </div>
    );
  };

  // 열 폭·면·층의 투명도만 `motion` 이 움직인다. `initial={false}` 라 처음 화면은 움직이지 않는다
  const animate = {
    width,
    "--o": open ? 1 : 0,
    "--ti": titles ? 1 : 0,
    "--oc": open ? 0 : 1,
    "--lc": open ? 0 : 1,
    "--oo": open ? 1 : 0,
    "--lo": open ? 1 : 0,
  } as TargetAndTransition;
  const motionOf = columnMotion(open, instant, reduced);
  return (
    <motion.div
      initial={false}
      animate={animate}
      transition={(instant && !reduced ? INSTANT : { default: INSTANT, ...(motionOf as object) }) as Transition}
      className="relative h-full shrink-0 [contain:layout_style]"
      style={{ background: FACE, boxShadow: edgeShadow(edge) } as CSSProperties}
    >
      {monthEdge ? (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 left-0 w-px bg-[repeating-linear-gradient(to_bottom,var(--el-hairline-strong)_0_2px,transparent_2px_6px)]"
        />
      ) : null}
      {selected ? <div aria-hidden className="pointer-events-none absolute inset-0 bg-[color-mix(in_srgb,var(--el-scope-project)_6%,transparent)]" /> : null}
      {trail || !open ? layer("closed") : null}
      {trail || open ? layer("open") : null}
    </motion.div>
  );
});

/**
 * 접힌 갈래 표식. 올리면 숨은 안건이 미리 보이고, 누르면 펼쳐진다. 알약(`Badge`)은 점 아래 왼쪽 **따로 행**에 놓이고 ㄴ자 가는 선이 점과 알약을 이어, 어느 점의 것인지 한눈에 보인다.
 * 점·선·다른 알약과는 8px 이상 떨어진다(줄 높이가 `laneGeom` 으로 그만큼 늘어 있다). 열이 알약이 못 들어갈 만큼 좁으면(`PILL_COL` 아래) 숫자 없는 갈고리만 남는다.
 */
function FoldBadge({
  folded,
  hitW,
  hitH,
  outer,
  rowHalf,
  open,
  narrow,
  stroke,
  line,
}: {
  folded: number;
  hitW: number;
  hitH: number;
  outer: number;
  /** 펼친 열에서 점 옆 제목 줄의 반 높이 */
  rowHalf: number;
  open: boolean;
  narrow: boolean;
  stroke: string;
  line: string;
}) {
  const label = `접힌 안건 ${folded}개 보기`;
  if (narrow)
    return (
      <span
        data-fold=""
        role="button"
        tabIndex={0}
        aria-label={label}
        className="absolute cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-ink)]"
        style={{ left: hitW / 2 - HOOK_W, top: hitH / 2 + outer / 2 - 2, width: HOOK_W, height: HOOK_H }}
      >
        <svg aria-hidden width={HOOK_W} height={HOOK_H} className="pointer-events-none overflow-visible">
          <path d="M7,2 q-1,5 -5,6" fill="none" stroke={stroke} strokeWidth={1.5} />
        </svg>
      </span>
    );
  // 알약은 점(·펼친 열은 점 옆 제목 줄) 아래 8px 행에 선다. 접혔든 펼쳤든 같은 자리다: 점 가운데에서 왼쪽으로 9px 비켜 서서
  // 점에서 곧게 내려가는 갈래 선(펼친 열)·오른쪽 아래로 빠지는 갈래 곡선(접힌 열) 어느 쪽과도 8px 이상 떨어진다
  const top = hitH / 2 + Math.max(outer / 2, open ? rowHalf : 0) + PILL_GAP;
  // 점에서 알약으로 가는 가는 선: 점 바로 아래로 내려가 알약 가운데 높이에서 꺾여 알약 끝(바탕 뒤 3px 까지)으로 이어진다 — 어느 점의 것인지 한눈에 보인다
  const dotBottom = hitH / 2 + outer / 2;
  const drop = top + PILL_H / 2 - dotBottom;
  return (
    <>
      <svg
        aria-hidden
        width={PILL_SIDE + 3 + THIN}
        height={drop + THIN}
        className="pointer-events-none absolute overflow-visible"
        style={{ left: hitW / 2 - PILL_SIDE - 3, top: dotBottom }}
      >
        <path d={`M${PILL_SIDE + 3},0 V${drop} H0`} fill="none" stroke={line} strokeWidth={THIN} />
      </svg>
      <FoldPill
        folded={folded}
        render={<button type="button" data-fold="" aria-label={label} />}
        className="absolute z-[2] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-ink)]"
        style={{ right: hitW / 2 + PILL_SIDE, top }}
      />
    </>
  );
}

/** 열을 펼쳤을 때 아래에 나열하는 이어짐 없는 안건과 접힌 갈래의 안건 */
function Zone({
  zone,
  layout,
  topicId,
  agendaId,
  g,
}: {
  zone: readonly MapAgenda[];
  layout: RibbonLayout;
  topicId: string | null;
  agendaId: string | null;
  g: Grid;
}) {
  const rows = zoneRowsOf(zone, layout, topicId);
  if (rows.length === 0) return null;
  return (
    <div
      data-zone=""
      className="pointer-events-none absolute top-0 left-0 w-full"
      style={{ transform: "translateY(calc(var(--zt) * 1px))" }}
    >
      {rows.map((agenda, row) => {
        const on = agendaId === agenda.agendaId;
        const topic = layout.topicOfAgenda.get(agenda.agendaId) ?? null;
        return (
          <button
            key={agenda.agendaId}
            type="button"
            data-stop={`x:${agenda.agendaId}`}
            data-topic={topic?.id ?? "-"}
            data-on={topicId !== null && topic?.id === topicId ? "" : undefined}
            aria-pressed={on}
            className="group/extra pointer-events-auto absolute z-[4] flex items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-[var(--el-ink)]"
            style={{ left: ZONE_INSET - 5, top: g.ZHEAD + row * g.ZROW, height: g.ZROW, width: `calc(100% - ${ZONE_INSET - 5 + 8}px)` }}
          >
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-xs border-[1.5px] border-[var(--el-muted)]"
              style={on ? { background: ACCENT, borderColor: ACCENT } : undefined}
            />
            <span
              className={cn("min-w-0 truncate group-hover/extra:underline", on ? "font-semibold text-[var(--el-ink)]" : "text-[var(--el-body)]")}
              style={{ fontSize: g.FS }}
            >
              {agenda.title}
            </span>
            {topic ? (
              <Badge variant="outline" className="text-[var(--el-muted)]">
                갈래
              </Badge>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** 줄기를 고르면 접혀 있던 갈래가 줄에 선다. 그 안건은 아래 구역에서 뺀다 */
export function zoneRowsOf(zone: readonly MapAgenda[], layout: RibbonLayout, topicId: string | null) {
  const topic = topicId ? layout.topicById.get(topicId) : undefined;
  if (!topic) return zone;
  const unfolded = new Set(
    topic.routes
      .filter((route) => route.kind === "folded")
      .flatMap((route) => route.stops.flatMap((stop) => stop.agendas.map((agenda) => agenda.agendaId)))
  );
  return zone.filter((agenda) => !unfolded.has(agenda.agendaId));
}

// ── 열 머리 ───────────────────────────────────────────────────────────────────

/** 보조 글자(건수·간격)의 색: 판 배경과 4.5:1 이상 */
const SUBTLE = "text-[color-mix(in_srgb,var(--el-muted)_85%,var(--el-ink))]";

export type HeadColumnProps = {
  at: number;
  meeting: MapMeeting;
  width: number;
  open: boolean;
  /** 머리를 눌러 펼치고 접을 수 있는 열. 자동으로 펼쳐진 열은 그럴 필요가 없다 */
  toggle: boolean;
  selected: boolean;
  edge: number;
  markText: string;
  markTop: number;
  markStrong: boolean;
  total: number;
  linked: number;
  /** 앞 회의에서 며칠 뒤인가. 첫 회의는 null */
  days: number | null;
  hover: RefObject<HoverApi | null>;
  onToggle: (noteId: string, at: number) => void;
  /** 이동 없이 바로 바꾼다(`Column` 과 같은 값) */
  instant: boolean;
};

/**
 * 열 머리 한 칸: 해·달 눈금, 날짜(굵게)·회의 이름·건수, 고른 회의의 강조. 판 위에 붙은 머리 띠 안에서 판과 같은 가로 자리를 쓴다.
 * 접힌 열은 날짜·회의 이름·안건 수(옆 칸 막대 = 그중 이어진 안건)이고, 펼친 열은 날짜·「안건 N · 이어짐 M」·회의 이름이다. 열이 좁아지면(회의가 많으면)
 * 글자를 줄이고 막대만 남긴다. 눌리는 면은 늘 열 폭 전체다. 같은 날짜가 이어지면 「+N일」로 구분된다. 열 폭과 면의 바탕은 아래 열(`Column`)과 같은 스프링으로 움직이고,
 * 접힘 ↔ 펼침으로 글이 바뀔 때는 바로 바뀐다.
 */
export const HeadColumn = memo(function HeadColumn({
  at,
  meeting,
  width,
  open,
  toggle,
  selected,
  edge,
  markText,
  markTop,
  markStrong,
  total,
  linked,
  days,
  hover,
  onToggle,
  instant,
}: HeadColumnProps) {
  const date = shortMeetingDate(meeting.startedAt);
  const day = String(Number(getAppDateKey(meeting.startedAt).slice(8, 10)));
  const heading = meetingHeading(meeting.title);
  const tip = {
    title: `${date} ${heading}`,
    text: `안건 ${total}개 · 이어진 안건 ${linked}개${toggle ? ` · ${open ? "눌러서 접기" : "눌러서 펼치기"}` : ""}`,
  };
  const show = (event: { currentTarget: Element }) => hover.current?.show({ rect: event.currentTarget.getBoundingClientRect(), el: event.currentTarget, tip });
  const hide = () => hover.current?.hide();
  const mode = open ? "o" : width >= 60 ? "c" : width >= 34 ? "n" : "t";
  const rows =
    mode === "o" ? (
      <>
        <span className="flex h-[18px] items-baseline justify-center gap-1.5 text-xs leading-[18px] whitespace-nowrap tabular-nums">
          <span className="text-[13px] font-bold text-[var(--el-ink)]">{date}</span>
          {days !== null ? <span className={SUBTLE}>+{days}일</span> : null}
        </span>
        <span className="mt-px block h-4 max-w-full truncate text-xs leading-4 text-[var(--el-body)]">{heading}</span>
        <span className={cn("mt-0.5 block h-4 text-xs leading-4 whitespace-nowrap tabular-nums", SUBTLE)}>
          안건 {total} · 이어짐 {linked}
        </span>
      </>
    ) : mode === "c" ? (
      <>
        <span className="flex h-[18px] items-baseline justify-center gap-1 text-[13px] leading-[18px] whitespace-nowrap tabular-nums">
          <span className="font-bold text-[var(--el-ink)]">{date}</span>
          {days !== null && width >= 84 ? <span className={cn("text-xs font-normal", SUBTLE)}>+{days}일</span> : null}
        </span>
        <span className="mt-px block h-4 max-w-full truncate text-xs leading-4 text-[var(--el-body)]">{heading}</span>
        <span className={cn("mt-0.5 flex h-4 items-center gap-1 text-xs leading-4 tabular-nums", SUBTLE)}>
          {total}
          <Ticks total={total} linked={linked} />
        </span>
      </>
    ) : mode === "n" ? (
      <>
        <span className="block h-[18px] text-xs leading-[18px] font-semibold text-[var(--el-body)] tabular-nums">{day}</span>
        <span className="mt-0.5 flex h-4 items-center">
          <Ticks total={total} linked={linked} />
        </span>
      </>
    ) : (
      // 아주 좁은 열: 안건 수만큼 높은 막대 하나, 진한 아래쪽이 이어진 안건
      <span
        aria-hidden
        className="absolute bottom-[8px] left-1/2 flex w-1 -translate-x-1/2 flex-col justify-end overflow-hidden rounded-[1px] bg-[var(--el-hairline-strong)]"
        style={{ height: clamp(6 + total * 2, 8, 22) }}
      >
        <span className="bg-[var(--el-muted)]" style={{ height: `${(linked / Math.max(1, total)) * 100}%` }} />
      </span>
    );
  // 펼친 머리도 접혔을 때와 같은 가운데 축이다
  const content = <span className="flex w-full flex-col items-center">{rows}</span>;
  const className = cn(
    "absolute top-0 left-0 z-[2] flex w-full flex-col overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--el-ink)]",
    "items-center text-center",
    open ? "px-2.5" : "px-1",
    // 머리 전체가 누르는 버튼이다: 올리면 바탕이 깔리고(손 모양), 펼친 열은 머리 아래 옅은 강조선으로 「열려 있음」을 보인다
    toggle && "cursor-pointer hover:bg-muted/60"
  );
  const style = { height: HEAD_H - 1, paddingTop: HEAD_TEXT_TOP };
  return (
    <motion.div
      initial={false}
      animate={{ width, "--o": open ? 1 : 0 } as TargetAndTransition}
      transition={widthOf(instant)}
      className="relative h-full shrink-0"
      style={{ background: FACE, boxShadow: edgeShadow(edge) } as CSSProperties}
    >
      {open && toggle ? <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-px bg-[color-mix(in_srgb,var(--el-scope-project)_55%,transparent)]" /> : null}
      {selected ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--el-scope-project)_6%,transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--el-scope-project)]" />
        </div>
      ) : null}
      {markText ? (
        <span
          aria-hidden
          data-year={markText.length === 4 ? "" : undefined}
          className={cn(
            "pointer-events-none absolute z-[3] text-xs leading-4 whitespace-nowrap tabular-nums",
            markStrong ? "font-semibold text-[var(--el-ink)]" : SUBTLE,
            width >= 60 && "left-1/2 -translate-x-1/2"
          )}
          style={{ top: markTop, left: width >= 60 ? undefined : 3 }}
        >
          {markText}
        </span>
      ) : null}
      {toggle ? (
        <button
          type="button"
          data-head=""
          aria-expanded={open}
          aria-label={`${tip.title} · ${tip.text}`}
          onClick={() => onToggle(meeting.noteId, at)}
          onPointerEnter={show}
          onPointerLeave={hide}
          onFocus={show}
          onBlur={hide}
          className={className}
          style={style}
        >
          {content}
        </button>
      ) : (
        <div role="group" data-head="" aria-label={`${tip.title} · ${tip.text}`} onPointerEnter={show} onPointerLeave={hide} className={className} style={style}>
          {content}
        </div>
      )}
    </motion.div>
  );
});

/** 안건 수만큼 칸을 세우고 이어진 안건은 진하게 칠한다(9칸을 넘으면 비율로) */
function Ticks({ total, linked }: { total: number; linked: number }) {
  const cells = Math.min(total, 9);
  const dark = total <= 9 ? linked : Math.round((linked / total) * 9);
  return (
    <span aria-hidden className="flex gap-px">
      {Array.from({ length: cells }, (_, at) => (
        <span
          key={at}
          className={cn("h-2.5 w-[2px] rounded-[1px]", at < dark ? "bg-[var(--el-muted)]" : "bg-[var(--el-hairline-strong)]")}
        />
      ))}
    </span>
  );
}
