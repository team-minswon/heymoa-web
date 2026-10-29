"use client";

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
  daysAfterPrevious,
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
/** 판 상자의 최대 높이: 화면 높이에서 위아래 여백을 뺀 값(페이지 스크롤 위치와 무관하게 판이 화면에 맞는다). 작은 판은 내용 높이 그대로라 세로 스크롤이 없다 */
const BOARD_MAX_H = "max(360px, calc(100dvh - 3rem))";
/**
 * 고른 줄기 밖의 농도(줄, 줄기 이름). 흐려진 줄의 선(판 배경과 3.3:1)도 2.5:1 아래로 내려가지 않는 값이다 — 고른 흐름은 색뿐 아니라 굵기(4→6px)로도 구분되니
 * 나머지를 더 흐리게 하지 않아도 가려 보인다.
 */
const DIM = 0.82;
const DIM_LABEL = 0.9;
/** 흐려지는 요소가 이보다 많으면(회의 수백 개) 요소마다 합성 층이 서서 한 프레임이 길어지니, 서서히 흐려지지 않고 바로 흐려진다 */
const FADE_MAX = 360;

/**
 * 고른 줄기 밖을 옅게 하는 규칙. 값이 변하지 않는 고정 규칙이라 줄기를 골라도 스타일시트가 바뀌지 않는다 — 고른 줄기의 줄(`data-on`)과 판 뿌리의 `data-picked` 만
 * 속성으로 바뀐다. (고른 줄기 id 를 담은 규칙을 그때그때 넣으면 요소 만오천 개의 스타일을 전부 다시 계산한다)
 */
/** 열이 펼쳐지고 접히는 시간(`MOVE` 스프링이 끝나는 때). 합류 경로가 따라가지 못하는 동안 거두어 두는 데 쓴다 */
const MOVE_MS = 260;
const DIM_CSS =
  `[data-ribbon][data-picked] [data-topic]{opacity:${DIM}}[data-ribbon][data-picked] [data-label]{opacity:${DIM_LABEL}}` +
  "[data-ribbon][data-picked] [data-topic][data-on],[data-ribbon][data-picked] [data-label][data-on]{opacity:1}";

/** 포커스로 들어갔다 돌아와도 되살리는, 판의 화면 상태 */
export type BoardMemory = {
  /** 펼친 회의(noteId) */
  open: string[];
  selection: Selection;
  panelOpen: boolean;
  tab: Tab;
  /** 가로 스크롤. null 이면 처음 자리(가장 최근 회의) */
  scrollLeft: number | null;
  /** 판 상자 안의 세로 위치(판이 화면보다 길 때) */
  scrollTop?: number;
};

/** 옆 패널의 폭과 판과의 간격. 패널은 어떤 폭에서도 판 옆에 서고 판 위를 덮지 않는다 */
const PANEL_W = 340;
const PANEL_GAP = 20;

const EMPTY: readonly MapAgenda[] = [];

/**
 * 프로젝트 연결 지도의 기본 화면 — 단색 캡슐 노선도. 회의 하나가 열 하나이고 주제 하나가 가로줄 하나를 곧게 지난다.
 * 줄기에서 그 회의에 든 안건이 하나면 점, 여럿이면 숫자 캡슐이다. 줄기를 안 다룬 회의 구간은 가는 선으로 지나간다.
 *
 * 열 폭은 이 화면의 폭(판 + 옆 패널 자리) ÷ 회의 수(`MIN_COL`~`MAX_COL`)이다. 패널이 열리고 닫혀도 열 폭은 변하지 않아 점이 제자리에 있고,
 * 판만 그만큼 좁아진다(고른 점이 가려지면 가린 만큼만 판을 옮긴다). 열이 `TITLE_COL` 이상으로 넓으면 안건 제목이 점 옆에 기본으로 보이고,
 * 그보다 좁으면 접어 두고 열 머리를 눌러 그 열만 펼친다(이웃은 밀려난다).
 * 상세는 네 단으로 늘어난다. ① 점에 올리면 카드 ② 열 머리를 누르면 그 열만 넓어져 안건 제목이 점 옆에 나타남 ③ 점·캡슐을 누르면 옆 패널
 * ④ 줄기 이름이나 패널의 버튼으로 그 줄기 하나를 크게 보는 포커스(`onFocusTopic`).
 *
 * 선이 꼬이지 않게, 기본 화면에서 갈래는 갈라진 안건 가까이 줄 바로 아래에만 붙고 먼 갈래는 「+N」으로 접는다. 앞 안건이 둘인
 * 합류는 표식만 둔다. 점에 올리거나 줄기를 고르면 그 줄기의 갈래와 합류가 모두 펴진다.
 *
 * 가로로 넘치는 판은 잡아 끌거나 양옆의 둥근 버튼(세로로 스크롤해도 판이 보이는 구간의 가운데에 붙어 따라온다)으로 옮기고, 열 머리 띠와 옆 패널은
 * 세로로 스크롤해도 화면 위에 남는다. 이 화면에는 위치를 옮기는 움직임이 없다 — 열이 펼쳐지고 접히든, 패널이 열리든, 줄기를 고르든 바로 바뀌고,
 * 나타나고 사라지는 것만 옅어진다.
 * 성능: 열은 `Column`(memo)이 자기 폭 안에서 그리고, 호버·스크롤은 이 컴포넌트를 다시 그리지 않는다(호버 카드·합류 경로가 각자 상태를 갖는다).
 * 점의 이벤트는 열 묶음 하나에서 위임해 받는다.
 */
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
  /** 포커스로 들어가는 중인 줄기. 나머지는 옅어지며 사라진다 */
  leaving: string | null;
  /** 포커스에서 돌아왔을 때: 페이지 스크롤을 되돌린다 */
  restore?: { topicId: string; pageTop: number };
  onFocusTopic: (topicId: string) => void;
}) {
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
  /** 판의 가로 스크롤(스크롤 이벤트와 우리가 옮길 때만 갱신한다 — 레이아웃을 읽지 않고도 안다) */
  const scrollNow = useRef(0);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(initial.open));
  const [selection, setSelection] = useState<Selection>(initial.selection);
  const [panelOpen, setPanelOpen] = useState(initial.panelOpen);
  const [tab, setTab] = useState<Tab>(initial.tab);
  const panelShown = panelOpen && selection !== null;
  // 패널이 닫히는 순간에도 마지막으로 고른 것을 쥐고 있어야 다시 열 때 같은 내용이 선다
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

  // 고른 주제와 안건이 선 자리(점·캡슐)
  const picked = selection?.agendaId ? (map.agendaById.get(selection.agendaId) ?? null) : null;
  const pickedTopic = selection?.rowId ? (layout.topicById.get(topicOf.get(selection.rowId) ?? "") ?? null) : null;
  const pickedMeeting = picked ? (meetingIndex.get(picked.noteId) ?? -1) : -1;
  const pickedAt = picked ? (layout.stopOfAgenda.get(picked.agendaId)?.meeting ?? pickedMeeting) : null;

  // ── 크기. 이 화면의 폭(판 + 옆 패널 자리)은 ResizeObserver 한 곳에서만 읽는다(호버·스크롤·클릭은 DOM 크기를 읽지 않는다).
  // 패널이 열려도 이 폭은 그대로라 열 폭이 변하지 않는다
  const [width, setWidth] = useState(0);
  // `moving`: 사용자가 눌러 펼친 열(누른 열과 앞뒤 이웃)만 폭이 움직인다. `snap`: 창 크기 때문에 판 폭이 바뀐 재배치는 바로 바뀐다 — 사용자가
  // 열을 누르거나 안건을 고르면 풀려서, 펼침·갈래 펴짐·패널이 부드럽게 옮겨 간다
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
    // 창 크기를 끄는 동안은 한 박자 늦춰 읽는다
    // 높이만 바뀐 알림(줄기를 골라 갈래 줄이 펴지고 접히는 것)은 거른다 — 그때 `snap` 이 켜지면 이어지는 줄 높이 움직임이 즉시로 바뀌어 닫힘이 열림보다 빨라진다
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
  /** 열이 넓어 안건 제목이 보이는 판 */
  const roomy = col >= TITLE_COL;
  // 패널이 열려 판이 좁아지면 열 폭은 그대로여도 한눈에 보이는 열 폭이 줄어든다 — 그 폭이 `TITLE_COL` 아래면 제목은 접고 점·캡슐만 남긴다(눌러서 연 열은 늘 보인다)
  const shownCol = (width - PAD * 2 - 2 - (panelShown ? PANEL_W + PANEL_GAP : 0)) / count;
  const titlesOn = !roomy || shownCol >= TITLE_COL;
  // 제목이 보이는 줄(자동으로든 열을 펼쳐서든)이 있으면 제목 줄이 서로·다음 줄기와 겹치지 않게 성긴 틀을 쓴다. 열을 처음 펼치거나 마지막으로 접을 때 틀이 바뀌며,
  // 그때는 줄 높이와 점 자리가 같이 바로 바뀐다(점은 틀 안의 자리를 그 자리에서 쓰니 스프링으로 움직이면 어긋난다)
  const titleGrid = roomy || open.size > 0;
  const g = titleGrid ? GRID_ROOMY : GRID_COMPACT;

  // 안건 제목이 보이는 열: 판이 넓으면 모두, 아니면 눌러서 펼친 열
  const openAt = useMemo(() => map.meetings.map((meeting) => roomy || open.has(meeting.noteId)), [map, open, roomy]);
  // 펼친 열의 폭: 그 열 안 가장 긴 제목이 점 오른쪽에 한 줄로 다 보이게 정한다(`openNeed`). 글자 폭은 글꼴로 한 번 재서 쥐고 있고(렌더 중에는 DOM 을 읽지 않는다),
  // 판이 닫혀 있으면 최대 760px, 옆 패널이 열려 판이 좁으면 남은 판 폭의 70% 까지다(`openCap`). 이보다 긴 극단적인 제목만 말줄임이고 호버 카드에 전문이 있다
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
      // 열이 넓어 제목이 기본으로 보이는 판은 패널이 열려도 열 폭이 그대로다(누른 열이 아니라 판이 정한 폭이라 점이 움직이지 않는다)
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
  // 패널이 열리고 닫혀 상한(`cap`)이 바뀌면 펼친 열의 폭이 바로 바뀐다(누른 열 이웃의 스프링은 거둔다). 그때 고른 점이 제자리에 있게(≤2px) 같은 커밋에서 스크롤을 맞춘다(아래 「가로 스크롤」).
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
  /** 점 가운데의 x(열 묶음 안). 접힌 열은 열 폭의 50%, 펼친 열은 25% 지점이다(펼친 열의 제목은 그 오른쪽에 선다) */
  const cx = (meeting: number) => xs[meeting] + widths[meeting] * (openAt[meeting] ? 0.25 : 0.5);

  // ── 세로. 판 몸의 좌표다(머리 띠는 따로 붙어 있다). 접힌 안건 알약이 있는 줄기는 알약 행만큼 갈래 길과 줄이 길다(`laneGeom`).
  // 고른 줄기는 갈래를 모두 펴느라 그 줄이 갈래 수만큼 더 길어지고, 아래 줄은 그만큼 밀린다
  const pillsOn = col >= PILL_COL || titleGrid;
  const hasPill = useMemo(
    () => layout.lanes.map((topics) => topics.some((topic) => topic.main.stops.some((stop) => stop.agendas.some((agenda) => (layout.folded.get(agenda.agendaId) ?? 0) > 0)))),
    [layout]
  );
  const geoms = useMemo(() => hasPill.map((pill) => laneGeom(g, pill ? (pillsOn ? "pill" : "hook") : null)), [hasPill, g, pillsOn]);
  // 갈래 길의 높이는 알약 모양 기준으로 늘 같다(좁은 열의 갈고리만 있을 때도): 첫 열을 펼치고 마지막 열을 접을 때 모든 열(수백 개)이 다시 그려지지 않는다
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
  // 줄의 세로 자리(`--lt-N`)와 아래 구역(`--zt`)은 `motion` 이 한 스프링으로 옮기는 값이다 — 줄기를 골라 갈래가 펴질 때 아래 줄이 같이 밀린다.
  // CSS 변수라 열을 다시 그리지 않는다. (판 몸의 높이는 변수가 아니라 높이 값 그대로 옮긴다 — 열을 펼쳐 아래 구역이 생길 때마다 변수를 바꾸면 모든 열의 스타일을 다시 계산한다)
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
  const days = useMemo(() => map.meetings.map((_, at) => daysAfterPrevious(map, at)), [map]);
  const dateKeys = useMemo(() => map.meetings.map((meeting) => getAppDateKey(meeting.startedAt)), [map]);
  const monthOf = useMemo(() => dateKeys.map((key) => key.slice(0, 7)), [dateKeys]);
  const marks = useMemo(() => headerMarks(dateKeys, xs, widths), [dateKeys, xs, widths]);
  const joinTargets = useMemo(() => new Set(layout.joins.map((join) => join.to)), [layout]);
  const joinTouches = useMemo(() => new Set(layout.joins.flatMap((join) => [join.from, join.to])), [layout]);

  // 점 하나(키 → 점과 그 줄기). 점의 이벤트는 열 묶음에서 위임해 받으니 키로 되짚는다
  const stopTable = useMemo(() => {
    const table = new Map<string, { stop: StopLike; topic: RibbonTopic | null }>();
    for (const column of columns) for (const cell of column.cells) table.set(cell.key, { stop: cell.stop, topic: cell.topic });
    for (const [meeting, agendas] of layout.extra)
      for (const agenda of agendas)
        table.set(`x:${agenda.agendaId}`, { stop: { meeting, agendas: [agenda] }, topic: layout.topicOfAgenda.get(agenda.agendaId) ?? null });
    return table;
  }, [columns, layout]);

  // ── 가로 스크롤
  const placed = useRef(false);
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || placed.current || width === 0) return;
    placed.current = true;
    // 처음엔 가장 최근 회의가 보이게 오른쪽 끝에서 연다. 주소로 고른 안건이 있으면 그 회의를 가운데에. 되돌아온 것이면 떠날 때 자리
    const at = pickedAt ?? -1;
    scroller.scrollLeft =
      initial.scrollLeft ?? (at < 0 ? scroller.scrollWidth : BOARD_END_GUTTER + cx(at) - scroller.clientWidth / 2);
    scrollNow.current = scroller.scrollLeft;
    if (initial.scrollTop) scroller.scrollTop = initial.scrollTop;
    if (restore) {
      const page = rootRef.current?.closest("[data-slot=scroll-area-viewport]");
      if (page) page.scrollTop = restore.pageTop;
      // 포커스 화면에서 돌아오면 키보드 포커스는 원래 줄기 이름으로 간다
      const name = rootRef.current?.querySelector<HTMLElement>(`[data-topic-name="${CSS.escape(restore.topicId)}"]`);
      name?.focus({ preventScroll: true });
    }
    // 열 폭이 정해진 뒤 처음 한 번만 자리를 잡는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width > 0]);

  // 상한이 바뀌어 열 폭이 바뀐 커밋: 고른 점의 가운데가 있던 화면 자리에 그대로 있게 그 점의 이동량만큼 스크롤을 옮긴다
  const seenGeo = useRef({ geo, cap });
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const prev = seenGeo.current;
    seenGeo.current = { geo, cap };
    if (!scroller || !placed.current || pickedAt === null || prev.cap === cap || prev.geo === geo) return;
    const at = (g: typeof geo) => g.xs[pickedAt] + g.widths[pickedAt] * (openAt[pickedAt] ? 0.25 : 0.5);
    const delta = at(geo) - at(prev.geo);
    if (Math.abs(delta) > 0.5) scroller.scrollLeft += delta;
    // 열 배치가 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  // 총 폭이 바뀌면(창 크기가 바뀌어 열 폭이 달라지면) 보던 곳이 그대로 보이게 비율로 맞춘다
  const lastTotal = useRef(total);
  const anchor = useRef<{ noteId: string; offset: number } | null>(null);
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && placed.current && lastTotal.current !== total && lastTotal.current > 0 && !anchor.current) {
      scroller.scrollLeft = (scroller.scrollLeft * total) / lastTotal.current;
    }
    lastTotal.current = total;
  }, [total]);

  // 열을 펼치거나 접으면 이웃이 밀려난다. 누른 열 머리가 그 자리에 있게 스크롤을 보정하고, 펼친 열이 화면에 다 들어오게 한다
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
    const ids = noteIds.current;
    setAnim({ moving: [ids[at - 1], noteId, ids[at + 1]].filter(Boolean), snap: false, closing: openNow.current.has(noteId), toggle: true });
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(noteId)) next.add(noteId);
      return next;
    });
  }, [setAnim]);
  useLayoutEffect(() => {
    const held = anchor.current;
    const scroller = scrollRef.current;
    if (!held || !scroller) return;
    anchor.current = null;
    const at = meetingIndex.get(held.noteId) ?? 0;
    // 누른 열 머리가 있던 자리에 그대로 있게 한다. 펼친 열이 화면 오른쪽 끝에 걸려도 판을 밀지 않는다(누른 것이 움직이지 않는 쪽이 먼저다)
    scroller.scrollLeft = BOARD_END_GUTTER + xs[at] - held.offset;
    // 펼침이 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 고른 점이 판 밖으로 나가거나 가장자리에 붙으면, 가려진 만큼만 판을 옮긴다(이미 보이면 손대지 않는다 — 점이 제자리에 있다).
  // 패널이 열리면 판이 좁아지지만 열 폭은 그대로라, 이 보정이 없으면 오른쪽 점이 패널 뒤에 숨는다. 판의 폭과 스크롤은 상태와 스크롤 이벤트로 알고 있어서
  // 레이아웃을 읽지 않는다(읽으면 패널이 막 열린 판 전체를 그 자리에서 다시 배치해 클릭 한 번이 100ms 가까이 걸린다)
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
  // ① 고른 안건이 바뀌었을 때: 다른 회의의 안건을 골랐거나 주소로 열었으면 그 점으로 부드럽게 옮긴다
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || pickedAt === null || !placed.current) return;
    const left = scrollNow.current;
    const target = leftFor(width - 2 - (panelShown ? PANEL_W + PANEL_GAP : 0), left);
    if (Math.abs(target - left) > 1) {
      if (reduced) scroller.scrollLeft = target;
      else scroller.scrollTo({ left: target, behavior: "smooth" });
    }
    // 고른 열이 바뀌었을 때, 화면 폭이 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedAt, width]);
  // ② 판의 폭이 바뀔 때(패널이 열리고 닫힐 때): 판이 좁아지는 걸음마다 점이 가려지지 않는 만큼만 따라 옮긴다. 판이 줄어드는 만큼 점이 같이 밀려 보인다
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
        // 점이 옮겨 갔으니 올려 보던 카드도 같은 프레임에 따라간다
        hover.current?.refresh();
      }
    });
    observer.observe(scroller);
    return () => observer.disconnect();
    // 고른 열과 열 배치가 바뀔 때만 새로 건다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedAt, geo, openAt]);

  // Esc 는 한 겹씩: 열려 있는 호버 카드 → 옆 패널 → 고른 것. (포커스 화면의 Esc 는 그쪽이 맡는다)
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

  // 점을 골라 옆 패널이 열리는 것도 브라우저 기록 한 단계다: 개요 → 점 선택은 `pushState`, 같은 단계 안의 점·칩 전환은 그대로(기록은 `replaceState` 로 갱신된다).
  // 연타해도 항목은 하나만 쌓이고, 뒤로 가기는 패널을 접으며, 패널을 접으면 그 항목을 되돌린다
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
        // 기록을 못 쓰는 환경에서는 한 단계로 치지 않는다
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
        // 되돌리는 사이 패널이 다시 열렸으면 새 단계를 쌓는다
        if (panelOpenRef.current) {
          window.history.pushState({ ...(window.history.state ?? {}), heymoaSel: true }, "", window.location.href);
          stepped.current = true;
        }
        return;
      }
      stepped.current = marked;
      if (!marked && panelOpenRef.current) setPanelOpen(false);
      // 앞으로 가기: 이 항목이 패널이 열린 단계였으면 닫아 둔 패널을 되살린다(고른 것은 그대로 쥐고 있다)
      else if (marked && !panelOpenRef.current && selectionRef.current) setPanelOpen(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // (기록 항목을 먼저 쌓은 다음 주소를 적어야 이전 항목의 주소가 바뀌지 않는다)
  // 고른 것을 주소에 남긴다(같은 화면의 상태라 라우터를 거치지 않는다)
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("agenda");
    url.searchParams.delete("topic");
    if (panelOpen && selection?.agendaId) url.searchParams.set("agenda", selection.agendaId);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [selection, panelOpen]);

  // 점을 눌러도 올려 보던 카드는 닫지 않는다 — 같은 카드가 그대로 있다가 마우스가 점을 떠나면 닫힌다
  const pick = (agenda: MapAgenda) => {
    lastPick.current = performance.now();
    setAnim((current) => (current.snap || current.toggle ? { ...current, snap: false, toggle: false } : current));
    setSelection({ rowId: rowOfAgenda.get(agenda.agendaId)?.id ?? null, agendaId: agenda.agendaId });
    setPanelOpen(true);
    setTab("agenda");
  };
  const pickStop = (stop: StopLike) => {
    // 고른 점을 다시 누르면 푼다
    if (panelOpen && picked && stop.agendas.some((agenda) => agenda.agendaId === picked.agendaId)) {
      setSelection(null);
      setPanelOpen(false);
    } else pick(stop.agendas[0]);
  };
  /** 접힌 갈래의 「+N」을 눌렀다: 그 줄기를 골라 갈래를 모두 펴고, 패널은 줄기 흐름을 보인다 */
  const unfoldAt = (stop: StopLike) => {
    pick(stop.agendas.find((agenda) => layout.foldedRoutes.has(agenda.agendaId)) ?? stop.agendas[0]);
    setTab("flow");
  };
  const focusTopic = (topicId: string) => {
    hover.current?.hide(true);
    onFocusTopic(topicId);
  };
  // 이름표(memo)가 쓰는 안 변하는 핸들러
  const focusRef = useRef(focusTopic);
  useEffect(() => {
    focusRef.current = focusTopic;
  });
  const focusStable = useCallback((topicId: string) => focusRef.current(topicId), []);

  // 고른 줄기 밖이 흐려지고(포커스로 들어가는 중이면 사라지고) 되돌아오는 움직임. 규칙(위 `DIM_CSS` 와 아래 `leavingRule`)은 흐려진 채로 있을 때의 값을 정하고,
  // 여기서는 그 값으로 가는 길만 그린다. 수백 개 요소의 투명도라 요소마다 `motion` 값을 만들지 않고 WAAPI 로 한 번에 건다(합성기가 돌려서 메인 스레드를 쓰지 않는다)
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
  // 포커스로 들어가는 중에는 그 줄기 밖을 모두 지우고 눌리지 않게 한다
  const leavingRule = leaving
    ? `[data-ribbon] [data-topic]:not([data-topic=${JSON.stringify(leaving)}]),[data-ribbon] [data-zone] [data-topic],` +
      `[data-ribbon] [data-label]:not([data-label=${JSON.stringify(leaving)}]){opacity:0!important}` +
      `[data-ribbon] [data-topic]:not([data-topic=${JSON.stringify(leaving)}]) [data-stop],[data-ribbon] [data-zone] [data-stop]{pointer-events:none}`
    : "";

  // ── 점의 이벤트(위임). 열마다 점마다 핸들러를 달지 않는다
  const foldPreview = (stop: StopLike): FoldPreview[] =>
    stop.agendas
      .flatMap((agenda) => layout.foldedRoutes.get(agenda.agendaId) ?? [])
      .map((route) => ({
        date: shortMeetingDate(map.meetings[route.stops[0].meeting].startedAt),
        title: route.stops[0].agendas[0].title,
        count: route.stops.reduce((sum, entry) => sum + entry.agendas.length, 0),
      }));
  const hovered = useRef<Element | null>(null);
  // 점을 누르면 패널이 열리며 판이 옮겨 가서 점이 가만히 있는 마우스 밑에서 밀려난다. 그때 브라우저가 내는 포인터 이동은 마우스가 움직인 것이 아니라 화면이
  // 움직인 결과라, 올려 보던 카드를 닫거나 다른 점의 카드로 바꾸지 않는다(카드는 점을 따라간다). 마우스가 실제로 움직이면 그때 판단한다
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
  // ── 방향키(roving tabindex): 점·캡슐 하나만 탭으로 들어오고, ←→ 는 같은 줄기의 앞·뒤 안건, ↑↓ 는 이웃 줄기에서 가장 가까운 열의 점으로 옮긴다
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
        // 가까운 줄기부터(세로 거리), 그 안에서 가로로 가장 가까운 열
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
    // 화면이 움직여 점이 마우스 밑을 떠난 것이면(포인터가 판 안에 그대로 있을 때만) 마우스가 실제로 움직일 때까지 미룬다. 포인터가 판 밖으로 나갔으면 바로 닫는다
    if (shifted() && next instanceof Node && rootRef.current?.contains(next)) {
      stale.current = true;
      return;
    }
    stale.current = false;
    hovered.current = null;
    joins.current?.hot(null);
    hover.current?.hide();
  };

  // ── 줄기 이름: 줄기가 시작하는 점 바로 위. 가로로 스크롤해 시작점이 지나가도 그 줄기가 이어지는 동안은 판 왼쪽(가장자리 버튼 안쪽)에 붙어 따라온다
  const widthKnown = width > 0;
  // 열 요소 목록: 열이 받는 값이 그대로인 렌더(호버·패널 등)에서는 150개 요소를 다시 만들지 않는다
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
              days={days[at]}
              hover={hover}
              onToggle={onToggle}
              instant={reduced || anim.snap || !anim.moving.includes(meeting.noteId)}
            />
          );
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [widthKnown, map, columns, layout, joinTargets, laneT, widths, col, openAt, pickedAt, pickedTopicId, picked, anim.snap, anim.moving, reduced, titlesOn, count, monthOf]
  );
  // 이름표 목록: 이름표 위치가 바뀌지 않은 렌더에서는 요소를 다시 만들지 않는다(250개 안팎의 `NameLabel` 요소 생성·비교를 건너뛴다)
  // 이름 옆 규모 문구는 줄기마다 한 번만 만든다
  const metaOf = useMemo(
    () => new Map(layout.lanes.flat().map((topic) => [topic.id, `안건 ${topic.agendaCount} · 회의 ${new Set(topic.routes.flatMap((route) => route.stops.map((stop) => stop.meeting))).size}`])),
    [layout]
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

  const hint = roomy ? "회의가 적어 안건 제목을 바로 보여 줍니다" : "회의 날짜를 누르면 그 회의의 안건 제목이 펼쳐집니다";
  const sideEdge = (at: number) => (at === 0 ? 1 : 0) + (at === count - 1 ? 2 : 0);

  return (
    <div ref={rootRef} data-ribbon="" data-picked={pickedTopicId ? "" : undefined} className="mt-6">
      <style>{DIM_CSS}</style>
      {leavingRule ? <style>{leavingRule}</style> : null}
      <div ref={boxRef} className="relative flex">
        <section aria-label="연결 지도" className="min-w-0 flex-1 contain-inline-size">
          <div className="mb-2.5 flex h-7 items-center justify-between gap-3 text-xs text-[var(--el-muted)]">
            <span>{hint}</span>
            {!roomy && open.size > 0 ? (
              <button
                type="button"
                onClick={() => {
                  anchor.current = null;
                  // 전부 한꺼번에(시차 없이) 접는다
                  setAnim({ moving: map.meetings.map((meeting) => meeting.noteId).filter((id) => open.has(id)), snap: false, closing: true, toggle: true });
                  setOpen(new Set());
                }}
                className="inline-flex h-7 items-center gap-1 rounded-control px-2 hover:bg-[var(--el-surface-strong)] hover:text-[var(--el-ink)]"
              >
                펼친 회의 {open.size}개 모두 접기
              </button>
            ) : null}
          </div>

          {/* 판 틀. `overflow-clip` 은 스크롤 상자를 만들지 않아서 안의 머리 띠·버튼이 페이지 스크롤에 `sticky` 로 붙는다. 줄의 세로 자리 변수(`--lt-N`)는 이 틀에 둔다 */}
          <motion.div
            data-board-frame=""
            initial={false}
            animate={bodyVars as TargetAndTransition}
            transition={layoutOf(reduced || anim.snap)}
            className="relative overflow-clip rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]"
          >
            {/* 가장자리 이동 버튼: 레이아웃 공간 없이 판 위에 뜨고, 더 갈 수 있는 쪽은 늘 보인다. 세로 스크롤은 CSS sticky 가 지연 없이 따라온다 */}
            <EdgeButtons scroller={scrollRef} reduced={reduced} inset={HEAD_H} />

            {/* 판 몸. 빈 곳이든 점 위든 잡아 끌어서 움직인다(`useDragPan`). 틀의 안쪽 끝까지 쓴다 */}
            <div
              ref={scrollRef}
              data-agenda-map=""
              data-scroller=""
              onScroll={(event) => {
                scrollNow.current = event.currentTarget.scrollLeft;
                onMemory({ scrollLeft: scrollNow.current, scrollTop: event.currentTarget.scrollTop });
              }}
              onClick={(event) => {
                // 빈 곳을 누르면 푼다
                if (selection && !(event.target as Element).closest("[data-stop], [data-fold], [data-head], [data-head-strip], button, a, [role=button]")) {
                  setSelection(null);
                  setPanelOpen(false);
                }
              }}
              className="scroll-pt-[80px] overflow-auto overscroll-x-contain select-none [scrollbar-width:thin]"
              style={{ maxHeight: BOARD_MAX_H }}
            >
              <div className="relative min-w-full" style={{ width: total + BOARD_END_GUTTER * 2 }}>
              {/* 열 머리 띠: 판과 같은 스크롤 상자 안에서 세로로만 위에 붙는다(`sticky top-0`). 가로로는 판과 한 몸이라 어긋날 수 없다 */}
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
                {/* 줄 번갈아 깔리는 띠와 아래 구역의 구분선: 판 내용 안에 깔려 판과 같이 스크롤한다 */}
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
                        그 밖의 안건
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* 열 묶음. 열마다 자기 폭 안에서 선·점·제목을 그리고, 이웃은 flex 로 밀린다 */}
                <div
                  className="absolute top-0 flex h-full"
                  style={{ left: BOARD_END_GUTTER, width: total }}
                  onPointerMove={(event) => {
                    lastMove.current = performance.now();
                    // 화면이 움직여 마우스 밑을 떠난 점의 카드는, 마우스가 실제로 움직이는 순간 닫거나 새 점의 카드로 바꾼다
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
                    // 진짜 버튼(제목·구역 목록)은 브라우저가 클릭으로 바꿔 주니 여기서 또 처리하지 않는다
                    if (!target.matches("[role=button]")) return;
                    const { fold, entry } = entryOf(target);
                    if (!entry) return;
                    event.preventDefault();
                    if (fold) unfoldAt(entry.stop);
                    else pickStop(entry.stop);
                  }}
                >
                  {/* 화면 폭을 읽기 전(첫 렌더)에는 열을 세우지 않는다 — 임시 폭으로 먼저 서면 읽은 폭으로 옮겨 가는 것이 보인다 */}
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
                        // 열은 줄 안 치수만 쓰고 그것은 두 틀이 같다: 틀이 바뀌어도 열(수백 개)을 다시 그리지 않는다
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

        {/* 옆 패널: 어떤 폭에서도 판 옆에 서고(판 위를 덮지 않는다), 열리고 닫힐 때 폭이 판의 열과 같은 스프링으로 옮겨 간다. 세로로 스크롤해도 화면에 붙어 따라온다 */}
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

/** 고른 안건과 같은 회의·같은 줄기에서 다룬 안건(고른 것 포함) */
function panelSiblings(selection: NonNullable<Selection>, map: AgendaMap, layout: RibbonLayout): MapAgenda[] {
  const agenda = selection.agendaId ? map.agendaById.get(selection.agendaId) : undefined;
  if (!agenda) return [];
  const stop = layout.stopOfAgenda.get(agenda.agendaId);
  if (stop) return stop.agendas;
  const meeting = map.meetings.findIndex((entry) => entry.noteId === agenda.noteId);
  return layout.extra.get(meeting) ?? [agenda];
}

/**
 * 판 옆 패널의 자리. 폭이 0 에서 열려 닫히고(판은 열 폭이 그대로라 점이 제자리에 있고 판만 좁아진다), 닫히는 동안에도 내용을 쥐고 있다가 다 닫히면 내린다.
 * 안쪽 상자가 틀의 높이를 다 차지해서(`h-full`), 패널(`sticky`)이 세로로 스크롤해도 화면에 붙어 따라온다.
 */
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

/** 줄 번갈아 깔리는 옅은 띠 */
const BAND = "bg-[color-mix(in_srgb,var(--el-hairline-soft)_55%,transparent)]";

/** 열 머리 위쪽의 글자(해, 달). 열이 넓으면 해가 바뀌는 자리에만, 좁으면 달이 바뀌는 자리에 적는다. `dateKeys` 는 회의마다 `YYYY-MM-DD` */
function headerMarks(dateKeys: string[], xs: number[], widths: number[]) {
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
      const text = newYear ? `${year}.${month}` : `${Number(month)}월`;
      const end = left + text.length * 7.5 + 8;
      // 뒤에 펼친 열이 바싹 서 있으면 그 열 머리 글자와 겹치니 달 글자를 적지 않는다
      let wide = false;
      for (let next = at + 1; next < xs.length && xs[next] < end; next += 1) wide ||= widths[next] >= 60;
      if (wide) return;
      marks[at] = { text, top: widths[at] >= 34 ? 3 : 12, strong: true };
      lastEnd = end;
    }
  });
  return marks;
}

// ── 줄기 이름표 ────────────────────────────────────────────────────────────────

/**
 * 줄기 이름. 올리면 안내가 뜨고 누르면 그 줄기 하나를 크게 본다. 세로 자리는 판의 `--lt-N` 변수가 정하고, 열이 펼쳐지고 접힐 때 시작 자리와 폭이 열과 같은 스프링으로 따라간다.
 * 가로로 스크롤하면 판 왼쪽 가장자리(스크롤 상자 안쪽)에 붙어 따라온다.
 */
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
  /** 이름 옆 작은 규모(「안건 N · 회의 M」). 이름표가 좁으면 없다 */
  meta: string | null;
  lane: number;
  left: number;
  width: number;
  top: number;
  on: boolean;
  size: number;
  instant: boolean;
  /** 열을 접는 중이면 열 폭이 접힐 때의 시간표(펼친 내용이 먼저 옅어진 뒤)로 따라간다 */
  closing: boolean;
  hover: RefObject<HoverApi | null>;
  onFocusTopic: (topicId: string) => void;
}) {
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
        aria-label={`${topic.name} · 눌러서 이 줄기만 크게 보기`}
        onClick={() => onFocusTopic(topic.id)}
        onPointerEnter={(event) =>
          hover.current?.show({
            rect: event.currentTarget.getBoundingClientRect(),
            el: event.currentTarget,
            tip: { title: topic.name, text: "눌러서 이 줄기만 크게 보기" },
          })
        }
        onPointerLeave={() => hover.current?.hide()}
        className={cn(
          // 줄기 이름은 소제목이다: 안건 제목(13px·보통·옅은 잉크)보다 한 단계 큰 15~16px, 굵게, 가장 진한 잉크.
          // 이름이 열 가장자리(펼친 면의 테두리) 위를 지나가도 선이 글자를 가로지르지 않게 글자 둘레를 판 색으로 비운다
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

// ── 합류 경로 ─────────────────────────────────────────────────────────────────

type JoinsApi = { hot: (ids: string[] | null) => void };

/**
 * 합류(앞 안건이 둘)의 경로 전체: 고른 줄기에 닿는 것, 올려 둔 점에 닿는 것만 그린다. 올려 둔 점의 상태를 여기에 두어,
 * 점에 올릴 때 판 전체가 아니라 이 레이어만 다시 그린다. 열이 움직이는 동안은 경로가 따라가지 못하니 옅게 거두었다가 다시 보인다.
 */
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

  // 열이 움직이는 동안은 경로가 따라가지 못하니 옅게 거두었다가 다 선 뒤 다시 보인다
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
