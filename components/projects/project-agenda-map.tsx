"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { ArrowUpRight, Minus, Plus, Scan, X } from "lucide-react";

import { SegmentedControl } from "@/components/heymoa/segmented-control";
import { InlineRetry } from "@/components/ui/inline-retry";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import {
  getGetMeetingReviewSummaryQueryOptions,
  useGetMeetingReviewSummary,
} from "@/lib/api/generated/meeting-review/meeting-review";
import type { MeetingReviewSummaryResponseDataAgendasItem } from "@/lib/api/generated/models";
import { useGetProjectMeetingLinks } from "@/lib/api/generated/projects/projects";
import { okData } from "@/lib/api/ok-data";
import {
  buildAgendaMap,
  daysAfterPrevious,
  laneLayout,
  meetingHeading,
  meetingYear,
  shortMeetingDate,
  topicOfRows,
  topicRows,
  type AgendaMap,
  type MapAgenda,
  type TopicRow,
} from "@/lib/projects/agenda-map";
import { cn } from "@/lib/utils";

/** 회의 머리(날짜 · 제목) 띠의 높이 */
const HEADER = 56;
/** 머리 띠 아래 첫 줄까지 */
const TOP = 22;
/** 주제 줄(레인) 하나의 높이 */
const LANE = 32;
/** 이어진 안건이 없는 안건 구역: 레인과의 간격, 한 줄 높이 */
const LOOSE_GAP = 36;
const LOOSE_ROW = 26;
const BOTTOM = 26;
/** 칸 왼쪽 끝에서 점까지 */
const INSET = 12;
/** 칸 폭(px)이 곧 확대 배율이다. 기본은 안건 이름이 한 줄 들어가는 폭 */
const DEFAULT_COLUMN = 208;
const MAX_COLUMN = 320;
/** 가장 좁은 칸. 점과 날짜만 남는다. 판에 회의가 다 들어가면 그 폭보다는 줄이지 않는다 */
const MIN_COLUMN = 48;
const STEP = 1.25;
/** 이 폭보다 좁은 자리에는 안건 이름을 적지 않는다(점만, 이름은 마우스를 올리면) */
const LABEL_ROOM = 56;
/** 이 폭보다 좁은 칸의 머리에는 회의 제목을 적지 않는다 */
const TITLE_ROOM = 96;

type Shown = "all" | "linked";
const SHOWN_OPTIONS: ReadonlyArray<{ value: Shown; label: string }> = [
  { value: "all", label: "모든 안건" },
  { value: "linked", label: "이어진 안건" },
];

/**
 * 고른 것. 안건을 고르면 그 안건이 든 주제 전체(갈래 포함)가 밝아지고 갈래가 펼쳐진다.
 * 주소의 `?topic=` 으로 열면 안건 없이 주제만 고른다.
 */
type Selection = { rowId: string | null; agendaId: string | null } | null;
type Tab = "agenda" | "flow";

/** 주소로 여는 처음 고를 것 */
export type Focus = { kind: "agenda" | "topic"; agendaId: string };

const summaryHref = (workspaceId: string, noteId: string, agendaId?: string) =>
  `/w/${workspaceId}/notes/${noteId}?view=full&tab=summary${agendaId ? `#summary-agenda-${agendaId}` : ""}`;

/**
 * 프로젝트 안건 지도. 회의가 가로로 한 줄 이어진 표다. 위쪽 머리 띠가 회의(누르면 회의록)이고 그 아래 세로 칸이 그
 * 회의의 안건이다. 주제 하나는 가로줄(레인) 하나를 곧게 지나가고(`laneLayout`), 갈래는 그 주제를 고를 때 바로 아래에
 * 펼친다. 판은 가로로 스크롤하고 아래 슬라이더로 옮긴다. 칸 폭이 확대 배율이다.
 * 연결은 회의 뒤 분석이 낸 `agendaLinks` 를 그대로 쓴다. 사람이 승인한 관계가 아니다(APP-1455 「안 하는 것」).
 */
export function ProjectAgendaMap({
  workspaceId,
  projectId,
  focus,
}: {
  workspaceId: string;
  projectId: string;
  /** 주소로 받은 처음 고를 것(`?agenda=` 안건, `?topic=` 주제의 마지막 안건) */
  focus?: Focus;
}) {
  const { projects } = useWorkspaceShell();
  const project = projects.find((candidate) => candidate.projectId === projectId);
  const query = useGetProjectMeetingLinks(projectId);
  const data = okData(query.data);
  // 안건이 없는 회의는 세우지 않는다. 안건 정본(APP-925) 이전 회의는 안건이 비어 있어, 그대로 두면 빈 칸이 시간축을
  // 덮는다. 몇 개를 뺐는지만 머리글에 적는다
  const withAgendas = useMemo(() => (data ? data.notes.filter((note) => note.agendas.length > 0) : []), [data]);
  const skipped = data ? data.notes.length - withAgendas.length : 0;
  const map = useMemo(() => (data ? buildAgendaMap({ ...data, notes: withAgendas }) : null), [data, withAgendas]);
  const rows = useMemo(() => (map ? topicRows(map).rows : []), [map]);
  const topics = rows.filter((row) => !row.branchOf).length;

  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName="overflow-x-hidden!">
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-11">
        <header className="border-b border-[var(--el-hairline)] pb-6">
          <p className="text-xs font-medium text-[var(--el-muted)]">안건 지도</p>
          <h2 className="mt-1 min-h-[1.05em] truncate text-screen-title font-light leading-[1.05] tracking-[-0.035em] text-[var(--el-ink)]">
            {project?.name}
          </h2>
          <p className="mt-3 min-h-6 text-sm leading-6 text-[var(--el-muted)]">
            {map
              ? `회의 ${map.meetings.length}개 · 주제 ${topics}개` +
                (skipped > 0 ? ` · 안건 없는 회의 ${skipped}개 제외` : "")
              : null}
          </p>
        </header>

        {query.isLoading ? (
          <MapSkeleton />
        ) : !map ? (
          <InlineRetry className="mt-6" label="안건 지도를 불러오지 못했습니다" onRetry={() => void query.refetch()} />
        ) : map.meetings.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--el-muted)]">
            아직 안건이 정리된 회의가 없습니다. 회의가 끝나면 안건이 여기에 모입니다.
          </p>
        ) : (
          <AgendaMapBody workspaceId={workspaceId} map={map} rows={rows} focus={focus} />
        )}
      </div>
    </ScrollArea>
  );
}

function AgendaMapBody({
  workspaceId,
  map,
  rows,
  focus,
}: {
  workspaceId: string;
  map: AgendaMap;
  rows: TopicRow[];
  focus?: Focus;
}) {
  const rowOfAgenda = useMemo(
    () =>
      new Map(rows.flatMap((row) => [...row.cells.values()].flat().map((agenda) => [agenda.agendaId, row] as const))),
    [rows]
  );
  const topicOf = useMemo(() => topicOfRows(rows), [rows]);
  const [shown, setShown] = useState<Shown>("all");
  const [selection, setSelection] = useState<Selection>(() => {
    const agenda = focus ? map.agendaById.get(focus.agendaId) : undefined;
    if (!focus || !agenda) return null;
    const row = rowOfAgenda.get(agenda.agendaId);
    return { rowId: row?.id ?? null, agendaId: focus.kind === "agenda" || !row ? agenda.agendaId : null };
  });
  const [tab, setTab] = useState<Tab>(selection?.agendaId ? "agenda" : "flow");
  const [column, setColumn] = useState(DEFAULT_COLUMN);
  // 이어진 안건이 없는 안건 구역은 평소 칸마다 개수로 접어 둔다. 주소로 그런 안건을 골라 열었으면 펼친다
  const [looseOpen, setLooseOpen] = useState(() =>
    Boolean(focus && map.agendaById.has(focus.agendaId) && !rowOfAgenda.has(focus.agendaId))
  );

  const topic = selection?.rowId ? (topicOf.get(selection.rowId) ?? null) : null;
  const layout = useMemo(() => laneLayout(map, rows, new Set(topic ? [topic] : [])), [map, rows, topic]);
  // 밝힐 안건: 고른 주제의 안건 전부(갈래 포함), 이어진 안건이 없으면 그 안건 하나
  const lit = useMemo(() => {
    if (!selection) return null;
    if (!topic) return new Set(selection.agendaId ? [selection.agendaId] : []);
    return new Set(
      rows
        .filter((row) => topicOf.get(row.id) === topic)
        .flatMap((row) => [...row.cells.values()].flat().map((agenda) => agenda.agendaId))
    );
  }, [selection, topic, rows, topicOf]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, left: 0 });
  const count = map.meetings.length;
  // 판에 회의가 다 들어가는 폭보다는 줄이지 않는다. 더 줄이면 오른쪽이 빈 바탕이 된다
  const fitColumn =
    viewport.width > 0 ? Math.min(MAX_COLUMN, Math.max(MIN_COLUMN, viewport.width / count)) : MIN_COLUMN;
  const minColumn = Math.min(fitColumn, DEFAULT_COLUMN);
  const width = count * column;

  // 확대·축소 뒤 그 자리(마우스나 판 가운데)가 그대로 있게 스크롤을 맞춘다
  const anchor = useRef<{ at: number; offset: number } | null>(null);
  const zoomTo = useCallback(
    (next: number, offset?: number) => {
      const scroller = scrollRef.current;
      const clamped = Math.min(MAX_COLUMN, Math.max(minColumn, next));
      if (!scroller || clamped === column) return;
      const from = offset ?? scroller.clientWidth / 2;
      anchor.current = { at: (scroller.scrollLeft + from) / column, offset: from };
      setColumn(clamped);
    },
    [column, minColumn]
  );
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !anchor.current) return;
    scroller.scrollLeft = anchor.current.at * column - anchor.current.offset;
    anchor.current = null;
  }, [column]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const read = () => setViewport({ width: scroller.clientWidth, left: scroller.scrollLeft });
    // 처음엔 가장 최근 회의가 보이게 오른쪽 끝에서 연다. 주소로 고른 안건이 있으면 그 회의를 가운데에
    const agenda = focus ? map.agendaById.get(focus.agendaId) : undefined;
    const at = agenda ? map.meetings.findIndex((meeting) => meeting.noteId === agenda.noteId) : -1;
    scroller.scrollLeft = at < 0 ? scroller.scrollWidth : (at + 0.5) * DEFAULT_COLUMN - scroller.clientWidth / 2;
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(scroller);
    return () => observer.disconnect();
    // 처음 열 때 한 번만 자리를 잡는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⌘/Ctrl + 휠(트랙패드 핀치 포함)은 확대, 그냥 휠은 페이지와 가로 스크롤에 맡긴다
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = scroller.getBoundingClientRect();
      zoomTo(column * Math.exp(-event.deltaY * 0.01), event.clientX - rect.left);
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [column, zoomTo]);

  // 고른 것을 주소에 남긴다. 회의록에 갔다 돌아와도, 주소를 건네도 같은 자리가 열린다. 같은 화면의 상태라 라우터를
  // 거치지 않는다
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("agenda");
    url.searchParams.delete("topic");
    const row = selection?.rowId ? rows.find((candidate) => candidate.id === selection.rowId) : undefined;
    if (selection?.agendaId) url.searchParams.set("agenda", selection.agendaId);
    else if (row) url.searchParams.set("topic", [...row.cells.values()].flat().at(-1)!.agendaId);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [selection, rows]);

  // 고르면 그 안건의 회의가 화면 밖일 때만 가운데로 옮긴다
  const pick = (agenda: MapAgenda) => {
    setSelection({ rowId: rowOfAgenda.get(agenda.agendaId)?.id ?? null, agendaId: agenda.agendaId });
    setTab("agenda");
    const scroller = scrollRef.current;
    if (!scroller) return;
    const at = map.meetings.findIndex((meeting) => meeting.noteId === agenda.noteId);
    const [from, to] = [at * column, (at + 1) * column];
    if (from >= scroller.scrollLeft && to <= scroller.scrollLeft + scroller.clientWidth) return;
    scroller.scrollTo({ left: (at + 0.5) * column - scroller.clientWidth / 2, behavior: "smooth" });
  };

  // 자리 → 판 안의 좌표. 점의 가운데다
  const laneY = (lane: number) => HEADER + TOP + lane * LANE;
  const looseTop = HEADER + TOP + layout.laneCount * LANE + LOOSE_GAP;
  const hasLoose = shown === "all" && layout.loose.size > 0;
  const looseDepth = hasLoose
    ? looseOpen
      ? Math.max(...[...layout.loose.values()].map((agendas) => agendas.length))
      : 1
    : 0;
  const height =
    looseDepth > 0
      ? looseTop + (looseDepth - 1) * LOOSE_ROW + BOTTOM
      : laneY(Math.max(0, layout.laneCount - 1)) + BOTTOM;

  // 같은 회의 안에서 이어진 안건은 점 하나로 합친다. 실제 이어짐의 4분의 1이 이 경우라 나란히 세우면 칸이 쪼개져 이름이
  // 잘린다. 대표는 그 칸의 첫 안건이고, 나머지는 대표 점을 가리킨다(`alias`)
  type Point = { x: number; y: number; members: MapAgenda[] };
  const points = new Map<string, Point>();
  const alias = new Map<string, string>();
  const cells = new Map<string, { meeting: number; lane: number; ids: [number, string][] }>();
  for (const [agendaId, seat] of layout.seats) {
    const key = `${seat.lane}:${seat.meeting}`;
    const cell = cells.get(key) ?? { meeting: seat.meeting, lane: seat.lane, ids: [] };
    cell.ids.push([seat.slot, agendaId]);
    cells.set(key, cell);
  }
  for (const cell of cells.values()) {
    const ids = cell.ids.sort(([a], [b]) => a - b).map(([, id]) => id);
    for (const id of ids) alias.set(id, ids[0]);
    points.set(ids[0], {
      x: cell.meeting * column + INSET,
      y: laneY(cell.lane),
      members: ids.map((id) => map.agendaById.get(id)!),
    });
  }
  if (hasLoose && looseOpen) {
    for (const [meeting, agendas] of layout.loose) {
      agendas.forEach((agenda, at) => {
        alias.set(agenda.agendaId, agenda.agendaId);
        points.set(agenda.agendaId, { x: meeting * column + INSET, y: looseTop + at * LOOSE_ROW, members: [agenda] });
      });
    }
  }
  const room = column - INSET - 12;
  // 회의가 수백 개면 안건이 수천 개다. 화면에 보이는 칸과 양옆 한 화면씩만 그린다 — 스크롤하면 따라 그린다
  const [drawFrom, drawTo] = [viewport.left - viewport.width, viewport.left + viewport.width * 2];
  const near = (x: number) => viewport.width === 0 || (x >= drawFrom && x <= drawTo);
  const drawn = [...points].filter(([, point]) => near(point.x));
  type Edge = { key: string; from: string; to: string; on: boolean; dashed: boolean };
  const edges = new Map<string, Edge>();
  for (const link of map.links) {
    const [from, to] = [alias.get(link.from), alias.get(link.to)];
    if (!from || !to || from === to) continue;
    const [a, b] = [points.get(from)!, points.get(to)!];
    // 양끝 중 하나라도 그리는 구간에 들거나, 구간을 가로지르면 그린다
    if (!near(a.x) && !near(b.x) && !(a.x < drawFrom && b.x > drawTo)) continue;
    const key = `${from}>${to}`;
    const on = lit !== null && lit.has(link.from) && lit.has(link.to);
    edges.set(key, { key, from, to, on: on || (edges.get(key)?.on ?? false), dashed: link.sameMeeting });
  }
  // 선이 지나는 높이. 같은 줄이면 직선, 줄이 바뀌면 양끝이 수평인 곡선이다
  const curve = (from: Point, to: Point) => {
    const [x1, y1, x2, y2] = [from.x + 5, from.y, to.x - 6, to.y];
    const bend = (x2 - x1) / 2;
    const d =
      y1 === y2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`;
    const yAt = (x: number) => {
      if (y1 === y2) return y1;
      // 곡선은 x 가 t 에 따라 늘기만 하니 반으로 나눠 찾는다
      const ease = (t: number) => 3 * t * t - 2 * t * t * t;
      const xOf = (t: number) =>
        (1 - t) ** 3 * x1 + 3 * t * (1 - t) ** 2 * (x1 + bend) + 3 * t * t * (1 - t) * (x2 - bend) + t ** 3 * x2;
      let [lo, hi] = [0, 1];
      for (let step = 0; step < 24; step += 1) {
        const mid = (lo + hi) / 2;
        if (xOf(mid) < x) lo = mid;
        else hi = mid;
      }
      return y1 + (y2 - y1) * ease((lo + hi) / 2);
    };
    return { d, yAt };
  };
  // 판 밖에서 들어오거나 판 밖으로 나가는 선에는 화면 가장자리에 그 회의 날짜를 단다. 누르면 그 안건으로 간다
  const meetingDate = (agenda: MapAgenda) =>
    shortMeetingDate(map.meetings.find((meeting) => meeting.noteId === agenda.noteId)!.startedAt);
  const [edgeLeft, edgeRight] = [viewport.left + 6, viewport.left + viewport.width - 6];
  const tags: { key: string; side: "in" | "out"; x: number; y: number; target: MapAgenda; on: boolean }[] = [];
  if (viewport.width > 0) {
    const taken = new Set<string>();
    for (const edge of edges.values()) {
      const [a, b] = [points.get(edge.from)!, points.get(edge.to)!];
      const { yAt } = curve(a, b);
      if (a.x < edgeLeft && b.x > edgeLeft + 40 && b.x < edgeRight) {
        const y = Math.round(yAt(edgeLeft));
        if (!taken.has(`in:${y}`))
          tags.push({ key: `in:${edge.key}`, side: "in", x: edgeLeft, y, target: a.members.at(-1)!, on: edge.on });
        taken.add(`in:${y}`);
      } else if (b.x > edgeRight && a.x < edgeRight - 40 && a.x > edgeLeft) {
        const y = Math.round(yAt(edgeRight));
        if (!taken.has(`out:${y}`))
          tags.push({ key: `out:${edge.key}`, side: "out", x: edgeRight, y, target: b.members[0], on: edge.on });
        taken.add(`out:${y}`);
      }
    }
  }

  return (
    <div className={cn("mt-6 grid gap-6", selection && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
      <section aria-label="안건 지도" className="min-w-0">
        <div className="mb-2.5 flex items-center justify-end gap-2">
          <SegmentedControl
            label="보일 안건"
            value={shown}
            options={SHOWN_OPTIONS}
            onChange={(next) => {
              setShown(next);
              if (next === "linked" && selection && !selection.rowId) setSelection(null);
            }}
          />
        </div>

        <div className="relative overflow-hidden rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]">
          <div
            ref={scrollRef}
            data-agenda-map=""
            onScroll={(event) => {
              const left = event.currentTarget.scrollLeft;
              setViewport((current) => ({ ...current, left }));
            }}
            onKeyDown={(event) => {
              if (event.metaKey || event.ctrlKey || event.altKey) return;
              if (event.key === "+" || event.key === "=") zoomTo(column * STEP);
              else if (event.key === "-" || event.key === "_") zoomTo(column / STEP);
              else if (event.key === "Escape") setSelection(null);
              else return;
              event.preventDefault();
            }}
            className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="relative" style={{ width, height }}>
              {/* 회의 칸. 머리와 세로 경계선이 한 요소라 늘 같은 자리에 선다 */}
              {map.meetings.map((meeting, at) => {
                if (!near(at * column) && !near((at + 1) * column)) return null;
                const days = daysAfterPrevious(map, at);
                // 해가 바뀌는 첫 회의(와 맨 처음 회의)에는 연도를 붙인다
                const year =
                  at === 0 || meetingYear(map.meetings[at - 1].startedAt) !== meetingYear(meeting.startedAt)
                    ? meetingYear(meeting.startedAt)
                    : null;
                return (
                  <div
                    key={meeting.noteId}
                    className={cn(
                      "absolute top-0 bottom-0",
                      at > 0 && "border-l border-dashed border-[var(--el-hairline-strong)]"
                    )}
                    style={{ left: at * column, width: column }}
                  >
                    <Link
                      href={summaryHref(workspaceId, meeting.noteId)}
                      title={`${meeting.title} · 회의록 열기`}
                      className="group/head flex flex-col gap-0.5 overflow-hidden border-b border-[var(--el-hairline)] bg-[var(--el-surface-card)] px-2.5 pt-2 hover:bg-[var(--el-canvas-soft)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--el-ink)]"
                      style={{ height: HEADER }}
                    >
                      <span className="flex items-baseline gap-1.5 text-[11px] whitespace-nowrap tabular-nums">
                        <span className="font-semibold text-[var(--el-ink)]">
                          {year ? <span className="font-normal text-[var(--el-muted)]">{year}.</span> : null}
                          {shortMeetingDate(meeting.startedAt)}
                        </span>
                        {days !== null && column >= TITLE_ROOM ? (
                          <span className="text-[var(--el-muted-soft)]">+{days}일</span>
                        ) : null}
                      </span>
                      {column >= TITLE_ROOM ? (
                        <span className="line-clamp-2 text-[11px] leading-[14px] text-[var(--el-muted)] group-hover/head:text-[var(--el-ink)] group-hover/head:underline">
                          {meetingHeading(meeting.title)}
                        </span>
                      ) : null}
                    </Link>
                  </div>
                );
              })}

              {hasLoose ? (
                <div
                  className="pointer-events-none absolute right-0 left-0 border-t border-[var(--el-hairline)]"
                  style={{ top: looseTop - LOOSE_GAP / 2 - 4 }}
                >
                  <button
                    type="button"
                    aria-expanded={looseOpen}
                    onClick={() => setLooseOpen((open) => !open)}
                    className="pointer-events-auto sticky left-0 inline-block -translate-y-1/2 bg-[var(--el-canvas-soft)] px-2.5 text-[10.5px] leading-3 text-[var(--el-muted)] hover:text-[var(--el-ink)]"
                  >
                    이어진 안건 없음 ·{" "}
                    <span className="underline underline-offset-2">{looseOpen ? "접기" : "펼치기"}</span>
                  </button>
                </div>
              ) : null}
              {hasLoose && !looseOpen
                ? [...layout.loose].map(([meeting, agendas]) =>
                    near(meeting * column) ? (
                      <button
                        key={meeting}
                        type="button"
                        onClick={() => setLooseOpen(true)}
                        title={agendas.map((agenda) => agenda.title).join("\n")}
                        className="absolute flex h-5 items-center text-[11px] text-[var(--el-muted)] tabular-nums hover:text-[var(--el-ink)] hover:underline"
                        style={{ left: meeting * column + INSET - 2, top: looseTop - 10 }}
                      >
                        {column >= TITLE_ROOM ? `안건 ${agendas.length}개` : agendas.length}
                      </button>
                    ) : null
                  )
                : null}

              <svg aria-hidden className="pointer-events-none absolute inset-0" width={width} height={height}>
                <defs>
                  <marker
                    id="agenda-arrow"
                    viewBox="0 0 6 6"
                    refX="5"
                    refY="3"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 z" fill="context-stroke" />
                  </marker>
                </defs>
                {[...edges.values()].map((edge) => (
                  <path
                    key={edge.key}
                    d={curve(points.get(edge.from)!, points.get(edge.to)!).d}
                    fill="none"
                    stroke="var(--el-ink)"
                    strokeWidth={edge.on ? 1.5 : 1}
                    strokeDasharray={edge.dashed ? "3 3" : undefined}
                    markerEnd="url(#agenda-arrow)"
                    className={cn(
                      "transition-opacity motion-reduce:transition-none",
                      lit === null ? "opacity-40" : edge.on ? "opacity-100" : "opacity-[0.08]"
                    )}
                  />
                ))}
              </svg>

              {drawn.map(([agendaId, point]) => {
                const pickedAt = point.members.findIndex((member) => member.agendaId === selection?.agendaId);
                const shownAgenda = point.members[Math.max(0, pickedAt)];
                const on = lit === null || point.members.some((member) => lit.has(member.agendaId));
                const folded = point.members.reduce(
                  (sum, member) => sum + (layout.folded.get(member.agendaId) ?? 0),
                  0
                );
                const labelled = room >= LABEL_ROOM;
                const merged = point.members.length;
                const date = meetingDate(shownAgenda);
                return (
                  <button
                    key={agendaId}
                    type="button"
                    aria-pressed={pickedAt >= 0}
                    aria-label={`${date} ${point.members.map((member) => member.title).join(" · ")}${merged > 1 ? ` · 같은 회의에서 ${merged}번 이어짐` : ""}${folded ? ` · 접힌 갈래 안건 ${folded}개` : ""}`}
                    title={point.members.map((member) => member.title).join("\n")}
                    // 합친 점은 누를 때마다 그 회의 안의 다음 안건으로 넘어간다
                    onClick={() => pick(point.members[(pickedAt + 1) % merged])}
                    className={cn(
                      "group/agenda absolute flex h-5 items-center gap-1.5 rounded-control pr-1 text-left transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--el-ink)] motion-reduce:transition-none",
                      on ? "opacity-100" : "opacity-30"
                    )}
                    style={{ left: point.x - 5, top: point.y - 10, maxWidth: labelled ? room + 10 : 14 }}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-2.5 shrink-0 rounded-full border-[1.5px] border-[var(--el-ink)]",
                        pickedAt >= 0 ? "bg-[var(--el-ink)]" : "bg-[var(--el-canvas-soft)]",
                        // 합친 점은 겹친 원 두 개로 그린다
                        merged > 1 && "shadow-[2px_-2px_0_-0.5px_var(--el-canvas-soft),2px_-2px_0_0.5px_var(--el-ink)]"
                      )}
                    />
                    {labelled ? (
                      <span
                        className={cn(
                          "truncate bg-[var(--el-canvas-soft)] text-[11px] leading-4 group-hover/agenda:underline",
                          lit && on ? "text-[var(--el-ink)]" : "text-[var(--el-body)]",
                          pickedAt >= 0 && "font-semibold"
                        )}
                      >
                        {shownAgenda.title}
                      </span>
                    ) : null}
                    {merged > 1 && labelled ? <Chip>×{merged}</Chip> : null}
                    {folded > 0 && labelled ? <Chip>+{folded}</Chip> : null}
                  </button>
                );
              })}

              {tags.map((tag) => (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => pick(tag.target)}
                  title={`${meetingDate(tag.target)} ${tag.target.title}`}
                  className={cn(
                    "absolute h-4 rounded-full border border-[var(--el-hairline-strong)] bg-[var(--el-surface-card)] px-1.5 text-[10px] leading-[14px] text-[var(--el-muted)] tabular-nums transition-opacity hover:text-[var(--el-ink)] motion-reduce:transition-none",
                    tag.side === "out" && "-translate-x-full",
                    lit !== null && !tag.on && "opacity-30"
                  )}
                  style={{ left: tag.x, top: tag.y - 8 }}
                >
                  {tag.side === "in" ? `${meetingDate(tag.target)}에서` : `${meetingDate(tag.target)}로`}
                </button>
              ))}
            </div>
          </div>

          <div className="absolute right-2 bottom-2 flex overflow-hidden rounded-control border border-[var(--el-hairline)] bg-[var(--el-surface-card)]">
            <ControlButton label="축소" disabled={column <= minColumn + 0.5} onClick={() => zoomTo(column / STEP)}>
              <Minus aria-hidden className="size-3.5" />
            </ControlButton>
            <ControlButton label="확대" disabled={column >= MAX_COLUMN - 0.5} onClick={() => zoomTo(column * STEP)}>
              <Plus aria-hidden className="size-3.5" />
            </ControlButton>
            <ControlButton
              label={fitColumn > MIN_COLUMN ? "회의 전체 보기" : "가장 작게 보기"}
              disabled={Math.abs(column - minColumn) < 0.5}
              onClick={() => zoomTo(minColumn)}
            >
              <Scan aria-hidden className="size-3.5" />
            </ControlButton>
          </div>
        </div>

        <TimeSlider map={map} scroller={scrollRef} column={column} viewport={viewport} />

        <p className="mt-2 text-xs leading-5 text-[var(--el-muted)]">
          위쪽 회의를 누르면 회의록이 열리고, 안건을 누르면 그 주제가 밝아집니다. 「×N」은 한 회의에서 이어진 안건,
          「+N」은 접힌 갈래입니다. AI가 찾은 연결이라 틀릴 수 있습니다.
        </p>
      </section>

      {selection ? (
        <SidePanel
          workspaceId={workspaceId}
          map={map}
          rows={rows}
          topicOf={topicOf}
          rowOfAgenda={rowOfAgenda}
          selection={selection}
          tab={tab}
          onTab={setTab}
          onPick={pick}
          onClose={() => setSelection(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * 판 아래 슬라이더. 막대 전체가 회의 전체이고 손잡이가 지금 보이는 구간이다. 손잡이를 끌거나 막대를 눌러 옮긴다.
 * 양끝에 첫 회의와 마지막 회의 날짜를 적는다. 회의가 판에 다 들어가면 그리지 않는다.
 */
function TimeSlider({
  map,
  scroller,
  column,
  viewport,
}: {
  map: AgendaMap;
  scroller: React.RefObject<HTMLDivElement | null>;
  column: number;
  viewport: { width: number; left: number };
}) {
  const track = useRef<HTMLDivElement>(null);
  const total = map.meetings.length * column;
  if (viewport.width === 0 || total <= viewport.width + 1) return null;
  const ratio = viewport.width / total;
  const max = total - viewport.width;
  const scrollTo = (left: number, smooth = false) =>
    scroller.current?.scrollTo({ left: Math.min(max, Math.max(0, left)), behavior: smooth ? "smooth" : "auto" });
  const first = Math.min(map.meetings.length - 1, Math.floor(viewport.left / column));
  const last = Math.min(map.meetings.length - 1, Math.ceil((viewport.left + viewport.width) / column) - 1);

  return (
    <div
      className={cn(
        "mt-2.5 flex items-center gap-3 text-[11px] text-[var(--el-muted)] tabular-nums",
        map.meetings.length > TICK_LIMIT && "pb-3.5"
      )}
    >
      <span className="shrink-0">{fullDate(map.meetings[0].startedAt)}</span>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="보이는 회의 구간"
        aria-valuemin={1}
        aria-valuemax={map.meetings.length}
        aria-valuenow={first + 1}
        aria-valuetext={`${shortMeetingDate(map.meetings[first].startedAt)}부터 ${shortMeetingDate(map.meetings[last].startedAt)}까지`}
        className="relative h-2 flex-1 cursor-pointer touch-none rounded-full bg-[var(--el-hairline)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-ink)]"
        onPointerDown={(event) => {
          const rect = track.current!.getBoundingClientRect();
          const thumbLeft = rect.left + (viewport.left / total) * rect.width;
          const onThumb = event.clientX >= thumbLeft && event.clientX <= thumbLeft + ratio * rect.width;
          // 손잡이를 잡으면 잡은 자리를 지키며 끌고, 막대를 누르면 그 자리가 손잡이 가운데로 온다
          const grab = onThumb ? event.clientX - thumbLeft : (ratio * rect.width) / 2;
          const toLeft = (clientX: number) => ((clientX - rect.left - grab) / rect.width) * total;
          if (!onThumb) scrollTo(toLeft(event.clientX), true);
          const move = (next: PointerEvent) => scrollTo(toLeft(next.clientX));
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
        onKeyDown={(event) => {
          const by: Record<string, number> = {
            ArrowRight: column,
            ArrowLeft: -column,
            PageDown: viewport.width,
            PageUp: -viewport.width,
          };
          if (event.key === "Home") scrollTo(0, true);
          else if (event.key === "End") scrollTo(max, true);
          else if (by[event.key]) scrollTo(viewport.left + by[event.key], true);
          else return;
          event.preventDefault();
        }}
      >
        {map.meetings.length <= TICK_LIMIT
          ? map.meetings.map((meeting, at) => (
              <span
                key={meeting.noteId}
                aria-hidden
                className="pointer-events-none absolute top-1/2 size-[3px] -translate-y-1/2 rounded-full bg-[var(--el-muted-soft)]"
                style={{ left: `${((at + 0.5) / map.meetings.length) * 100}%` }}
              />
            ))
          : map.meetings.map((meeting, at) =>
              at > 0 && meetingYear(map.meetings[at - 1].startedAt) !== meetingYear(meeting.startedAt) ? (
                <span
                  key={meeting.noteId}
                  aria-hidden
                  className="pointer-events-none absolute top-[-3px] h-3.5 border-l border-[var(--el-muted-soft)]"
                  style={{ left: `${(at / map.meetings.length) * 100}%` }}
                >
                  <span className="absolute top-3.5 left-0 -translate-x-1/2 pt-0.5 text-[10px] leading-3 text-[var(--el-muted)]">
                    {meetingYear(meeting.startedAt)}
                  </span>
                </span>
              ) : null
            )}
        <span
          aria-hidden
          className="absolute top-1/2 h-3.5 -translate-y-1/2 cursor-grab rounded-full border border-[var(--el-hairline-strong)] bg-[var(--el-surface-card)] shadow-e2 active:cursor-grabbing"
          style={{ left: `${(viewport.left / total) * 100}%`, width: `${Math.max(ratio * 100, 4)}%` }}
        />
      </div>
      <span className="shrink-0">{fullDate(map.meetings.at(-1)!.startedAt)}</span>
    </div>
  );
}

const fullDate = (startedAt: string) => `${meetingYear(startedAt)}.${shortMeetingDate(startedAt)}`;

/** 슬라이더에 회의마다 눈금을 찍는 한도. 넘으면 해가 바뀌는 자리에만 찍는다 */
const TICK_LIMIT = 40;

/** 주제 하나가 이보다 길면 가운데를 접는다. 앞 `HEAD` 개와 뒤 `TAIL` 개만 보인다 */
const LONG_TOPIC = 7;
const HEAD = 2;
const TAIL = 3;

/** 오른쪽 사이드 탭. 「안건」은 고른 안건의 내용과 앞뒤 안건, 「흐름」은 고른 주제의 안건 순서(갈래 포함) */
function SidePanel({
  workspaceId,
  map,
  rows,
  topicOf,
  rowOfAgenda,
  selection,
  tab,
  onTab,
  onPick,
  onClose,
}: {
  workspaceId: string;
  map: AgendaMap;
  rows: TopicRow[];
  topicOf: Map<string, string>;
  rowOfAgenda: Map<string, TopicRow>;
  selection: NonNullable<Selection>;
  tab: Tab;
  onTab: (next: Tab) => void;
  onPick: (agenda: MapAgenda) => void;
  onClose: () => void;
}) {
  const agenda = selection.agendaId ? map.agendaById.get(selection.agendaId) : undefined;
  const topic = selection.rowId ? topicOf.get(selection.rowId) : undefined;
  const topicRowsOf = topic ? rows.filter((row) => topicOf.get(row.id) === topic) : [];
  const main = topicRowsOf.find((row) => !row.branchOf);

  return (
    <aside
      aria-label="고른 안건"
      className="relative flex min-w-0 flex-col rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)] lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)] lg:self-start"
    >
      <button
        type="button"
        aria-label="닫기"
        title="닫기"
        onClick={onClose}
        className="absolute top-3 right-3 z-10 text-[var(--el-muted)] hover:text-[var(--el-ink)]"
      >
        <X aria-hidden className="size-4" />
      </button>
      <Tabs value={tab} onValueChange={(value) => onTab(value as Tab)} className="min-h-0 gap-0">
        <div className="border-b border-[var(--el-hairline)] px-4">
          <TabsList variant="line" className="gap-4 p-0 group-data-horizontal/tabs:h-10">
            <TabsTrigger value="agenda" disabled={!agenda} className="flex-none px-0 text-[13px]">
              안건
            </TabsTrigger>
            <TabsTrigger value="flow" disabled={!main} className="flex-none px-0 text-[13px]">
              흐름
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          <TabsContent value="agenda">
            {agenda ? (
              <AgendaDetail
                key={agenda.agendaId}
                workspaceId={workspaceId}
                map={map}
                agenda={agenda}
                rowOfAgenda={rowOfAgenda}
                onPick={onPick}
              />
            ) : null}
          </TabsContent>
          <TabsContent value="flow">
            {main ? (
              <TopicFlow
                key={main.id}
                map={map}
                rows={topicRowsOf}
                main={main}
                picked={selection.agendaId}
                onPick={onPick}
              />
            ) : null}
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}

const MEMBER_NAME: Record<string, string> = { DECISION: "결정", ACTION_ITEM: "할 일", ISSUE: "이슈", QUESTION: "질문" };

/**
 * 고른 안건의 내용. 회의록 요약의 그 안건(한 줄 요약 · 결정·할 일 개수 · 결론 · 남은 질문)과 앞뒤 안건이다. 다음 안건이
 * 둘 이상이면 여기서 갈라진 것이라, 갈래마다 다음 안건의 한 줄 요약을 나란히 둔다.
 */
function AgendaDetail({
  workspaceId,
  map,
  agenda,
  rowOfAgenda,
  onPick,
}: {
  workspaceId: string;
  map: AgendaMap;
  agenda: MapAgenda;
  rowOfAgenda: Map<string, TopicRow>;
  onPick: (agenda: MapAgenda) => void;
}) {
  const meeting = map.meetings.find((candidate) => candidate.noteId === agenda.noteId)!;
  const summaryQuery = useGetMeetingReviewSummary(agenda.noteId);
  const item = okData(summaryQuery.data)?.agendas.find((candidate) => candidate.agendaId === agenda.agendaId);
  const previous = map.links
    .filter((link) => link.to === agenda.agendaId)
    .map((link) => map.agendaById.get(link.from)!);
  const next = map.links.filter((link) => link.from === agenda.agendaId).map((link) => map.agendaById.get(link.to)!);
  // 다음 안건들의 회의 요약. 같은 회의는 한 번만 읽는다
  const nextNotes = [...new Set(next.map((candidate) => candidate.noteId))];
  const nextSummaries = useQueries({
    queries: nextNotes.map((noteId) => getGetMeetingReviewSummaryQueryOptions(noteId)),
  });
  const nextItem = (candidate: MapAgenda) =>
    okData(nextSummaries[nextNotes.indexOf(candidate.noteId)]?.data)?.agendas.find(
      (entry) => entry.agendaId === candidate.agendaId
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="pr-6">
        <h3 className="text-[15px] leading-[21px] font-semibold text-balance text-[var(--el-ink)]">{agenda.title}</h3>
        <p className="mt-1 text-xs text-[var(--el-muted)]">
          <span className="whitespace-nowrap tabular-nums">{shortMeetingDate(meeting.startedAt)}</span> ·{" "}
          {meetingHeading(meeting.title)}
        </p>
      </div>

      {summaryQuery.isLoading ? (
        <div aria-label="안건 내용을 불러오는 중" className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="mt-1.5 h-3.5 w-2/5" />
        </div>
      ) : summaryQuery.isError ? (
        <InlineRetry label="안건 내용을 불러오지 못했습니다" onRetry={() => void summaryQuery.refetch()} />
      ) : item ? (
        <AgendaContent item={item} />
      ) : (
        <p className="text-xs text-[var(--el-muted)]">이 안건은 정리된 내용이 없습니다.</p>
      )}

      {previous.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-semibold text-[var(--el-muted)]">이어받은 안건</h4>
          {previous.map((candidate) => (
            <StepButton key={candidate.agendaId} map={map} agenda={candidate} onPick={onPick} />
          ))}
        </div>
      ) : null}

      {next.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-semibold text-[var(--el-muted)]">
            {next.length > 1 ? `여기서 ${next.length}갈래로 나뉨` : "다음 안건"}
          </h4>
          <ul className="flex flex-col gap-2.5">
            {next.map((candidate) => {
              const entry = nextItem(candidate);
              const loading = nextSummaries[nextNotes.indexOf(candidate.noteId)]?.isLoading;
              // 갈래(접혀 있던 쪽)는 옅은 줄, 같은 줄기를 잇는 쪽은 진한 줄
              const branch = rowOfAgenda.get(candidate.agendaId)?.branchOf?.agendaId === agenda.agendaId;
              return (
                <li
                  key={candidate.agendaId}
                  className={cn(
                    "flex flex-col gap-1",
                    next.length > 1 && "border-l-2 pl-2.5",
                    branch ? "border-[var(--el-hairline-strong)]" : "border-[var(--el-ink)]"
                  )}
                >
                  <StepButton map={map} agenda={candidate} onPick={onPick} />
                  {loading ? (
                    <Skeleton className="h-3.5 w-4/5" />
                  ) : entry?.summary ? (
                    <p className="text-xs leading-[18px] text-[var(--el-muted)]">{entry.summary}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <Link
        href={summaryHref(workspaceId, agenda.noteId, agenda.agendaId)}
        className="inline-flex items-center gap-1 self-start text-xs text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
      >
        회의록에서 보기
        <ArrowUpRight aria-hidden className="size-3.5" />
      </Link>
    </div>
  );
}

function AgendaContent({ item }: { item: MeetingReviewSummaryResponseDataAgendasItem }) {
  const counts = Object.entries(
    item.members.reduce<Record<string, number>>((acc, member) => {
      if (MEMBER_NAME[member.kind]) acc[member.kind] = (acc[member.kind] ?? 0) + 1;
      return acc;
    }, {})
  );
  return (
    <div className="flex flex-col gap-3 text-[13px] leading-5 text-[var(--el-body)]">
      {item.summary ? <p>{item.summary}</p> : null}
      {counts.length > 0 ? (
        <p className="text-xs text-[var(--el-muted)] tabular-nums">
          {counts.map(([kind, count]) => `${MEMBER_NAME[kind]} ${count}`).join(" · ")}
        </p>
      ) : null}
      {item.conclusions.length > 0 ? (
        <TextList title="결론" lines={item.conclusions.map((entry) => entry.text)} />
      ) : null}
      {item.openItems.length > 0 ? (
        <TextList title="남은 질문" lines={item.openItems.map((entry) => entry.text)} />
      ) : null}
    </div>
  );
}

function TextList({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-xs font-semibold text-[var(--el-muted)]">{title}</h4>
      <ul className="flex list-disc flex-col gap-1 pl-4 marker:text-[var(--el-muted-soft)]">
        {lines.map((line, at) => (
          <li key={at}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function StepButton({
  map,
  agenda,
  onPick,
}: {
  map: AgendaMap;
  agenda: MapAgenda;
  onPick: (agenda: MapAgenda) => void;
}) {
  const meeting = map.meetings.find((candidate) => candidate.noteId === agenda.noteId)!;
  return (
    <button
      type="button"
      onClick={() => onPick(agenda)}
      className="flex items-baseline gap-2 text-left text-[13px] text-[var(--el-ink)] hover:underline"
    >
      <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">
        {shortMeetingDate(meeting.startedAt)}
      </span>
      {agenda.title}
    </button>
  );
}

/** 주제의 안건 순서. 갈래는 갈라진 안건 아래에 들여 쓴다. 줄기가 길면 가운데를 접는다 */
function TopicFlow({
  map,
  rows,
  main,
  picked,
  onPick,
}: {
  map: AgendaMap;
  rows: TopicRow[];
  main: TopicRow;
  picked: string | null;
  onPick: (agenda: MapAgenda) => void;
}) {
  const [opened, setOpened] = useState(false);
  const indexOf = (noteId: string) => map.meetings.findIndex((meeting) => meeting.noteId === noteId);
  const stepsOf = (row: TopicRow) =>
    [...row.cells.entries()].sort(([a], [b]) => indexOf(a) - indexOf(b)).flatMap(([, agendas]) => agendas);
  const branchesAt = (agendaId: string) => rows.filter((row) => row.branchOf?.agendaId === agendaId);
  const all = rows.flatMap(stepsOf);
  const notes = [...new Set(all.map((agenda) => agenda.noteId))].sort((a, b) => indexOf(a) - indexOf(b));
  const date = (noteId: string) => shortMeetingDate(map.meetings[indexOf(noteId)].startedAt);

  const list = (row: TopicRow, depth: number) => {
    const steps = stepsOf(row);
    const pickedAt = steps.findIndex((agenda) => agenda.agendaId === picked);
    const fold =
      depth === 0 && !opened && steps.length > LONG_TOPIC && !(pickedAt >= HEAD && pickedAt < steps.length - TAIL);
    const shown = fold ? [...steps.slice(0, HEAD), null, ...steps.slice(-TAIL)] : steps;
    return (
      <ol
        className={cn(
          "flex flex-col",
          depth > 0 && "mt-1.5 ml-[3px] border-l border-dashed border-[var(--el-hairline-strong)] pl-3"
        )}
      >
        {shown.map((agenda) =>
          agenda ? (
            <li key={agenda.agendaId} className="flex flex-col pb-2">
              <div className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 translate-y-[1px] rounded-full border-[1.5px] border-[var(--el-ink)]",
                    agenda.agendaId === picked ? "bg-[var(--el-ink)]" : "bg-[var(--el-surface-card)]"
                  )}
                />
                <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">{date(agenda.noteId)}</span>
                <button
                  type="button"
                  aria-pressed={agenda.agendaId === picked}
                  onClick={() => onPick(agenda)}
                  className={cn(
                    "min-w-0 text-left text-[13px] text-[var(--el-ink)] hover:underline",
                    agenda.agendaId === picked && "font-semibold"
                  )}
                >
                  {agenda.title}
                </button>
              </div>
              {branchesAt(agenda.agendaId).map((branch) => (
                <div key={branch.id}>{list(branch, depth + 1)}</div>
              ))}
            </li>
          ) : (
            <li key="folded" className="pb-2 pl-4">
              <button
                type="button"
                onClick={() => setOpened(true)}
                className="text-xs text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]"
              >
                안건 {steps.length - HEAD - TAIL}개 더 보기
              </button>
            </li>
          )
        )}
      </ol>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="pr-6">
        <h3 className="text-[15px] leading-[21px] font-semibold text-balance text-[var(--el-ink)]">
          {stepsOf(main).at(-1)!.title}
        </h3>
        <p className="mt-1 text-xs text-[var(--el-muted)] tabular-nums">
          안건 {all.length} · 회의 {notes.length}개 · {date(notes[0])} → {date(notes.at(-1)!)}
          {rows.length > 1 ? ` · 갈래 ${rows.length - 1}` : ""}
        </p>
      </div>
      {list(main, 0)}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-[var(--el-hairline-strong)] bg-[var(--el-surface-card)] px-1 text-[10px] leading-[14px] text-[var(--el-muted)] tabular-nums">
      {children}
    </span>
  );
}

function ControlButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center text-[var(--el-muted)] transition-colors hover:text-[var(--el-ink)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--el-ink)] disabled:text-[var(--el-muted-soft)] motion-reduce:transition-none pointer-coarse:size-10"
    >
      {children}
    </button>
  );
}

/** 불러오는 동안. 보기 전환 자리는 비워 두고 판과 슬라이더만 가린다 */
function MapSkeleton() {
  return (
    <div aria-label="안건 지도를 불러오는 중" className="mt-6">
      <div className="mb-2.5 h-8" />
      <Skeleton className="h-[320px] w-full rounded-block" />
      <div className="mt-2.5 h-3.5" />
    </div>
  );
}
