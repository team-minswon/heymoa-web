"use client";

import { useTranslations } from "next-intl";

import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { motion, useReducedMotion, type TargetAndTransition } from "motion/react";

import { track } from "@/lib/analytics/track";
import { EdgeButtons } from "@/components/projects/agenda-edge-buttons";
import { SidePanel, type Selection, type Tab } from "@/components/projects/agenda-map-panel";
import {
  ACCENT,
  Column,
  GRID_COMPACT,
  GRID_ROOMY,
  PILL_COL,
  HEAD_H,
  HeadColumn,
  MAX_COL,
  MIN_COL,
  laneGeom,
  PAD,
  BOARD_END_GUTTER,
  TITLE_COL,
  clamp,
  zoneRowsOf,
  type StopLike,
} from "@/components/projects/agenda-ribbon-column";
import { HoverCard, type FoldPreview, type HoverApi } from "@/components/projects/agenda-ribbon-hover";
import { Legend } from "@/components/projects/agenda-ribbon-legend";
import { DIM_MS, layoutOf, moveOf, widthOf } from "@/components/projects/agenda-ribbon-motion";
import { useDragPan } from "@/components/projects/use-drag-pan";
import { getAppDateKey } from "@/lib/format/date";
import {
  shortMeetingDate,
  topicOfRows,
  type AgendaMap,
  type MapAgenda,
  type TopicRow,
} from "@/lib/projects/agenda-map";
import {
  ribbonColumns,
  ribbonLayout,
  type RibbonLayout,
  type RibbonRoute,
  type RibbonTopic,
} from "@/lib/projects/agenda-ribbon";
import {
  estimateWidth,
  makeMeasure,
  openCap,
  openNeed,
  openWidth,
} from "@/lib/projects/agenda-ribbon-titles";
import { cn } from "@/lib/utils";

const ZONE_PAD = 6;
const BOARD_MAX_H = "max(360px, calc(100dvh - 3rem))";
const DIM = 0.82;
const DIM_LABEL = 0.9;
const FADE_MAX = 360;

const MOVE_MS = 260;
/** 고정 규칙이다 — 고른 줄기 id 를 담은 규칙을 그때그때 넣으면 요소 만오천 개의 스타일을 전부 다시 계산한다 */
const DIM_CSS =
  `[data-ribbon][data-picked] [data-topic]{opacity:${DIM}}[data-ribbon][data-picked] [data-label]{opacity:${DIM_LABEL}}` +
  "[data-ribbon][data-picked] [data-topic][data-on],[data-ribbon][data-picked] [data-label][data-on]{opacity:1}";

export type BoardMemory = {
  open: string[];
  selection: Selection;
  panelOpen: boolean;
  tab: Tab;
  scrollLeft: number | null;
  scrollTop?: number;
};

const PANEL_W = 340;
const PANEL_GAP = 20;

const EMPTY: readonly MapAgenda[] = [];

export function RibbonBoard({
  workspaceId,
  map,
  rows,
  initial,
  onMemory,
  leaving,
  restore,
  onFocusTopic,
}: {
  workspaceId: string;
  map: AgendaMap;
  rows: TopicRow[];
  initial: BoardMemory;
  onMemory: (next: Partial<BoardMemory>) => void;
  leaving: string | null;
  restore?: { topicId: string; pageTop: number };
  onFocusTopic: (topicId: string) => void;
}) {
  const t = useTranslations("workspace.agendaMap");
  const layout = useMemo(() => ribbonLayout(map, rows), [map, rows]);
  const columns = useMemo(() => ribbonColumns(map, layout), [map, layout]);
  const topicOf = useMemo(() => topicOfRows(rows), [rows]);
  const rowOfAgenda = useMemo(
    () =>
      new Map(rows.flatMap((row) => [...row.cells.values()].flat().map((agenda) => [agenda.agendaId, row] as const))),
    [rows]
  );
  const meetingIndex = useMemo(() => new Map(map.meetings.map((meeting) => [meeting.noteId, meeting.index])), [map]);
  const count = map.meetings.length;

  const rootRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollNow = useRef(0);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(initial.open));
  const [selection, setSelection] = useState<Selection>(initial.selection);
  const [panelOpen, setPanelOpen] = useState(initial.panelOpen);
  const [tab, setTab] = useState<Tab>(initial.tab);
  const panelShown = panelOpen && selection !== null;
  const [keptSelection, setKeptSelection] = useState(selection);
  if (selection && selection !== keptSelection) setKeptSelection(selection);

  const hover = useRef<HoverApi | null>(null);
  const joins = useRef<JoinsApi | null>(null);
  const panning = useRef(false);
  const reduced = useReducedMotion() ?? false;
  useDragPan(scrollRef, {
    onStart: () => {
      panning.current = true;
      hover.current?.hide(true);
    },
    onEnd: () => {
      panning.current = false;
    },
  });

  useEffect(() => onMemory({ open: [...open], selection, panelOpen, tab }), [open, selection, panelOpen, tab, onMemory]);

  const picked = selection?.agendaId ? (map.agendaById.get(selection.agendaId) ?? null) : null;
  const pickedTopic = selection?.rowId ? (layout.topicById.get(topicOf.get(selection.rowId) ?? "") ?? null) : null;
  const pickedMeeting = picked ? (meetingIndex.get(picked.noteId) ?? -1) : -1;
  const pickedAt = picked ? (layout.stopOfAgenda.get(picked.agendaId)?.meeting ?? pickedMeeting) : null;

  const [width, setWidth] = useState(0);
  const [anim, setAnim] = useState<{ moving: readonly string[]; snap: boolean; closing: boolean; toggle: boolean }>({ moving: [], snap: true, closing: false, toggle: false });
  const readTimer = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const read = () => {
      setWidth(box.clientWidth);
      setAnim({ moving: [], snap: true, closing: false, toggle: false });
    };
    read();
    let lastWidth = box.clientWidth;
    const observer = new ResizeObserver(() => {
      if (box.clientWidth === lastWidth) return;
      lastWidth = box.clientWidth;
      window.clearTimeout(readTimer.current);
      readTimer.current = window.setTimeout(read, 50);
    });
    observer.observe(box);
    return () => {
      observer.disconnect();
      window.clearTimeout(readTimer.current);
    };
  }, []);

  const col = width > 0 ? clamp(Math.floor((width - PAD * 2 - 2) / count), MIN_COL, MAX_COL) : MIN_COL;
  const roomy = col >= TITLE_COL;
  const shownCol = (width - PAD * 2 - 2 - (panelShown ? PANEL_W + PANEL_GAP : 0)) / count;
  const titlesOn = !roomy || shownCol >= TITLE_COL;
  const titleGrid = roomy || open.size > 0;
  const g = titleGrid ? GRID_ROOMY : GRID_COMPACT;

  const openAt = useMemo(() => map.meetings.map((meeting) => roomy || open.has(meeting.noteId)), [map, open, roomy]);
  const [needs, setNeeds] = useState<readonly number[]>(() => columns.map((column, at) => openNeed(column.cells.map((cell) => cell.stop), layout.extra.get(at) ?? EMPTY, (text) => estimateWidth(text, GRID_ROOMY.FS))));
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    let live = true;
    const run = () => {
      const measure = makeMeasure(`${GRID_ROOMY.FS}px ${getComputedStyle(element).fontFamily}`) ?? ((text: string) => estimateWidth(text, GRID_ROOMY.FS));
      const next = columns.map((column, at) => openNeed(column.cells.map((cell) => cell.stop), layout.extra.get(at) ?? EMPTY, measure));
      if (live) setNeeds((prev) => (prev.length === next.length && prev.every((value, at) => value === next[at]) ? prev : next));
    };
    run();
    void document.fonts?.ready.then(run);
    return () => {
      live = false;
    };
  }, [columns, layout]);
  const closedCap = openCap(width - PAD * 2 - 2, PANEL_W + PANEL_GAP, false);
  const cap = panelShown ? openCap(width - PAD * 2 - 2, PANEL_W + PANEL_GAP, true) : closedCap;
  const geo = useMemo(() => {
    const widths = openAt.map((isOpen, at) => {
      if (!isOpen) return col;
      if (!roomy) return openWidth(needs[at] ?? 0, cap);
      return titlesOn ? Math.max(col, openWidth(needs[at] ?? 0, closedCap)) : col;
    });
    const xs: number[] = [];
    let x = 0;
    for (const w of widths) {
      xs.push(x);
      x += w;
    }
    return { widths, xs, total: x };
  }, [openAt, col, roomy, titlesOn, needs, cap, closedCap]);
  const { xs, widths, total } = geo;
  const [panelSeen, setPanelSeen] = useState(panelShown);
  if (panelSeen !== panelShown) {
    setPanelSeen(panelShown);
    setAnim((current) => (current.moving.length > 0 ? { ...current, moving: [] } : current));
  }
  const geoRef = useRef(geo);
  const laneTopsRef = useRef<number[]>([]);
  useLayoutEffect(() => {
    geoRef.current = geo;
  }, [geo]);
  const cx = (meeting: number) => xs[meeting] + widths[meeting] * (openAt[meeting] ? 0.25 : 0.5);

  const pillsOn = col >= PILL_COL || titleGrid;
  const hasPill = useMemo(
    () => layout.lanes.map((topics) => topics.some((topic) => topic.main.stops.some((stop) => stop.agendas.some((agenda) => (layout.folded.get(agenda.agendaId) ?? 0) > 0)))),
    [layout]
  );
  const geoms = useMemo(() => hasPill.map((pill) => laneGeom(g, pill ? (pillsOn ? "pill" : "hook") : null)), [hasPill, g, pillsOn]);
  const laneT = useMemo(() => hasPill.map((pill) => laneGeom(GRID_ROOMY, pill ? "pill" : null).t), [hasPill]);
  const laneTops: number[] = [];
  let cursor = g.TOP;
  layout.lanes.forEach((topics, lane) => {
    laneTops.push(cursor);
    const base = topics.some((topic) => topic.routes.some((route) => route.kind === "track")) ? geoms[lane].PT : geoms[lane].P;
    const opened = pickedTopic && pickedTopic.lane === lane && pickedTopic.subCount > 0 ? geoms[lane].PT + (pickedTopic.subCount - 1) * g.SUB : 0;
    cursor += Math.max(base, opened);
  });
  laneTops.push(cursor);
  const lanesBottom = cursor;
  const pickedTopicId = pickedTopic?.id ?? null;
  const zoneRows = Math.max(
    0,
    ...map.meetings.map((_, at) => (openAt[at] ? zoneRowsOf(layout.extra.get(at) ?? EMPTY, layout, pickedTopicId).length : 0))
  );
  const zoneTop = lanesBottom + g.ZGAP;
  const bodyH = lanesBottom + (zoneRows > 0 ? g.ZGAP + g.ZHEAD + zoneRows * g.ZROW + ZONE_PAD : 0) + (titleGrid ? 28 : 12);
  const bodyVars: Record<string, number> = { "--zt": zoneTop };
  laneTops.forEach((top, lane) => (bodyVars[`--lt-${lane}`] = top));
  useLayoutEffect(() => {
    laneTopsRef.current = laneTops;
  });

  const stats = useMemo(
    () =>
      map.meetings.map((meeting) => ({
        total: meeting.agendas.length,
        linked: meeting.agendas.length - (layout.loose.get(meeting.index)?.length ?? 0),
      })),
    [map, layout]
  );
  const dateKeys = useMemo(() => map.meetings.map((meeting) => getAppDateKey(meeting.startedAt)), [map]);
  const monthOf = useMemo(() => dateKeys.map((key) => key.slice(0, 7)), [dateKeys]);
  const marks = useMemo(
    () => headerMarks(dateKeys, xs, widths, (month) => t("monthMark", { month })),
    [dateKeys, xs, widths, t]
  );
  const joinTargets = useMemo(() => new Set(layout.joins.map((join) => join.to)), [layout]);
  const joinTouches = useMemo(() => new Set(layout.joins.flatMap((join) => [join.from, join.to])), [layout]);

  const stopTable = useMemo(() => {
    const table = new Map<string, { stop: StopLike; topic: RibbonTopic | null }>();
    for (const column of columns) for (const cell of column.cells) table.set(cell.key, { stop: cell.stop, topic: cell.topic });
    for (const [meeting, agendas] of layout.extra)
      for (const agenda of agendas)
        table.set(`x:${agenda.agendaId}`, { stop: { meeting, agendas: [agenda] }, topic: layout.topicOfAgenda.get(agenda.agendaId) ?? null });
    return table;
  }, [columns, layout]);

  const placed = useRef(false);
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || placed.current || width === 0) return;
    placed.current = true;
    const at = pickedAt ?? -1;
    scroller.scrollLeft =
      initial.scrollLeft ?? (at < 0 ? scroller.scrollWidth : BOARD_END_GUTTER + cx(at) - scroller.clientWidth / 2);
    scrollNow.current = scroller.scrollLeft;
    if (initial.scrollTop) scroller.scrollTop = initial.scrollTop;
    if (restore) {
      const page = rootRef.current?.closest("[data-slot=scroll-area-viewport]");
      if (page) page.scrollTop = restore.pageTop;
      const name = rootRef.current?.querySelector<HTMLElement>(`[data-topic-name="${CSS.escape(restore.topicId)}"]`);
      name?.focus({ preventScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width > 0]);

  const seenGeo = useRef({ geo, cap });
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const prev = seenGeo.current;
    seenGeo.current = { geo, cap };
    if (!scroller || !placed.current || pickedAt === null || prev.cap === cap || prev.geo === geo) return;
    const at = (g: typeof geo) => g.xs[pickedAt] + g.widths[pickedAt] * (openAt[pickedAt] ? 0.25 : 0.5);
    const delta = at(geo) - at(prev.geo);
    if (Math.abs(delta) > 0.5) scroller.scrollLeft += delta;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  const lastTotal = useRef(total);
  const anchor = useRef<{ noteId: string; offset: number } | null>(null);
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && placed.current && lastTotal.current !== total && lastTotal.current > 0 && !anchor.current) {
      scroller.scrollLeft = (scroller.scrollLeft * total) / lastTotal.current;
    }
    lastTotal.current = total;
  }, [total]);

  const noteIds = useRef<string[]>([]);
  const openNow = useRef(open);
  useLayoutEffect(() => {
    openNow.current = open;
  }, [open]);
  useLayoutEffect(() => {
    noteIds.current = map.meetings.map((meeting) => meeting.noteId);
  }, [map]);
  const onToggle = useCallback((noteId: string, at: number) => {
    const scroller = scrollRef.current;
    anchor.current = scroller ? { noteId, offset: BOARD_END_GUTTER + geoRef.current.xs[at] - scroller.scrollLeft } : null;
    hover.current?.hide(true);
    if (!openNow.current.has(noteId)) track("agenda_map_column_expanded", { workspace_id: workspaceId });
    const ids = noteIds.current;
    setAnim({ moving: [ids[at - 1], noteId, ids[at + 1]].filter(Boolean), snap: false, closing: openNow.current.has(noteId), toggle: true });
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(noteId)) next.add(noteId);
      return next;
    });
  }, [setAnim, workspaceId]);
  useLayoutEffect(() => {
    const held = anchor.current;
    const scroller = scrollRef.current;
    if (!held || !scroller) return;
    anchor.current = null;
    const at = meetingIndex.get(held.noteId) ?? 0;
    scroller.scrollLeft = BOARD_END_GUTTER + xs[at] - held.offset;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const leftFor = (visible: number, left: number) => {
    if (pickedAt === null) return left;
    const reach = Math.min(10, widths[pickedAt] / 2);
    const [from, to] = [BOARD_END_GUTTER + cx(pickedAt) - reach, BOARD_END_GUTTER + cx(pickedAt) + reach];
    const margin = 6;
    let next = left;
    if (to > left + visible - margin) next = to - visible + margin;
    else if (from < left + margin) next = from - margin;
    return clamp(next, 0, Math.max(0, total + BOARD_END_GUTTER * 2 - visible));
  };
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || pickedAt === null || !placed.current) return;
    const left = scrollNow.current;
    const target = leftFor(width - 2 - (panelShown ? PANEL_W + PANEL_GAP : 0), left);
    if (Math.abs(target - left) > 1) {
      if (reduced) scroller.scrollLeft = target;
      else scroller.scrollTo({ left: target, behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedAt, width]);
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || pickedAt === null) return;
    let last = -1;
    const observer = new ResizeObserver(() => {
      const now = scroller.clientWidth;
      if (now === last) return;
      const first = last < 0;
      last = now;
      const left = scroller.scrollLeft;
      const next = leftFor(now, left);
      if (!first && Math.abs(next - left) > 0.5) {
        scroller.scrollLeft = next;
        hover.current?.refresh();
      }
    });
    observer.observe(scroller);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedAt, geo, openAt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, [role=dialog]")) return;
      if (hover.current?.isOpen()) hover.current.hide(true);
      else if (panelOpen) setPanelOpen(false);
      else if (selection) setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, selection]);

  const panelOpenRef = useRef(panelOpen);
  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);
  const selectionRef = useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);
  const stepped = useRef(false);
  const stepPending = useRef<"back" | null>(null);
  useLayoutEffect(() => {
    stepped.current = Boolean((window.history.state as { heymoaSel?: boolean } | null)?.heymoaSel);
  }, []);
  useEffect(() => {
    if (panelOpen && !stepped.current && stepPending.current === null) {
      try {
        window.history.pushState({ ...(window.history.state ?? {}), heymoaSel: true }, "", window.location.href);
        stepped.current = true;
      } catch {
      }
    } else if (!panelOpen && stepped.current && stepPending.current === null) {
      stepPending.current = "back";
      window.history.back();
    }
  }, [panelOpen]);
  useEffect(() => {
    const onPop = () => {
      const marked = Boolean((window.history.state as { heymoaSel?: boolean } | null)?.heymoaSel);
      if (stepPending.current === "back") {
        stepPending.current = null;
        stepped.current = false;
        if (panelOpenRef.current) {
          window.history.pushState({ ...(window.history.state ?? {}), heymoaSel: true }, "", window.location.href);
          stepped.current = true;
        }
        return;
      }
      stepped.current = marked;
      if (!marked && panelOpenRef.current) setPanelOpen(false);
      else if (marked && !panelOpenRef.current && selectionRef.current) setPanelOpen(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("agenda");
    url.searchParams.delete("topic");
    if (panelOpen && selection?.agendaId) url.searchParams.set("agenda", selection.agendaId);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [selection, panelOpen]);

  const pick = (agenda: MapAgenda) => {
    lastPick.current = performance.now();
    track("agenda_map_agenda_selected", { workspace_id: workspaceId });
    setAnim((current) => (current.snap || current.toggle ? { ...current, snap: false, toggle: false } : current));
    setSelection({ rowId: rowOfAgenda.get(agenda.agendaId)?.id ?? null, agendaId: agenda.agendaId });
    setPanelOpen(true);
    setTab("agenda");
  };
  const pickStop = (stop: StopLike) => {
    if (panelOpen && picked && stop.agendas.some((agenda) => agenda.agendaId === picked.agendaId)) {
      setSelection(null);
      setPanelOpen(false);
    } else pick(stop.agendas[0]);
  };
  const unfoldAt = (stop: StopLike) => {
    pick(stop.agendas.find((agenda) => layout.foldedRoutes.has(agenda.agendaId)) ?? stop.agendas[0]);
    setTab("flow");
  };
  const focusTopic = (topicId: string) => {
    hover.current?.hide(true);
    track("agenda_map_topic_focused", { workspace_id: workspaceId });
    onFocusTopic(topicId);
  };
  const focusRef = useRef(focusTopic);
  useEffect(() => {
    focusRef.current = focusTopic;
  });
  const focusStable = useCallback((topicId: string) => focusRef.current(topicId), []);

  const dimState = useRef<{ id: string | null; leaving: boolean }>({ id: null, leaving: false });
  useLayoutEffect(() => {
    const root = rootRef.current;
    const prev = dimState.current;
    const next = { id: leaving ?? pickedTopicId, leaving: leaving !== null };
    dimState.current = next;
    if (!root || (prev.id === next.id && prev.leaving === next.leaving)) return;
    const level = (element: Element, state: { id: string | null; leaving: boolean }) => {
      if (!state.id) return 1;
      const label = element.hasAttribute("data-label");
      const own = element.getAttribute(label ? "data-label" : "data-topic") === state.id;
      if (state.leaving) return own && !element.closest("[data-zone]") ? 1 : 0;
      return own ? 1 : label ? DIM_LABEL : DIM;
    };
    const elements = root.querySelectorAll("[data-topic], [data-label]");
    if (elements.length > FADE_MAX) return;
    for (const element of elements) {
      const [from, to] = [level(element, prev), level(element, next)];
      if (from !== to)
        element.animate([{ opacity: from }, { opacity: to }], { duration: reduced || leaving ? 120 : DIM_MS, easing: "ease-out" });
    }
  }, [pickedTopicId, leaving, reduced]);
  const leavingRule = leaving
    ? `[data-ribbon] [data-topic]:not([data-topic=${JSON.stringify(leaving)}]),[data-ribbon] [data-zone] [data-topic],` +
      `[data-ribbon] [data-label]:not([data-label=${JSON.stringify(leaving)}]){opacity:0!important}` +
      `[data-ribbon] [data-topic]:not([data-topic=${JSON.stringify(leaving)}]) [data-stop],[data-ribbon] [data-zone] [data-stop]{pointer-events:none}`
    : "";

  const foldPreview = (stop: StopLike): FoldPreview[] =>
    stop.agendas
      .flatMap((agenda) => layout.foldedRoutes.get(agenda.agendaId) ?? [])
      .map((route) => ({
        date: shortMeetingDate(map.meetings[route.stops[0].meeting].startedAt),
        title: route.stops[0].agendas[0].title,
        count: route.stops.reduce((sum, entry) => sum + entry.agendas.length, 0),
      }));
  const hovered = useRef<Element | null>(null);
  // 점을 누르면 판이 옮겨 가 점이 마우스 밑에서 밀려나고, 브라우저가 포인터 이동을 낸다. 마우스가 움직인 것이 아니라 화면이
  // 움직인 결과라 올려 보던 카드를 닫거나 바꾸지 않는다. 마우스가 실제로 움직이면 그때 판단한다
  const lastMove = useRef(0);
  const lastPick = useRef(0);
  const stale = useRef(false);
  const shifted = () => {
    const now = performance.now();
    return now - lastPick.current < 800 && now - lastMove.current > 80;
  };
  const entryOf = (element: Element | null) => {
    const stopEl = element?.closest("[data-stop]") ?? null;
    return { stopEl, fold: element?.closest("[data-fold]") ?? null, entry: stopTable.get(stopEl?.getAttribute("data-stop") ?? "") };
  };
  const stopAt = useMemo(() => new Map([...stopTable].map(([key, entry]) => [key, entry.stop.meeting] as const)), [stopTable]);
  const [rovingKey, setRoving] = useState<string | null>(null);
  const firstKey = useMemo(() => columns.find((column) => column.cells.length > 0)?.cells[0].key ?? "", [columns]);
  const pickedKey = picked && pickedAt !== null ? columns[pickedAt]?.cells.find((cell) => cell.stop.agendas.some((agenda) => agenda.agendaId === picked.agendaId))?.key : undefined;
  const roving = rovingKey && stopTable.has(rovingKey) ? rovingKey : (pickedKey ?? firstKey);
  const arrowTarget = (from: Element, key: string): HTMLElement | null => {
    const here = from.closest("[data-stop][role=button]") as HTMLElement | null;
    const scroller = scrollRef.current;
    if (!here || !scroller) return null;
    const topic = stopTable.get(here.getAttribute("data-stop") ?? "")?.topic ?? null;
    const box = here.getBoundingClientRect();
    const [cx0, cy0] = [box.left + box.width / 2, box.top + box.height / 2];
    let best: HTMLElement | null = null;
    let score = Infinity;
    for (const element of scroller.querySelectorAll<HTMLElement>("[data-stop][role=button]")) {
      if (element === here || element.closest("[inert]")) continue;
      const other = stopTable.get(element.getAttribute("data-stop") ?? "")?.topic ?? null;
      const rect = element.getBoundingClientRect();
      const [dx, dy] = [rect.left + rect.width / 2 - cx0, rect.top + rect.height / 2 - cy0];
      if (key === "ArrowLeft" || key === "ArrowRight") {
        if (other !== topic || (key === "ArrowRight" ? dx <= 1 : dx >= -1)) continue;
        const s = Math.abs(dx) * 1000 + Math.abs(dy);
        if (s < score) [best, score] = [element, s];
      } else {
        if (other === topic || (key === "ArrowDown" ? dy <= 8 : dy >= -8)) continue;
        const s = Math.round(Math.abs(dy) / 40) * 1e6 + Math.abs(dx) * 100 + Math.abs(dy) / 100;
        if (s < score) [best, score] = [element, s];
      }
    }
    return best;
  };

  const enter = (target: EventTarget | null) => {
    if (panning.current) return;
    if (shifted()) {
      if (hovered.current) stale.current = true;
      return;
    }
    const { stopEl, fold, entry } = entryOf(target as Element | null);
    const element = fold ?? stopEl;
    if (!element || !entry || hovered.current === element) return;
    hovered.current = element;
    const { stop, topic } = entry;
    const base = {
      rect: element.getBoundingClientRect(),
      el: element,
      topicName: topic?.name ?? null,
      meeting: map.meetings[stop.meeting],
      agendas: stop.agendas,
    };
    if (fold) {
      hover.current?.show({ ...base, fold: foldPreview(stop), foldOnly: true });
      return;
    }
    if (stop.agendas.some((agenda) => joinTouches.has(agenda.agendaId))) joins.current?.hot(stop.agendas.map((agenda) => agenda.agendaId));
    hover.current?.show({ ...base, fold: topic && pickedTopic === topic ? [] : foldPreview(stop) });
  };
  const leave = (next: EventTarget | null) => {
    const element = hovered.current;
    if (!element || (next instanceof Node && element.contains(next))) return;
    if (shifted() && next instanceof Node && rootRef.current?.contains(next)) {
      stale.current = true;
      return;
    }
    stale.current = false;
    hovered.current = null;
    joins.current?.hot(null);
    hover.current?.hide();
  };

  const widthKnown = width > 0;
  const columnEls = useMemo(
    () =>
      (widthKnown ? map.meetings : []).map((meeting, at) => {
        const sideEdge = (index: number) => (index === 0 ? 1 : 0) + (index === count - 1 ? 2 : 0);
          const mark = marks[at];
          return (
            <HeadColumn
              key={meeting.noteId}
              at={at}
              meeting={meeting}
              width={widths[at]}
              open={openAt[at]}
              toggle={!roomy}
              selected={pickedAt === at}
              edge={sideEdge(at)}
              markText={mark?.text ?? ""}
              markTop={mark?.top ?? 0}
              markStrong={mark?.strong ?? false}
              total={stats[at].total}
              linked={stats[at].linked}
              hover={hover}
              onToggle={onToggle}
              instant={reduced || anim.snap || !anim.moving.includes(meeting.noteId)}
            />
          );
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [widthKnown, map, columns, layout, joinTargets, laneT, widths, col, openAt, pickedAt, pickedTopicId, picked, anim.snap, anim.moving, reduced, titlesOn, count, monthOf]
  );
  const metaOf = useMemo(
    () =>
      new Map(
        layout.lanes.flat().map((topic) => [
          topic.id,
          t("topicMeta", {
            agendas: topic.agendaCount,
            meetings: new Set(topic.routes.flatMap((route) => route.stops.map((stop) => stop.meeting))).size,
          }),
        ])
      ),
    [layout, t]
  );
  const nameLabels = useMemo(() => {
    const cx = (meeting: number) => xs[meeting] + widths[meeting] * (openAt[meeting] ? 0.25 : 0.5);
    return layout.lanes.flatMap((topics, lane) =>
    topics.map((topic, at) => {
      const first = topic.main.stops[0].meeting;
      const left = cx(first) - 6;
      const nextFirst = topics[at + 1]?.main.stops[0].meeting;
      const free = nextFirst === undefined ? Infinity : cx(nextFirst) - 14;
      const right = Math.min(total - 2, Math.max(cx(topic.to) + 10, Math.min(free, left + 260)));
      if (right - left < 56) return null;
      return (
        <NameLabel
          key={topic.id}
          topic={topic}
          meta={right - left >= 250 ? metaOf.get(topic.id)! : null}
          lane={lane}
          left={left}
          width={right - left}
          top={g.NAME}
          on={pickedTopic === topic}
          size={g.LABEL}
          instant={reduced || anim.snap}
          closing={anim.closing}
          hover={hover}
          onFocusTopic={focusStable}
        />
      );
    })
    );
  }, [layout, metaOf, xs, widths, openAt, total, g.NAME, g.LABEL, pickedTopic, reduced, anim.snap, anim.closing, focusStable]);

  const laneBand = (lane: number) => ({
    top: `calc(var(--lt-${lane}) * 1px)`,
    height: `calc((var(--lt-${lane + 1}) - var(--lt-${lane})) * 1px)`,
  });

  const hint = roomy ? t("hintRoomy") : t("hintNarrow");
  const sideEdge = (at: number) => (at === 0 ? 1 : 0) + (at === count - 1 ? 2 : 0);

  return (
    <div ref={rootRef} data-ribbon="" data-picked={pickedTopicId ? "" : undefined} className="mt-6">
      <style>{DIM_CSS}</style>
      {leavingRule ? <style>{leavingRule}</style> : null}
      <div ref={boxRef} className="relative flex">
        <section aria-label={t("title")} className="min-w-0 flex-1 contain-inline-size">
          <div className="mb-2.5 flex h-7 items-center justify-between gap-3 text-xs text-[var(--el-muted)]">
            <span>{hint}</span>
            {!roomy && open.size > 0 ? (
              <button
                type="button"
                onClick={() => {
                  anchor.current = null;
                  setAnim({ moving: map.meetings.map((meeting) => meeting.noteId).filter((id) => open.has(id)), snap: false, closing: true, toggle: true });
                  setOpen(new Set());
                }}
                className="inline-flex h-7 items-center gap-1 rounded-control px-2 hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)]"
              >
                {t("collapseAll", { count: open.size })}
              </button>
            ) : null}
          </div>

          {/* `overflow-clip` 은 스크롤 상자를 만들지 않아서 안의 머리 띠·버튼이 페이지 스크롤에 `sticky` 로 붙는다 */}
          <motion.div
            data-board-frame=""
            initial={false}
            animate={bodyVars as TargetAndTransition}
            transition={layoutOf(reduced || anim.snap)}
            className="relative overflow-clip rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]"
          >
            <EdgeButtons scroller={scrollRef} reduced={reduced} inset={HEAD_H} />

            <div
              ref={scrollRef}
              data-agenda-map=""
              data-scroller=""
              onScroll={(event) => {
                scrollNow.current = event.currentTarget.scrollLeft;
                onMemory({ scrollLeft: scrollNow.current, scrollTop: event.currentTarget.scrollTop });
              }}
              onClick={(event) => {
                if (selection && !(event.target as Element).closest("[data-stop], [data-fold], [data-head], [data-head-strip], button, a, [role=button]")) {
                  setSelection(null);
                  setPanelOpen(false);
                }
              }}
              className="scroll-pt-[80px] overflow-auto overscroll-x-contain select-none [scrollbar-width:thin]"
              style={{ maxHeight: BOARD_MAX_H }}
            >
              <div className="relative min-w-full" style={{ width: total + BOARD_END_GUTTER * 2 }}>
              <div data-head-strip="" className="sticky top-0 z-[7] border-b border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]" style={{ height: HEAD_H }}>
                <div className="absolute top-0 flex h-full" style={{ left: BOARD_END_GUTTER, width: total }}>
                  {columnEls}
                </div>
              </div>
              <motion.div
                initial={false}
                animate={{ height: bodyH }}
                transition={layoutOf(reduced || anim.snap)}
                className="relative min-w-full"
                style={{ width: total + BOARD_END_GUTTER * 2 }}
              >
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  {layout.lanes.map((_, lane) => (
                    <div key={lane} className={cn("absolute inset-x-0", lane % 2 === 1 && BAND)} style={laneBand(lane)} />
                  ))}
                  {zoneRows > 0 ? (
                    <div className="absolute inset-x-0 border-t border-[var(--el-hairline)]" style={{ top: `calc(var(--zt) * 1px - ${g.ZGAP / 2}px)` }} />
                  ) : null}
                </div>
                {zoneRows > 0 ? (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0">
                    <div className="absolute z-[3] h-5" style={{ left: 0, width: total + BOARD_END_GUTTER * 2, top: `calc(var(--zt) * 1px + 2px)` }}>
                      <span className="sticky left-2 inline-block rounded-sm bg-[var(--el-canvas-soft)] px-1 text-xs leading-5 text-[var(--el-muted)]">
                        {t("otherAgendas")}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div
                  className="absolute top-0 flex h-full"
                  style={{ left: BOARD_END_GUTTER, width: total }}
                  onPointerMove={(event) => {
                    lastMove.current = performance.now();
                    if (stale.current) {
                      stale.current = false;
                      const element = hovered.current;
                      if (element && !element.contains(event.target as Node)) {
                        leave(event.relatedTarget);
                        enter(event.target);
                      }
                    }
                  }}
                  onPointerOver={(event) => enter(event.target)}
                  onPointerOut={(event) => leave(event.relatedTarget)}
                  onFocus={(event) => {
                    const key = (event.target as Element).closest("[data-stop][role=button]")?.getAttribute("data-stop");
                    if (key) setRoving(key);
                    enter(event.target);
                  }}
                  onBlur={(event) => leave(event.relatedTarget)}
                  onClick={(event) => {
                    const { fold, entry } = entryOf(event.target as Element);
                    if (!entry) return;
                    if (fold) unfoldAt(entry.stop);
                    else pickStop(entry.stop);
                  }}
                  onKeyDown={(event) => {
                    if (event.key.startsWith("Arrow") && !event.metaKey && !event.ctrlKey && !event.altKey) {
                      const next = arrowTarget(event.target as Element, event.key);
                      if (next) {
                        event.preventDefault();
                        next.focus();
                      }
                      return;
                    }
                    if (event.key !== "Enter" && event.key !== " ") return;
                    const target = event.target as Element;
                    if (!target.matches("[role=button]")) return;
                    const { fold, entry } = entryOf(target);
                    if (!entry) return;
                    event.preventDefault();
                    if (fold) unfoldAt(entry.stop);
                    else pickStop(entry.stop);
                  }}
                >
                  {(width > 0 ? map.meetings : []).map((meeting, at) => {
                    const column = columns[at];
                    const zone = layout.extra.get(at) ?? EMPTY;
                    return (
                      <Column
                        key={meeting.noteId}
                        at={at}
                        meeting={meeting}
                        data={column}
                        layout={layout}
                        joinTargets={joinTargets}
                        zone={zone}
                        g={GRID_ROOMY}
                        laneT={laneT}
                        width={widths[at]}
                        col={col}
                        open={openAt[at]}
                        selected={pickedAt === at}
                        edge={sideEdge(at)}
                        monthEdge={at > 0 && !openAt[at] && !openAt[at - 1] && monthOf[at - 1] !== monthOf[at]}
                        topicId={pickedTopicId && (column.topicIds.has(pickedTopicId) || (openAt[at] && zone.length > 0)) ? pickedTopicId : null}
                        agendaId={pickedAt === at && picked ? picked.agendaId : null}
                        instant={reduced || anim.snap || !anim.moving.includes(meeting.noteId)}
                        reduced={reduced}
                        titles={titlesOn}
                        rove={stopAt.get(roving) === at ? roving : null}
                      />
                    );
                  })}
                </div>

                <div className="pointer-events-none absolute top-0 h-full" style={{ left: BOARD_END_GUTTER, width: total }}>
                  {nameLabels}
                </div>
                <Joins
                  ref={joins}
                  layout={layout}
                  pickedTopic={pickedTopic}
                  cx={(meeting) => BOARD_END_GUTTER + cx(meeting)}
                  laneTops={laneTops}
                  laneT={laneT}
                  g={g}
                  total={total + BOARD_END_GUTTER * 2}
                  height={bodyH}
                />
              </motion.div>
              </div>
            </div>
          </motion.div>

          <Legend
            has={{
              capsule: columns.some((column) => column.cells.some((cell) => cell.stop.agendas.length > 1)),
              gap: columns.some((column) => column.passes.length > 0),
              branch: layout.topics.some((topic) => topic.routes.length > 1),
              fold: layout.foldedRoutes.size > 0,
              join: layout.joins.length > 0,
            }}
          />
        </section>

        <PanelHost open={panelShown} reduced={reduced}>
          {keptSelection ? (
            <SidePanel
              workspaceId={workspaceId}
              map={map}
              rows={rows}
              topicOf={topicOf}
              rowOfAgenda={rowOfAgenda}
              selection={keptSelection}
              siblings={panelSiblings(keptSelection, map, layout)}
              tab={tab}
              onTab={setTab}
              onPick={pick}
              onClose={() => setPanelOpen(false)}
              onFocusTopic={() => {
                const topicId = keptSelection.rowId ? topicOf.get(keptSelection.rowId) : undefined;
                if (topicId) focusTopic(topicId);
              }}
            />
          ) : null}
        </PanelHost>

        <HoverCard workspaceId={workspaceId} ref={hover} />
      </div>
    </div>
  );
}

function panelSiblings(selection: NonNullable<Selection>, map: AgendaMap, layout: RibbonLayout): MapAgenda[] {
  const agenda = selection.agendaId ? map.agendaById.get(selection.agendaId) : undefined;
  if (!agenda) return [];
  const stop = layout.stopOfAgenda.get(agenda.agendaId);
  if (stop) return stop.agendas;
  const meeting = map.meetings.findIndex((entry) => entry.noteId === agenda.noteId);
  return layout.extra.get(meeting) ?? [agenda];
}

function PanelHost({ open, reduced, children }: { open: boolean; reduced: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  return (
    <motion.div
      initial={false}
      animate={{ width: open ? PANEL_W : 0, marginLeft: open ? PANEL_GAP : 0 }}
      transition={moveOf(reduced)}
      onAnimationComplete={() => {
        if (!open) setMounted(false);
      }}
      inert={!open}
      className="shrink-0 overflow-x-clip"
    >
      <div className="h-full w-[340px]">{open || mounted ? children : null}</div>
    </motion.div>
  );
}

const BAND = "bg-[color-mix(in_srgb,var(--el-hairline-soft)_55%,transparent)]";

function headerMarks(dateKeys: string[], xs: number[], widths: number[], monthLabel: (month: number) => string) {
  type Mark = { text: string; top: number; strong: boolean };
  const marks: (Mark | null)[] = dateKeys.map(() => null);
  let lastEnd = -1e9;
  dateKeys.forEach((key, at) => {
    const [year, month] = key.split("-");
    const prev = at > 0 ? dateKeys[at - 1] : null;
    const newMonth = !prev || prev.slice(0, 7) !== `${year}-${month}`;
    const newYear = !prev || prev.slice(0, 4) !== year;
    const left = xs[at];
    if (widths[at] >= 60) {
      if (newYear) marks[at] = { text: year, top: 3, strong: false };
    } else if (newMonth && left >= lastEnd) {
      const text = newYear ? `${year}.${month}` : monthLabel(Number(month));
      const end = left + text.length * 7.5 + 8;
      let wide = false;
      for (let next = at + 1; next < xs.length && xs[next] < end; next += 1) wide ||= widths[next] >= 60;
      if (wide) return;
      marks[at] = { text, top: widths[at] >= 34 ? 3 : 12, strong: true };
      lastEnd = end;
    }
  });
  return marks;
}

const NameLabel = memo(function NameLabel({
  topic,
  meta,
  lane,
  left,
  width,
  top,
  on,
  size,
  instant,

  hover,
  onFocusTopic,
}: {
  topic: RibbonTopic;
  meta: string | null;
  lane: number;
  left: number;
  width: number;
  top: number;
  on: boolean;
  size: number;
  instant: boolean;
  closing: boolean;
  hover: RefObject<HoverApi | null>;
  onFocusTopic: (topicId: string) => void;
}) {
  const t = useTranslations("workspace.agendaMap");
  return (
    <motion.div
      data-label={topic.id}
      data-lane={lane}
      data-on={on ? "" : undefined}
      initial={false}
      animate={{ left, width }}
      transition={widthOf(instant)}
      className="pointer-events-none absolute z-[3]"
      style={{ top: `calc(var(--lt-${lane}) * 1px + ${top}px)`, height: size + 3 }}
    >
      <button
        type="button"
        data-topic-name={topic.id}
        aria-label={`${topic.name} · ${t("focusTopicHint")}`}
        onClick={() => onFocusTopic(topic.id)}
        onPointerEnter={(event) =>
          hover.current?.show({
            rect: event.currentTarget.getBoundingClientRect(),
            el: event.currentTarget,
            tip: { title: topic.name, text: t("focusTopicHint") },
          })
        }
        onPointerLeave={() => hover.current?.hide()}
        className={cn(
          "group/name pointer-events-auto sticky left-2 flex max-w-full items-baseline gap-2 px-1 text-left [text-shadow:0_0_2px_var(--el-canvas-soft),0_0_2px_var(--el-canvas-soft),0_0_3px_var(--el-canvas-soft)] focus-visible:outline-2 focus-visible:outline-[var(--el-ink)]",
          on ? "font-bold text-[var(--el-scope-project)]" : "font-semibold text-[var(--el-ink)]"
        )}
        style={{ fontSize: size, lineHeight: `${size + 3}px` }}
      >
        <span className="min-w-0 truncate group-hover/name:underline">{topic.name}</span>
        {meta ? <span className="shrink-0 text-xs font-normal tabular-nums text-[color-mix(in_srgb,var(--el-muted)_85%,var(--el-ink))]">{meta}</span> : null}
      </button>
    </motion.div>
  );
});

type JoinsApi = { hot: (ids: string[] | null) => void };

function Joins({
  ref,
  layout,
  pickedTopic,
  cx,
  laneTops,
  laneT,
  g,
  total,
  height,
}: {
  ref: React.Ref<JoinsApi>;
  layout: RibbonLayout;
  pickedTopic: RibbonTopic | null;
  cx: (meeting: number) => number;
  laneTops: number[];
  laneT: readonly number[];
  g: typeof GRID_COMPACT;
  total: number;
  height: number;
}) {
  const [hot, setHot] = useState<string[] | null>(null);
  useImperativeHandle(ref, () => ({ hot: setHot }), []);

  const signature = `${total}|${laneTops.join(",")}|${pickedTopic?.id ?? ""}`;
  const [still, setStill] = useState(true);
  const lastSignature = useRef(signature);
  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    setStill(false);
    const timer = window.setTimeout(() => setStill(true), MOVE_MS + 40);
    return () => window.clearTimeout(timer);
  }, [signature]);

  const stopVisible = (agendaId: string) => {
    const route = layout.routeOfAgenda.get(agendaId);
    if (!route) return false;
    return route.kind !== "folded" || layout.topicById.get(route.topicId) === pickedTopic;
  };
  const paths = layout.joins.flatMap((join, at) => {
    const [a, b] = [layout.routeOfAgenda.get(join.from)!, layout.routeOfAgenda.get(join.to)!];
    const [ta, tb] = [layout.topicById.get(a.topicId)!, layout.topicById.get(b.topicId)!];
    const related = pickedTopic !== null && (pickedTopic === ta || pickedTopic === tb);
    const touched = hot !== null && (hot.includes(join.from) || hot.includes(join.to));
    if (!(related || touched) || !stopVisible(join.from) || !stopVisible(join.to)) return [];
    const yOfRoute = (route: RibbonRoute, topic: RibbonTopic) =>
      laneTops[topic.lane] +
      (route.kind === "main" ? g.Y : laneT[topic.lane] + (topic === pickedTopic ? (topic.sub.get(route.id) ?? 0) : 0) * g.SUB);
    const [from, to] = [layout.stopOfAgenda.get(join.from)!, layout.stopOfAgenda.get(join.to)!];
    const [ya, yb] = [yOfRoute(a, ta), yOfRoute(b, tb)];
    const [x1, x2] = [cx(from.meeting) + 8, cx(to.meeting) - 8];
    const mid = (x1 + x2) / 2;
    const d =
      x2 > x1 + 4
        ? `M${x1},${ya} C${mid},${ya} ${mid},${yb} ${x2},${yb}`
        : `M${cx(from.meeting) + 6},${ya} C${cx(from.meeting) + 26},${ya} ${cx(to.meeting) + 26},${yb} ${cx(to.meeting) + 6},${yb}`;
    return [
      <path
        key={at}
        d={d}
        fill="none"
        stroke={related ? ACCENT : "var(--el-muted)"}
        strokeWidth={related ? 2 : 1.5}
        strokeDasharray="3 3"
      />,
    ];
  });
  if (paths.length === 0) return null;
  return (
    <svg aria-hidden width={total} height={height} className={cn("pointer-events-none absolute top-0 left-0 z-[3]", !still && "opacity-0")}>
      {paths}
    </svg>
  );
}
