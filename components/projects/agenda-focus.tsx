"use client";

import { track } from "@/lib/analytics/track";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CornerDownRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { EdgeButtons } from "@/components/projects/agenda-edge-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RISE, SWAP_MS, reducedMotion, swapIn } from "@/components/projects/agenda-ribbon-motion";
import { MEMBER_KEY, summaryHref } from "@/components/projects/agenda-map-panel";
import { useDragPan } from "@/components/projects/use-drag-pan";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetMeetingReviewSummary } from "@/lib/api/generated/meeting-review/meeting-review";
import { okData } from "@/lib/api/ok-data";
import {
  CARD_GAP,
  CARD_W,
  DOT_INSET,
  FOCUS_PAD,
  SLOT_W,
  focusLayout,
  neighborsOf,
  type FocusLayout,
  type TopicIndex,
} from "@/lib/projects/agenda-focus";
import {
  meetingHeading,
  meetingYear,
  shortMeetingDate,
  type AgendaMap,
  type MapAgenda,
  type TopicRow,
} from "@/lib/projects/agenda-map";
import { ribbonLayout, type RibbonLayout } from "@/lib/projects/agenda-ribbon";
import { cn } from "@/lib/utils";

const ACCENT = "var(--el-scope-project)";
const CHIP =
  "h-7 max-w-[260px] cursor-pointer gap-1.5 bg-[var(--el-surface-card)] px-2.5 text-[13px] font-normal text-[var(--el-ink)] hover:border-[var(--el-scope-project)] hover:bg-[var(--el-surface-card)] hover:text-[var(--el-scope-project)] hover:shadow-[0_0_0_1px_var(--el-scope-project)]";
const pageOf = (element: Element) => element.closest("[data-slot=scroll-area-viewport]");
const pageTopOf = (element: Element) => {
  let top = 0;
  for (let node: HTMLElement | null = element as HTMLElement; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
  return top;
};
const DOT_Y = 20;
const STEM = 18;
const CARD_H = 180;
const ROW_H = DOT_Y + STEM + CARD_H + 40;
const FORK_R = 12;
const HEAD_H = 60;
/** 스크롤 타임라인을 지원하는 브라우저는 CSS 만으로 머리 줄을 가로 스크롤에 맞추고, 없으면 아래 효과가 스크롤마다 옮긴다 */
const HEAD_SYNC_CSS =
  "@keyframes focus-head-shift{to{transform:translateX(var(--focus-range,0px))}}" +
  "@supports (animation-timeline:scroll()){" +
  "[data-focus-box] [data-focus-head]{animation:focus-head-shift linear both;animation-timeline:--focus-x}" +
  "[data-focus-box] [data-scroller]{scroll-timeline:--focus-x x}" +
  "[data-focus-box]{timeline-scope:--focus-x}}";
const supportsScrollTimeline = () =>
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("animation-timeline", "scroll()");
const NEIGHBOR_LIMIT = 8;
const BRANCH_LIMIT = 5;

type Props = {
  workspaceId: string;
  map: AgendaMap;
  rows: TopicRow[];
  index: TopicIndex;
  topicId: string;
  agendaId?: string;
  onBack: () => void;
  onPick: (topicId: string, agendaId: string | undefined) => void;
};

export function AgendaFocus(props: Props) {
  const topic = props.index.topics.get(props.topicId);
  return topic ? <FocusStage {...props} topic={topic} /> : <FocusGone onBack={props.onBack} />;
}

function FocusGone({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    onBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function FocusStage({ workspaceId, map, rows, index, topicId, agendaId, onBack, onPick, topic }: Props & { topic: NonNullable<ReturnType<TopicIndex["topics"]["get"]>> }) {
  const t = useTranslations("workspace.agendaMap");
  const layout = useMemo(() => focusLayout(map, topic), [map, topic]);
  const ribbon = useMemo(() => ribbonLayout(map, rows), [map, rows]);
  const neighbors = useMemo(() => neighborsOf(index, map, topicId), [index, map, topicId]);
  const neighborIds = useMemo(() => new Set(neighbors.map((entry) => entry.topic.id)), [neighbors]);
  const [moreNeighbors, setMoreNeighbors] = useState(false);
  const [moreBranches, setMoreBranches] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useDragPan(stageRef, { skip: "[data-scroller], [data-edge-buttons]" });
  const reduced = useReducedMotion() ?? false;
  const [firstTopic] = useState(topicId);
  const enter = swapIn(reduced);
  const timelineRef = useRef<FocusTimelineApi>(null);

  const meetingOf = useMemo(() => new Map(map.meetings.map((meeting) => [meeting.noteId, meeting])), [map]);
  const dateOf = (noteId: string) => shortMeetingDate(meetingOf.get(noteId)!.startedAt);
  const first = topic.agendas[0];
  const last = topic.agendas.at(-1)!;

  useEffect(() => {
    stageRef.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }, []);
  useLayoutEffect(() => {
    const page = stageRef.current?.closest("[data-slot=scroll-area-viewport]");
    if (page) page.scrollTop = 0;
  }, []);
  const chipAnchor = useRef<{ top: number; scroll: number } | null>(null);
  useLayoutEffect(() => {
    const held = chipAnchor.current;
    chipAnchor.current = null;
    const block = stageRef.current?.querySelector("[data-chips]");
    const page = block ? pageOf(block) : null;
    if (!held || !block || !page) return;
    page.scrollTop = held.scroll + (pageTopOf(block) - held.top);
  }, [topicId]);

  const shownNeighbors = moreNeighbors ? neighbors : neighbors.slice(0, NEIGHBOR_LIMIT);
  return (
    <div
      ref={stageRef}
      data-agenda-focus=""
      className="overflow-clip rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]"
    >
      <div className="flex flex-col gap-4 px-5 pt-4 pb-4">
        <div className="flex items-center gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={onBack} className="rounded-full text-[13px]">
            <ArrowLeft aria-hidden data-icon="inline-start" />
            {t("focus.back")}
          </Button>
          <Badge render={<kbd />} variant="outline" className="bg-[var(--el-surface-card)] font-normal text-[var(--el-muted)]">
            esc
          </Badge>
        </div>

        <div ref={stripRef} className="rounded-control border border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-3">
          <GhostStrip
            map={map}
            layout={ribbon}
            active={topicId}
            neighbors={neighborIds}
            onPick={(id) => onPick(id, undefined)}
          />
        </div>
      </div>

      <motion.div key={topicId} initial={topicId === firstTopic ? false : enter.initial} animate={enter.animate}>
      <div className="flex flex-col gap-4 px-5 pb-5">
        <div>
          <h3 className="text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-balance text-[var(--el-ink)]">
            {topic.title}
          </h3>
          <p className="mt-1 text-[13px] text-[var(--el-muted)] tabular-nums">
            {t("flow.meta", { agendas: topic.agendas.length, meetings: topic.noteIds.size })} · {dateOf(first.noteId)} →{" "}
            {dateOf(last.noteId)}
            {topic.branches > 0 ? ` · ${t("flow.branches", { count: topic.branches })}` : ""}
          </p>
        </div>

        {layout.branches.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-[var(--el-muted)]">{t("flow.branches", { count: layout.branches.length })}</span>
            {(moreBranches ? layout.branches : layout.branches.slice(0, BRANCH_LIMIT)).map((branch, at) => (
              <Badge
                key={branch.rowId}
                variant="outline"
                render={<button type="button" title={t("focus.goToBranch", { title: branch.fork.title })} onClick={() => timelineRef.current?.reveal(branch.first.agendaId)} />}
                className={CHIP + " border-dashed"}
              >
                <CornerDownRight aria-hidden className="size-3 shrink-0 text-[var(--el-muted)]" />
                <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">
                  {dateOf(branch.first.noteId)}
                </span>
                <span className="truncate">{branch.first.title}</span>
                <span className="sr-only">{t("focus.branchOrdinal", { n: at + 1 })}</span>
              </Badge>
            ))}
            {layout.branches.length > BRANCH_LIMIT ? (
              <button
                type="button"
                onClick={() => setMoreBranches((open) => !open)}
                className="h-7 rounded-full px-2 text-xs text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
              >
                {moreBranches ? t("focus.collapse") : t("focus.showMoreCount", { count: layout.branches.length - BRANCH_LIMIT })}
              </button>
            ) : null}
          </div>
        ) : null}

        {neighbors.length > 0 ? (
          <div data-chips="" className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-[var(--el-muted)]">{t("focus.neighbors")}</span>
            {shownNeighbors.map(({ topic: other, noteIds }) => (
              <Badge
                key={other.id}
                variant="outline"
                render={
                  <button
                    type="button"
                    title={t("focus.neighborTitle", { title: other.title, dates: noteIds.map(dateOf).join(", ") })}
                    onClick={() => {
                      const block = stageRef.current?.querySelector("[data-chips]");
                      chipAnchor.current = block ? { top: pageTopOf(block), scroll: pageOf(block)?.scrollTop ?? 0 } : null;
                      onPick(other.id, undefined);
                    }}
                  />
                }
                className={CHIP}
              >
                <span className="truncate font-medium text-[var(--el-ink)]">{other.title}</span>
                <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">
                  {dateOf(noteIds[0])}
                  {noteIds.length > 1 ? ` ${t("more", { count: noteIds.length - 1 })}` : ""}
                </span>
              </Badge>
            ))}
            {neighbors.length > NEIGHBOR_LIMIT ? (
              <button
                type="button"
                onClick={() => setMoreNeighbors((open) => !open)}
                className="h-7 rounded-full px-2 text-xs text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
              >
                {moreNeighbors ? t("focus.collapse") : t("focus.showMoreCount", { count: neighbors.length - NEIGHBOR_LIMIT })}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <FocusTimeline
        key={topicId}
        ref={timelineRef}
        workspaceId={workspaceId}
        map={map}
        layout={layout}
        topicId={topicId}
        agendaId={agendaId}
        meetingOf={meetingOf}
      />
      </motion.div>
    </div>
  );
}

function GhostStrip({
  map,
  layout,
  active,
  neighbors,
  onPick,
}: {
  map: AgendaMap;
  layout: RibbonLayout;
  active: string;
  neighbors: ReadonlySet<string>;
  onPick: (topicId: string) => void;
}) {
  const t = useTranslations("workspace.agendaMap");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const read = () => setWidth(wrap.clientWidth);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  const side = 6;
  const count = map.meetings.length;
  const lanes = Math.max(1, layout.lanes.length);
  const laneH = Math.min(9, Math.max(3, Math.floor(84 / lanes)));
  const radius = Math.min(3, Math.max(1.5, laneH * 0.34));
  const col = (width - side * 2) / count;
  const height = 16 + (lanes - 1) * laneH;
  const x = (meeting: number) => side + meeting * col + col / 2;
  const y = (lane: number) => 8 + lane * laneH;
  const opacityOf = (id: string) => {
    if (hover) return id === hover || id === active ? 1 : 0.15;
    return id === active ? 1 : neighbors.has(id) ? 0.6 : 0.18;
  };

  return (
    <div ref={wrapRef} className="relative">
      {width > 0 ? (
        <svg aria-label={t("focus.outline")} role="group" width={width} height={height} className="block">
          {layout.topics.map((topic) => {
            const state = topic.id === active || topic.id === hover ? "on" : "off";
            const color = state === "on" ? ACCENT : "var(--el-muted)";
            const stops = topic.main.stops;
            const yy = y(topic.lane);
            return (
              <g
                key={topic.id}
                data-topic={topic.id}
                role="button"
                tabIndex={topic.id === active ? 0 : -1}
                aria-label={t("focus.switchTopic", { name: topic.name })}
                onPointerEnter={() => setHover(topic.id)}
                onPointerLeave={() => setHover(null)}
                onClick={() => onPick(topic.id)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onPick(topic.id);
                }}
                className="cursor-pointer outline-none transition-opacity duration-150 focus-visible:[outline:2px_solid_var(--el-ink)] motion-reduce:duration-100"
                style={{ opacity: opacityOf(topic.id) }}
              >
                <title>{topic.name}</title>
                <rect
                  x={x(stops[0].meeting) - 4}
                  y={yy - laneH / 2}
                  width={Math.max(8, x(stops.at(-1)!.meeting) - x(stops[0].meeting) + 8)}
                  height={laneH}
                  fill="transparent"
                />
                <line
                  x1={x(stops[0].meeting)}
                  x2={x(stops.at(-1)!.meeting)}
                  y1={yy}
                  y2={yy}
                  stroke={color}
                  strokeWidth={state === "on" ? 1.75 : 1.1}
                />
                {stops.map((stop) => (
                  <circle
                    key={stop.meeting}
                    cx={x(stop.meeting)}
                    cy={yy}
                    r={radius}
                    fill={state === "on" ? ACCENT : "var(--el-surface-card)"}
                    stroke={color}
                    strokeWidth={1}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
    </div>
  );
}

type FocusTimelineApi = { reveal: (agendaId: string) => void };

function FocusTimeline({
  ref,
  workspaceId,
  map,
  layout,
  topicId,
  agendaId,
  meetingOf,
}: {
  ref: React.Ref<FocusTimelineApi>;
  workspaceId: string;
  map: AgendaMap;
  layout: FocusLayout;
  topicId: string;
  agendaId?: string;
  meetingOf: Map<string, AgendaMap["meetings"][number]>;
}) {
  const t = useTranslations("workspace.agendaMap");
  const scrollRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() ?? false;
  useDragPan(scrollRef);
  const cells = useMemo(() => {
    const spans = new Map<string, { from: number; to: number; agenda: MapAgenda }>();
    for (const { agenda, left } of layout.cards) {
      const span = spans.get(agenda.noteId);
      if (span) {
        span.from = Math.min(span.from, left);
        span.to = Math.max(span.to, left + CARD_W);
      } else spans.set(agenda.noteId, { from: left, to: left + CARD_W, agenda });
    }
    return [...spans.entries()].map(([noteId, span]) => ({ noteId, ...span })).sort((a, b) => a.from - b.from);
  }, [layout]);
  const [stuck, setStuck] = useState(false);
  useLayoutEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0)),
      { root: pageOf(sentinel) }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const head = headRef.current;
    if (!scroller || !head) return;
    const range = () => head.style.setProperty("--focus-range", `${-Math.max(0, scroller.scrollWidth - scroller.clientWidth)}px`);
    range();
    const observer = new ResizeObserver(range);
    observer.observe(scroller);
    if (supportsScrollTimeline()) return () => observer.disconnect();
    const sync = () => {
      head.style.transform = `translate3d(${-scroller.scrollLeft}px,0,0)`;
    };
    sync();
    scroller.addEventListener("scroll", sync, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", sync);
    };
  }, [layout.width]);
  const lineY = (row: number) => row * ROW_H + DOT_Y;
  const dotX = (id: string) => layout.leftOf.get(id)! + DOT_INSET;
  const height = layout.rowCount * ROW_H - 40 + 8;

  const reveal = (id: string) => {
    const card = boxRef.current?.querySelector(`[data-card="${CSS.escape(id)}"]`);
    const content = scrollRef.current?.firstElementChild;
    if (!card || !content) return;
    card.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
    content.animate(
      reducedMotion()
        ? [{ opacity: 0.4 }, { opacity: 1 }]
        : [
            { opacity: 0.4, transform: `translateY(${RISE}px)` },
            { opacity: 1, transform: "translateY(0)" },
          ],
      { duration: SWAP_MS, easing: "ease-out" }
    );
  };
  useLayoutEffect(() => {
    if (typeof ref === "function") ref({ reveal });
    else if (ref) (ref as React.RefObject<FocusTimelineApi | null>).current = { reveal };
    return () => {
      if (typeof ref === "function") ref(null);
      else if (ref) (ref as React.RefObject<FocusTimelineApi | null>).current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const picked = agendaId ? layout.leftOf.get(agendaId) : undefined;
    const room = scroller.clientWidth;
    if (picked !== undefined) scroller.scrollLeft = picked + CARD_W / 2 - room / 2;
    else if (layout.branches.length > 0) {
      const branch = layout.branches[0];
      const [parent, child] = [layout.leftOf.get(branch.fork.agendaId)!, layout.leftOf.get(branch.first.agendaId)!];
      if (child + CARD_W > room - 24) {
        const slot = Math.ceil((child + CARD_W - room + 48 - FOCUS_PAD + 16) / SLOT_W);
        const keep = Math.round((parent - FOCUS_PAD) / SLOT_W);
        scroller.scrollLeft = FOCUS_PAD + Math.min(slot, keep) * SLOT_W - 16;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={boxRef} data-focus-box="" className="relative border-t border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]">
      <style>{HEAD_SYNC_CSS}</style>
      <div ref={sentinelRef} aria-hidden className="pointer-events-none absolute top-0 left-0 h-px w-px" />
      <div
        data-focus-strip=""
        data-stuck={stuck ? "" : undefined}
        style={{ height: HEAD_H }}
        className="sticky top-0 z-[6] w-0 min-w-full overflow-hidden border-b border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] transition-shadow duration-150 data-[stuck]:shadow-e2"
      >
        <div ref={headRef} data-focus-head="" className="relative mx-auto h-full" style={{ width: layout.width }}>
          {cells.map(({ noteId, from, to, agenda }) => {
            const meeting = meetingOf.get(noteId)!;
            return (
              <div
                key={noteId}
                data-focus-cell={noteId}
                className="absolute top-0 flex h-full flex-col items-center px-1 pt-2.5 text-center whitespace-nowrap"
                style={{ left: from, width: to - from }}
              >
                <span className="flex h-[18px] items-baseline gap-1 text-[13px] leading-[18px] tabular-nums">
                  <span className="font-bold text-[var(--el-ink)]">{dateLabel(map, agenda)}</span>
                </span>
                <span className="mt-px block h-4 max-w-full truncate text-xs leading-4 text-[var(--el-body)]">{meetingHeading(meeting.title)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <EdgeButtons scroller={scrollRef} reduced={reduced} inset={HEAD_H} />
      <div
        ref={scrollRef}
        data-scroller=""
        className="w-0 min-w-full overflow-x-auto pt-9 pb-7 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          data-focus-timeline=""
          data-topic={topicId}
          className="relative mx-auto"
          style={{ width: layout.width, height }}
        >
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0"
            width={layout.width}
            height={height}
          >
            {layout.cards.map(({ agenda, row }) => (
              <line
                key={`stem:${agenda.agendaId}`}
                x1={dotX(agenda.agendaId)}
                x2={dotX(agenda.agendaId)}
                y1={lineY(row) + 6}
                y2={lineY(row) + STEM}
                stroke="var(--el-hairline-strong)"
              />
            ))}
            {layout.links.map((link) => {
              const [x1, x2] = [dotX(link.from) + 7, dotX(link.to) - 7];
              const [y0, y1] = [lineY(layout.rowOf.get(link.from)!), lineY(layout.rowOf.get(link.to)!)];
              if (!link.fork) {
                return (
                  <line key={`${link.from}>${link.to}`} x1={x1} x2={x2} y1={y0} y2={y0} stroke={ACCENT} strokeWidth={2} />
                );
              }
              const gutter = (layout.leftOf.get(link.from) ?? 0) + CARD_W + CARD_GAP / 2;
              const dir = y1 > y0 ? 1 : -1;
              const d = `M${x1},${y0} H${gutter} V${y1 - dir * FORK_R} Q${gutter},${y1} ${gutter + FORK_R},${y1} H${x2}`;
              return (
                <path
                  key={`${link.from}>${link.to}`}
                  d={d}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              );
            })}
          </svg>

          {[...new Set(layout.branches.map((branch) => branch.row))].map((row) => {
            const here = layout.branches.filter((branch) => branch.row === row);
            return (
              <div
                key={`tag:${row}`}
                className="pointer-events-none absolute z-[2]"
                style={{ left: 0, width: layout.width, top: lineY(row) - 38, height: 24 }}
              >
                <Badge
                  variant="outline"
                  render={<button type="button" onClick={() => reveal(here[0].first.agendaId)} />}
                  className="pointer-events-auto sticky left-3 h-6 cursor-pointer gap-1.5 border-dashed bg-[var(--el-surface-card)] font-normal text-[var(--el-ink)] hover:border-[var(--el-scope-project)] hover:shadow-[0_0_0_1px_var(--el-scope-project)]"
                >
                  <CornerDownRight aria-hidden className="size-3 text-[var(--el-muted)]" />
                  {t("focus.branchTag", { count: here.length })}
                  <span className="text-[var(--el-muted)] tabular-nums">
                    {t("focus.since", { date: shortMeetingDate(meetingOf.get(here[0].first.noteId)!.startedAt) })}
                  </span>
                </Badge>
              </div>
            );
          })}

          {layout.cards.map(({ agenda, row, left }) => {
            const picked = agenda.agendaId === agendaId;
            return (
              <div key={agenda.agendaId}>
                <span
                  aria-hidden
                  className={cn(
                    "absolute size-3 rounded-full border-2 border-[var(--el-scope-project)]",
                    picked ? "bg-[var(--el-scope-project)]" : "bg-[var(--el-canvas-soft)]"
                  )}
                  style={{ left: dotX(agenda.agendaId) - 6, top: lineY(row) - 6 }}
                />
                <div
                  data-card={agenda.agendaId}
                  className="absolute"
                  style={{ left, top: lineY(row) + STEM, width: CARD_W, height: CARD_H }}
                >
                  <AgendaCard
                    workspaceId={workspaceId}
                    agenda={agenda}
                    meetingTitle={meetingOf.get(agenda.noteId)!.title}
                    dateLabel={dateLabel(map, agenda)}
                    picked={picked}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function dateLabel(map: AgendaMap, agenda: MapAgenda) {
  const meeting = map.meetings.find((candidate) => candidate.noteId === agenda.noteId)!;
  const year = meetingYear(meeting.startedAt);
  return year === meetingYear(map.meetings.at(-1)!.startedAt)
    ? shortMeetingDate(meeting.startedAt)
    : `${year}.${shortMeetingDate(meeting.startedAt)}`;
}


function AgendaCard({
  workspaceId,
  agenda,
  meetingTitle,
  dateLabel,
  picked,
}: {
  workspaceId: string;
  agenda: MapAgenda;
  meetingTitle: string;
  dateLabel: string;
  picked: boolean;
}) {
  const t = useTranslations("workspace.agendaMap");
  const query = useGetMeetingReviewSummary(agenda.noteId);
  const item = okData(query.data)?.agendas.find((candidate) => candidate.agendaId === agenda.agendaId);
  const counts = Object.entries(
    (item?.members ?? []).reduce<Record<string, number>>((acc, member) => {
      if (MEMBER_KEY[member.kind]) acc[member.kind] = (acc[member.kind] ?? 0) + 1;
      return acc;
    }, {})
  );
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-block border bg-[var(--el-surface-card)] p-3.5",
        picked
          ? "border-[var(--el-scope-project)] shadow-[0_0_0_1px_var(--el-scope-project)]"
          : "border-[var(--el-hairline)]"
      )}
    >
      <p className="flex items-baseline gap-1.5 text-xs leading-4 whitespace-nowrap">
        <span className="font-semibold text-[var(--el-ink)] tabular-nums">{dateLabel}</span>
        <span className="min-w-0 truncate text-[var(--el-muted)]">{meetingHeading(meetingTitle)}</span>
        <Badge variant={agenda.completed ? "secondary" : "outline"} className="ml-auto">
          {agenda.completed ? t("completed") : t("notCompleted")}
        </Badge>
      </p>
      <h4 className="mt-2 line-clamp-2 text-[14px] leading-5 font-semibold text-[var(--el-ink)]">{agenda.title}</h4>
      {query.isLoading ? (
        <div aria-label={t("detail.loading")} className="mt-2 flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      ) : query.isError ? (
        <InlineRetry className="mt-2" label={t("detail.loadFailedShort")} onRetry={() => void query.refetch()} />
      ) : item?.summary ? (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-[18px] text-[var(--el-body)]">{item.summary}</p>
      ) : (
        <p className="mt-1.5 text-xs text-[var(--el-muted)]">{t("detail.empty")}</p>
      )}
      <div className="mt-auto flex flex-col gap-1.5">
        {counts.length > 0 ? (
          <p className="text-xs text-[var(--el-muted)] tabular-nums">
            {counts.map(([kind, n]) => t(`members.${MEMBER_KEY[kind]}`, { count: n })).join(" · ")}
          </p>
        ) : null}
        <Link
          href={summaryHref(workspaceId, agenda.noteId, agenda.agendaId)}
          onClick={() => track("agenda_map_note_opened", { workspace_id: workspaceId, surface: "focus" })}
          className="inline-flex items-center gap-1 self-start text-xs text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
        >
          {t("viewInNotes")}
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}
