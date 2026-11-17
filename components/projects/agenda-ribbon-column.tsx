"use client";

import { memo, useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { motion, type TargetAndTransition, type Transition } from "motion/react";

import { Badge } from "@/components/ui/badge";

import type { HoverApi } from "@/components/projects/agenda-ribbon-hover";
import { CHOREO_MS, INSTANT, columnMotion, staggerOf, widthOf } from "@/components/projects/agenda-ribbon-motion";
import { getAppDateKey } from "@/lib/format/date";
import { meetingHeading, shortMeetingDate, type MapAgenda, type MapMeeting } from "@/lib/projects/agenda-map";
import type { RibbonColumn, RibbonLayout, RibbonRoute, RibbonTopic } from "@/lib/projects/agenda-ribbon";
import { cn } from "@/lib/utils";

export const HEAD_H = 78;
const HEAD_TEXT_TOP = 20;
export const PAD = 12;
export const BOARD_END_GUTTER = 96;
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
const INLANE = { Y: 42, T: 88, SUB: 46, NAME: 4, ROW: 22, FS: 13, ZROW: 32, ZGAP: 28, ZHEAD: 32, LABEL: 15 };
export const GRID_ROOMY: Grid = { ...INLANE, TOP: 14, P: 75, PT: 120 };
export const GRID_COMPACT: Grid = GRID_ROOMY;
export const PILL_H = 20;
export const PILL_GAP = 8;
export const PILL_SIDE = 9;
const CAP_HALF = 12;
export const HOOK_W = 8;
export const HOOK_H = 9;
const HOOK_GAP = 4;
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

const RIBBON = 4;
const RIBBON_PICKED = 6;
export const THIN = 1.5;
const THIN_PICKED = 2;
const DOT = 12;
export const MIN_COL = 28;
export const PILL_COL = 58;
export const MAX_COL = 960;
export const TITLE_COL = 260;
export const OPEN_W = 220;
export const ZONE_INSET = 24;
export const ACCENT = "var(--el-scope-project)";

export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const capHeight = (count: number) => (count <= 2 ? 18 : count === 3 ? 20 : 22);
const capWidth = (count: number, height: number, col: number) =>
  Math.max(height, (col >= 30 ? height + 8 : height) + (String(count).length - 1) * 7);

export type StopLike = { meeting: number; agendas: MapAgenda[] };

export type Paint = { ribbon: string; thin: string; stroke: string; text: string; ribbonW: number; thinW: number };
export const LINE = "color-mix(in srgb, var(--el-muted) 82%, #fafafa)";
export const NORMAL: Paint = { ribbon: LINE, thin: LINE, stroke: "var(--el-muted)", text: "var(--el-ink)", ribbonW: RIBBON, thinW: THIN };
const PICKED: Paint = {
  ribbon: `color-mix(in srgb, ${ACCENT} 78%, #fafafa)`,
  thin: ACCENT,
  stroke: ACCENT,
  text: ACCENT,
  ribbonW: RIBBON_PICKED,
  thinW: THIN_PICKED,
};
const RING = `0 0 0 3px color-mix(in srgb, ${ACCENT} 28%, transparent)`;

export function stopMetrics(n: number, small: boolean, col: number) {
  const h = small ? (n > 1 ? 19 : 0) : n > 1 ? capHeight(n) : 0;
  const w = small ? Math.max(h, 19 + (String(n).length - 1) * 7) : capWidth(n, h, col);
  const radius = small ? 5.5 : DOT / 2;
  const stroke = small ? 1.5 : 2;
  return { h, w, radius, stroke, half: (n > 1 ? w : radius * 2) / 2, outer: n > 1 ? h + stroke : radius * 2 + stroke };
}

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

export function JoinMark({ half, className }: { half: number; className?: string }) {
  return (
    <svg aria-hidden width={0} height={0} className={cn("overflow-visible", className)} stroke="var(--el-muted)" fill="var(--el-surface-card)">
      <path d={`M${-half - 1},-3 L${-half - 6},-9`} fill="none" strokeWidth={1.5} strokeDasharray="2 1.5" />
      <circle cx={-half - 7.5} cy={-10.5} r={2.5} strokeWidth={1.5} />
    </svg>
  );
}

export const forkPath = (run: number, drop: number, down = true) =>
  `M0,${down ? 0 : drop} C${run / 2},${down ? 0 : drop} ${run / 2},${down ? drop : 0} ${run},${down ? drop : 0}`;

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
  zone: readonly MapAgenda[];
  g: Grid;
  laneT: readonly number[];
  width: number;
  col: number;
  open: boolean;
  selected: boolean;
  edge: number;
  monthEdge: boolean;
  topicId: string | null;
  agendaId: string | null;
  instant: boolean;
  reduced: boolean;
  titles: boolean;
  rove: string | null;
};

const NO_TITLE = "clamp(0, calc(1 - 6 * var(--c, 1) * var(--o) * var(--ti)), 1)";

const EDGE_LINE = "color-mix(in srgb, var(--el-hairline-strong) calc(var(--o) * 100%), transparent)";
const edgeShadow = (edge: number) =>
  [edge & 1 ? null : `inset 1px 0 0 ${EDGE_LINE}`, edge & 2 ? null : `inset -1px 0 0 ${EDGE_LINE}`].filter(Boolean).join(",") || undefined;
const FACE = undefined;

const TRAIL_MS = CHOREO_MS;

type Lane = { topic: string; lines: ReactNode[]; nodes: ReactNode[]; titles: ReactNode[] };

export const Column = memo(function Column(props: ColumnProps) {
  const { at, meeting, data, layout, joinTargets, zone, g, laneT, width, col, open, selected, edge, monthEdge, topicId, agendaId, instant, reduced, titles, rove } = props;
  const t = useTranslations("workspace.agendaMap");

  const date = shortMeetingDate(meeting.startedAt);
  const reachClosed = clamp(col * 0.3, 5, 22);
  const runClosed = clamp(Math.floor(col / 2) - 2, 8, 44);

  const [shown, setShown] = useState(open);
  const [trail, setTrail] = useState(false);
  const [openW, setOpenW] = useState(width);
  if (shown !== open) {
    setShown(open);
    setTrail(reduced || !instant);
  }
  if (open && openW !== width) setOpenW(width);
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

  const build = (mode: "closed" | "open") => {
    const isOpen = mode === "open";
    const lanes = new Map<number, Lane>();
    const laneOf = (topic: RibbonTopic) => {
      let lane = lanes.get(topic.lane);
      if (!lane) lanes.set(topic.lane, (lane = { topic: topic.id, lines: [], nodes: [], titles: [] }));
      return lane;
    };

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
                  on ? "font-semibold text-[var(--el-scope-project)]" : small ? SUBTLE : "text-[var(--el-body)]"
                )}
                style={{ lineHeight: `${g.ROW}px` }}
              >
                {shownAgenda.title}
              </span>
              {n > 1 ? <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">{t("more", { count: n - 1 })}</span> : null}
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
        inert={!current}
        className="pointer-events-none absolute inset-0"
        style={
          {
                        "--o": isOpen ? 1 : 0,
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
  rowHalf: number;
  open: boolean;
  narrow: boolean;
  stroke: string;
  line: string;
}) {
  const t = useTranslations("workspace.agendaMap");
  const label = t("showFolded", { count: folded });
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
  const top = hitH / 2 + Math.max(outer / 2, open ? rowHalf : 0) + PILL_GAP;
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
  const t = useTranslations("workspace.agendaMap");
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
                {t("branch")}
              </Badge>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

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

const SUBTLE = "text-[color-mix(in_srgb,var(--el-muted)_85%,var(--el-ink))]";

export type HeadColumnProps = {
  at: number;
  meeting: MapMeeting;
  width: number;
  open: boolean;
  toggle: boolean;
  selected: boolean;
  edge: number;
  markText: string;
  markTop: number;
  markStrong: boolean;
  total: number;
  linked: number;
  hover: RefObject<HoverApi | null>;
  onToggle: (noteId: string, at: number) => void;
  instant: boolean;
};

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
  hover,
  onToggle,
  instant,
}: HeadColumnProps) {
  const t = useTranslations("workspace.agendaMap");
  const date = shortMeetingDate(meeting.startedAt);
  const day = String(Number(getAppDateKey(meeting.startedAt).slice(8, 10)));
  const heading = meetingHeading(meeting.title);
  const tip = {
    title: `${date} ${heading}`,
    text: [t("columnTip", { total, linked }), toggle ? (open ? t("clickToCollapse") : t("clickToExpand")) : null]
      .filter(Boolean)
      .join(" · "),
  };
  const show = (event: { currentTarget: Element }) => hover.current?.show({ rect: event.currentTarget.getBoundingClientRect(), el: event.currentTarget, tip });
  const hide = () => hover.current?.hide();
  const mode = open ? "o" : width >= 60 ? "c" : width >= 34 ? "n" : "t";
  const rows =
    mode === "o" ? (
      <>
        <span className="flex h-[18px] items-baseline justify-center gap-1.5 text-xs leading-[18px] whitespace-nowrap tabular-nums">
          <span className="text-[13px] font-bold text-[var(--el-ink)]">{date}</span>
        </span>
        <span className="mt-px block h-4 max-w-full truncate text-xs leading-4 text-[var(--el-body)]">{heading}</span>
        <span className={cn("mt-0.5 block h-4 text-xs leading-4 whitespace-nowrap tabular-nums", SUBTLE)}>
          {t("columnMeta", { total, linked })}
        </span>
      </>
    ) : mode === "c" ? (
      <>
        <span className="flex h-[18px] items-baseline justify-center gap-1 text-[13px] leading-[18px] whitespace-nowrap tabular-nums">
          <span className="font-bold text-[var(--el-ink)]">{date}</span>
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
      <span
        aria-hidden
        className="absolute bottom-[8px] left-1/2 flex w-1 -translate-x-1/2 flex-col justify-end overflow-hidden rounded-[1px] bg-[var(--el-hairline-strong)]"
        style={{ height: clamp(6 + total * 2, 8, 22) }}
      >
        <span className="bg-[var(--el-muted)]" style={{ height: `${(linked / Math.max(1, total)) * 100}%` }} />
      </span>
    );
  const content = <span className="flex w-full flex-col items-center">{rows}</span>;
  const className = cn(
    "absolute top-0 left-0 z-[2] flex w-full flex-col overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--el-ink)]",
    "items-center text-center",
    open ? "px-2.5" : "px-1",
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
