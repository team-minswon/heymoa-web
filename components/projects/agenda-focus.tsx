"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CornerDownRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { EdgeButtons } from "@/components/projects/agenda-edge-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RISE, SWAP_MS, reducedMotion, swapIn } from "@/components/projects/agenda-ribbon-motion";
import { summaryHref } from "@/components/projects/agenda-map-panel";
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
  daysAfterPrevious,
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
/** 줄기·갈래를 옮기는 칩(`Badge` 위에 얹는 크기·호버). 호버·키보드 포커스는 색과 테두리가 함께 바뀐다 */
const CHIP =
  "h-7 max-w-[260px] cursor-pointer gap-1.5 bg-[var(--el-surface-card)] px-2.5 text-[13px] font-normal text-[var(--el-ink)] hover:border-[var(--el-scope-project)] hover:bg-[var(--el-surface-card)] hover:text-[var(--el-scope-project)] hover:shadow-[0_0_0_1px_var(--el-scope-project)]";
/** 페이지 스크롤 상자와, 그 안에서 요소의 위치(변환·애니메이션을 빼고 레이아웃 좌표로 잰다) */
const pageOf = (element: Element) => element.closest("[data-slot=scroll-area-viewport]");
const pageTopOf = (element: Element) => {
  let top = 0;
  for (let node: HTMLElement | null = element as HTMLElement; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
  return top;
};
const DOT_Y = 20;
const STEM = 18;
const CARD_H = 180;
/** 줄(줄기·갈래) 하나의 높이. 카드 아래 갈래 칩이 들어갈 틈까지 */
const ROW_H = DOT_Y + STEM + CARD_H + 40;
const FORK_R = 12;
/** 타임라인 위의 날짜 머리 줄(세로로 스크롤해도 화면 위에 붙는다)의 높이 */
const HEAD_H = 60;
/** 머리 줄의 안쪽(`data-focus-head`)을 가로 스크롤 상자의 스크롤에 맞춘다. 스크롤 타임라인이 있으면 CSS 만으로(JS 지연 없음), 없으면 아래 효과가 옮긴다 */
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
  /** 주소나 안건 점으로 들어왔을 때 짚을 안건 */
  agendaId?: string;
  onBack: () => void;
  onPick: (topicId: string, agendaId: string | undefined) => void;
};

/**
 * 포커스 화면: 줄기 하나를 큰 가로 타임라인으로 편다. 위에는 전체 윤곽 띠(고른 줄기만 강조색, 같은 회의에서 만난 줄기는
 * 조금 진하게)가 남아 있어 맥락을 잃지 않고, 띠나 이웃 칩을 누르면 다른 줄기로 옮겨 간다. 줄기를 옮길 때 점·카드는 옛 자리에서 날아오지 않는다 — 띠 아래의
 * 내용(제목·칩·타임라인)이 한 덩어리로 옅게 나타나며 8px 올라온다(`swapIn`). 전체 지도에서 들어오고 돌아가는 것은 부모가 같은 방식으로 맡는다.
 */
export function AgendaFocus(props: Props) {
  const topic = props.index.topics.get(props.topicId);
  return topic ? <FocusStage {...props} topic={topic} /> : <FocusGone onBack={props.onBack} />;
}

/** 다시 받은 응답에서 이 줄기가 사라졌다: 그릴 것이 없으니 전체 지도로 돌아간다 */
function FocusGone({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    onBack();
    // 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function FocusStage({ workspaceId, map, rows, index, topicId, agendaId, onBack, onPick, topic }: Props & { topic: NonNullable<ReturnType<TopicIndex["topics"]["get"]>> }) {
  const layout = useMemo(() => focusLayout(map, topic), [map, topic]);
  const ribbon = useMemo(() => ribbonLayout(map, rows), [map, rows]);
  const neighbors = useMemo(() => neighborsOf(index, map, topicId), [index, map, topicId]);
  const neighborIds = useMemo(() => new Set(neighbors.map((entry) => entry.topic.id)), [neighbors]);
  const [moreNeighbors, setMoreNeighbors] = useState(false);
  const [moreBranches, setMoreBranches] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // 타임라인 밖(윤곽·칩·여백)에서 시작한 끌기도 세로 스크롤로 움직인다. 타임라인 안은 자기 훅(좌우+상하)이 맡고, 버튼·링크 위에서도 5px 넘게 끌면 끌린다
  useDragPan(stageRef, { skip: "[data-scroller], [data-edge-buttons]" });
  const reduced = useReducedMotion() ?? false;
  // 처음 들어온 줄기는 부모가 나타내니 따로 움직이지 않고, 줄기를 옮길 때만 새 내용이 나타난다
  const [firstTopic] = useState(topicId);
  const enter = swapIn(reduced);
  const timelineRef = useRef<FocusTimelineApi>(null);

  const meetingOf = useMemo(() => new Map(map.meetings.map((meeting) => [meeting.noteId, meeting])), [map]);
  const dateOf = (noteId: string) => shortMeetingDate(meetingOf.get(noteId)!.startedAt);
  const first = topic.agendas[0];
  const last = topic.agendas.at(-1)!;

  // 들어오면 키보드 포커스는 「전체 지도」 버튼으로(돌아가는 길이 가장 먼저 닿는다)
  useEffect(() => {
    stageRef.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
  }, []);
  // 들어올 때 페이지를 맨 위로(줄기를 바꿀 때는 그대로)
  useLayoutEffect(() => {
    const page = stageRef.current?.closest("[data-slot=scroll-area-viewport]");
    if (page) page.scrollTop = 0;
  }, []);
  // 칩을 눌러 줄기를 옮기면 제목·갈래 줄 수가 달라져 칩 줄이 아래위로 밀릴 수 있다 — 칩 줄이 옮기기 전과 같은 화면 높이에 오도록 페이지 스크롤을 맞춘다(같은 프레임)
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
            전체 지도
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
            안건 {topic.agendas.length}개 · 회의 {topic.noteIds.size}개 · {dateOf(first.noteId)} → {dateOf(last.noteId)}
            {topic.branches > 0 ? ` · 갈래 ${topic.branches}` : ""}
          </p>
        </div>

        {layout.branches.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-[var(--el-muted)]">갈래 {layout.branches.length}</span>
            {(moreBranches ? layout.branches : layout.branches.slice(0, BRANCH_LIMIT)).map((branch, at) => (
              <Badge
                key={branch.rowId}
                variant="outline"
                render={<button type="button" title={`${branch.fork.title} 에서 갈라진 갈래로 이동`} onClick={() => timelineRef.current?.reveal(branch.first.agendaId)} />}
                className={CHIP + " border-dashed"}
              >
                <CornerDownRight aria-hidden className="size-3 shrink-0 text-[var(--el-muted)]" />
                <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">
                  {dateOf(branch.first.noteId)}
                </span>
                <span className="truncate">{branch.first.title}</span>
                <span className="sr-only">{at + 1}번째 갈래</span>
              </Badge>
            ))}
            {layout.branches.length > BRANCH_LIMIT ? (
              <button
                type="button"
                onClick={() => setMoreBranches((open) => !open)}
                className="h-7 rounded-full px-2 text-xs text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
              >
                {moreBranches ? "접기" : `${layout.branches.length - BRANCH_LIMIT}개 더`}
              </button>
            ) : null}
          </div>
        ) : null}

        {neighbors.length > 0 ? (
          <div data-chips="" className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-[var(--el-muted)]">같은 회의에서 만난 줄기</span>
            {shownNeighbors.map(({ topic: other, noteIds }) => (
              <Badge
                key={other.id}
                variant="outline"
                render={
                  <button
                    type="button"
                    title={`${other.title} · ${noteIds.map(dateOf).join(", ")} 회의에서 함께`}
                    onClick={() => {
                      // 눌러서 줄기를 옮겨도 이 칩 줄이 화면에서 밀려 가지 않게, 옮기기 전 자리를 기억해 둔다
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
                  {noteIds.length > 1 ? ` 외 ${noteIds.length - 1}` : ""}
                </span>
              </Badge>
            ))}
            {neighbors.length > NEIGHBOR_LIMIT ? (
              <button
                type="button"
                onClick={() => setMoreNeighbors((open) => !open)}
                className="h-7 rounded-full px-2 text-xs text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
              >
                {moreNeighbors ? "접기" : `${neighbors.length - NEIGHBOR_LIMIT}개 더`}
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

// ── 위의 윤곽 띠 ───────────────────────────────────────────────────────────────

/**
 * 전체 윤곽의 얇은 띠. 줄기마다 가는 선과 작은 점이고, 고른 줄기만 강조색이다. 줄기를 누르면 그 줄기로 옮겨 간다.
 */
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
        <svg aria-label="전체 지도 윤곽" role="group" width={width} height={height} className="block">
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
                aria-label={`${topic.name}. 눌러서 이 줄기로 옮기기`}
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
                {/* 누르기 쉽게 보이지 않는 넓은 줄 */}
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

// ── 타임라인 ───────────────────────────────────────────────────────────────────

type FocusTimelineApi = { reveal: (agendaId: string) => void };

/**
 * 줄기 하나의 가로 타임라인. 줄기가 바뀌면 부모가 key 로 새로 세우고, 점·선·카드는 옮겨 오지 않고 바로 선다. 갈래가 오른쪽 끝에 숨지 않게,
 * 처음 자리는 첫 갈래가 보이는 곳이고 갈래 줄마다 왼쪽에 붙어 따라오는 칩이 있다. 잡아 끌거나 양옆의 둥근 버튼으로 옮긴다 — 스크롤 상자는 스테이지 끝까지 쓰고,
 * 버튼은 레이아웃 공간 없이 가장자리 가까이 갈 때만 뜨며 세로로 스크롤해도 보이는 구간의 가운데에 붙어 따라온다.
 */
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() ?? false;
  useDragPan(scrollRef);
  // 날짜 머리 칸: 줄기가 지나간 회의마다 한 칸, 카드 칸(그 회의의 카드들이 차지한 x 범위)과 left·width 가 같다
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
  // 머리 줄이 화면 위에 붙어 있을 때만 옅은 그림자: 맨 위 감시 요소가 화면 위로 나가면 붙은 것이다(스크롤 이벤트 없이 교차 관찰자가 알려 준다)
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
  // 머리 줄 안쪽이 가로 스크롤을 따라가게 범위를 알려 준다(스크롤 타임라인이 없는 브라우저는 스크롤마다 옮긴다)
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

  // 갈래 칩: 그 카드가 가운데 오게 바로 옮기고, 타임라인이 옅게 나타나며 올라온다(카드가 옆으로 날아가지 않는다)
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
    // 바깥에 reveal 을 내준다(렌더가 아니라 마운트 때 한 번)
    if (typeof ref === "function") ref({ reveal });
    else if (ref) (ref as React.RefObject<FocusTimelineApi | null>).current = { reveal };
    return () => {
      if (typeof ref === "function") ref(null);
      else if (ref) (ref as React.RefObject<FocusTimelineApi | null>).current = null;
    };
    // 줄기마다 한 번
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const picked = agendaId ? layout.leftOf.get(agendaId) : undefined;
    const room = scroller.clientWidth;
    if (picked !== undefined) scroller.scrollLeft = picked + CARD_W / 2 - room / 2;
    else if (layout.branches.length > 0) {
      // 첫 갈래가 처음 화면 밖이면, 갈라진 안건과 갈래 첫 카드가 함께 보이게 옮긴다
      const branch = layout.branches[0];
      const [parent, child] = [layout.leftOf.get(branch.fork.agendaId)!, layout.leftOf.get(branch.first.agendaId)!];
      if (child + CARD_W > room - 24) {
        // 카드가 반쯤 잘리지 않게 카드 칸에 맞춰 옮긴다. 갈라진 안건 카드는 늘 화면에 남긴다
        const slot = Math.ceil((child + CARD_W - room + 48 - FOCUS_PAD + 16) / SLOT_W);
        const keep = Math.round((parent - FOCUS_PAD) / SLOT_W);
        scroller.scrollLeft = FOCUS_PAD + Math.min(slot, keep) * SLOT_W - 16;
      }
    }
    // 줄기가 바뀌면 부모가 key 로 다시 세운다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={boxRef} data-focus-box="" className="relative border-t border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]">
      <style>{HEAD_SYNC_CSS}</style>
      <div ref={sentinelRef} aria-hidden className="pointer-events-none absolute top-0 left-0 h-px w-px" />
      {/* 날짜 머리 줄: 판의 열 머리와 같은 문법(날짜 굵게 + 옅은 +N일, 아래 회의 이름). 세로로 스크롤하면 화면 위에 붙고, 가로로는 카드와 함께 움직인다 */}
      <div
        data-focus-strip=""
        data-stuck={stuck ? "" : undefined}
        style={{ height: HEAD_H }}
        className="sticky top-0 z-[6] w-0 min-w-full overflow-hidden border-b border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] transition-shadow duration-150 data-[stuck]:shadow-e2"
      >
        <div ref={headRef} data-focus-head="" className="relative mx-auto h-full" style={{ width: layout.width }}>
          {cells.map(({ noteId, from, to, agenda }) => {
            const meeting = meetingOf.get(noteId)!;
            const days = daysAfterPrevious(map, meeting.index);
            return (
              <div
                key={noteId}
                data-focus-cell={noteId}
                className="absolute top-0 flex h-full flex-col items-center px-1 pt-2.5 text-center whitespace-nowrap"
                style={{ left: from, width: to - from }}
              >
                <span className="flex h-[18px] items-baseline gap-1 text-[13px] leading-[18px] tabular-nums">
                  <span className="font-bold text-[var(--el-ink)]">{dateLabel(map, agenda)}</span>
                  {days !== null ? <span className="text-xs font-normal text-[color-mix(in_srgb,var(--el-muted)_85%,var(--el-ink))]">+{days}일</span> : null}
                </span>
                <span className="mt-px block h-4 max-w-full truncate text-xs leading-4 text-[var(--el-body)]">{meetingHeading(meeting.title)}</span>
              </div>
            );
          })}
        </div>
      </div>
      {/* 가장자리의 이동 버튼: 타임라인이 화면보다 넓을 때, 더 갈 수 있는 쪽은 늘 보인다. 세로 스크롤은 CSS sticky 가 따라온다(머리 줄 아래 구간의 가운데) */}
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

          {layout.links
            .filter((link) => !link.fork)
            .map((link) => {
              const [a, b] = [map.agendaById.get(link.from)!, map.agendaById.get(link.to)!];
              if (a.noteId === b.noteId) return null;
              const days = daysBetween(map, a, b);
              return (
                <span
                  key={`gap:${link.from}>${link.to}`}
                  className="absolute -translate-x-1/2 text-xs leading-4 text-[var(--el-muted)] tabular-nums"
                  style={{
                    left: (dotX(link.from) + dotX(link.to)) / 2,
                    top: lineY(layout.rowOf.get(link.from)!) - 20,
                  }}
                >
                  +{days}일
                </span>
              );
            })}

          {/* 갈래 줄의 이름표: 줄이 화면 오른쪽에 있어도 왼쪽에 붙어 따라와서 갈래가 있다는 걸 알린다. 한 줄에 갈래가 여럿이면 하나로 묶는다 */}
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
                  갈래{here.length > 1 ? ` ${here.length}개` : ""}
                  <span className="text-[var(--el-muted)] tabular-nums">
                    {shortMeetingDate(meetingOf.get(here[0].first.noteId)!.startedAt)} 부터
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

/** 해가 바뀌는 카드(와 맨 처음 카드)에는 연도를 붙인다 */
function dateLabel(map: AgendaMap, agenda: MapAgenda) {
  const meeting = map.meetings.find((candidate) => candidate.noteId === agenda.noteId)!;
  const year = meetingYear(meeting.startedAt);
  return year === meetingYear(map.meetings.at(-1)!.startedAt)
    ? shortMeetingDate(meeting.startedAt)
    : `${year}.${shortMeetingDate(meeting.startedAt)}`;
}

function daysBetween(map: AgendaMap, a: MapAgenda, b: MapAgenda) {
  const [x, y] = [a, b].map((agenda) => map.meetings.findIndex((meeting) => meeting.noteId === agenda.noteId));
  let days = 0;
  for (let at = x + 1; at <= y; at += 1) days += daysAfterPrevious(map, at) ?? 0;
  return days;
}

const MEMBER_NAME: Record<string, string> = {
  DECISION: "결정",
  ACTION_ITEM: "할 일",
  ISSUE: "이슈",
  QUESTION: "질문",
};

/** 안건 카드. 날짜 · 회의명 · 제목 · 한 줄 요약 · 결정/할 일 수 · 회의록 링크 */
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
  const query = useGetMeetingReviewSummary(agenda.noteId);
  const item = okData(query.data)?.agendas.find((candidate) => candidate.agendaId === agenda.agendaId);
  const counts = Object.entries(
    (item?.members ?? []).reduce<Record<string, number>>((acc, member) => {
      if (MEMBER_NAME[member.kind]) acc[member.kind] = (acc[member.kind] ?? 0) + 1;
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
          {agenda.completed ? "완료" : "미완료"}
        </Badge>
      </p>
      <h4 className="mt-2 line-clamp-2 text-[14px] leading-5 font-semibold text-[var(--el-ink)]">{agenda.title}</h4>
      {query.isLoading ? (
        <div aria-label="안건 내용을 불러오는 중" className="mt-2 flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      ) : query.isError ? (
        <InlineRetry className="mt-2" label="내용을 불러오지 못했습니다" onRetry={() => void query.refetch()} />
      ) : item?.summary ? (
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-[18px] text-[var(--el-body)]">{item.summary}</p>
      ) : (
        <p className="mt-1.5 text-xs text-[var(--el-muted)]">이 안건은 정리된 내용이 없습니다.</p>
      )}
      <div className="mt-auto flex flex-col gap-1.5">
        {counts.length > 0 ? (
          <p className="text-xs text-[var(--el-muted)] tabular-nums">
            {counts.map(([kind, n]) => `${MEMBER_NAME[kind]} ${n}`).join(" · ")}
          </p>
        ) : null}
        <Link
          href={summaryHref(workspaceId, agenda.noteId, agenda.agendaId)}
          className="inline-flex items-center gap-1 self-start text-xs text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
        >
          회의록에서 보기
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}
