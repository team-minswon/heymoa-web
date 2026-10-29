"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Orbit } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { AgendaFocus } from "@/components/projects/agenda-focus";
import { fadeOf, reducedMotion, swapIn } from "@/components/projects/agenda-ribbon-motion";
import { ProjectViewBody, ProjectViewTabs } from "@/components/projects/project-view-tabs";
import { RibbonBoard, type BoardMemory } from "@/components/projects/agenda-ribbon-board";
import { InlineRetry } from "@/components/ui/inline-retry";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { useGetProjectMeetingLinks } from "@/lib/api/generated/projects/projects";
import { okData } from "@/lib/api/ok-data";
import { buildTopicIndex, type TopicIndex } from "@/lib/projects/agenda-focus";
import { buildAgendaMap, topicRows, type AgendaMap, type TopicRow } from "@/lib/projects/agenda-map";

/** 주소로 받은 처음 자리. `?agenda=` 는 그 안건을 옆 패널로, `?topic=` 은 그 안건이 든 줄기의 포커스 화면으로 연다 */
export type Focus = { agenda?: string; topic?: string };

const emptyMemory = (): BoardMemory => ({ open: [], selection: null, panelOpen: false, tab: "agenda", scrollLeft: null });

/**
 * 화면 단계를 브라우저 기록 항목(`history.state`)에 남긴다 — 「회의록에서 보기」로 갔다가 뒤로 오면 펼친 열·고른 점·패널·가로 스크롤·포커스가 그대로 되살아난다
 * (기록 항목마다 따로라 새로 들어온 화면에는 없다). 포커스로 들어갈 때는 항목을 하나 더 쌓아서(`pushed`) 브라우저 뒤로·Esc·「위로」가 모두 한 단계씩 개요로 돌아온다.
 */
const HISTORY_KEY = "heymoaMap";
type Saved = { project: string; kind: "overview" | "focus"; topicId?: string; agendaId?: string; memory: BoardMemory; pageTop: number; pushed: boolean };
const readSaved = (project: string): Saved | null => {
  try {
    const saved = (window.history.state as Record<string, Saved> | null)?.[HISTORY_KEY];
    return saved && saved.project === project ? saved : null;
  } catch {
    return null;
  }
};
const writeSaved = (saved: Saved, push: boolean) => {
  try {
    const state = { ...(window.history.state ?? {}), [HISTORY_KEY]: saved };
    // 새로 쌓는 기록 항목은 옆 패널 단계(`heymoaSel`)를 물려받지 않는다
    if (push) state.heymoaSel = false;
    if (push) window.history.pushState(state, "", window.location.href);
    else window.history.replaceState(state, "", window.location.href);
  } catch {
    // 기록을 못 쓰는 환경에서는 이번 화면에서만 기억한다
  }
}; 

/** 포커스로 들어갈 때 다른 줄기가 옅어지는 시간. 이 뒤에 포커스 화면이 서서 옅게 나타나며 올라온다 */
const LEAVE_MS = 140;

/**
 * 화면 단계. `leaving` 은 포커스로 들어가는 짧은 사이(다른 줄기가 옅어진다), `session` 은 기본 화면을 새로 세우는 번호로 포커스에서 돌아올 때만
 * 올라간다(그때 한 번만 스크롤을 되살린다). 화면이 바뀔 때 점·카드는 옛 자리에서 날아오지 않는다 — 새 화면이 옅게 나타나며 8px 올라올 뿐이다.
 */
type Stage =
  | { kind: "overview"; session: number; initial: BoardMemory; restore?: Restore }
  | { kind: "leaving"; session: number; initial: BoardMemory; restore?: Restore; topicId: string }
  | { kind: "focus"; session: number; topicId: string; agendaId?: string };
type Restore = { topicId: string; pageTop: number };

/**
 * 프로젝트 안건 지도 — 상세를 네 단으로 늘리는 구조(시안 6). 기본 화면은 단색 캡슐 노선도이고, 점에 올리면 카드, 열 머리를
 * 누르면 그 열의 안건 제목, 점을 누르면 옆 패널, 줄기 이름을 누르면 그 줄기 하나를 크게 보는 포커스 화면이 열린다.
 * 연결은 회의 뒤 분석이 낸 `agendaLinks` 를 그대로 쓴다. 사람이 승인한 관계가 아니다(APP-1455 「안 하는 것」).
 */
export function ProjectAgendaMap({
  workspaceId,
  projectId,
  focus,
}: {
  workspaceId: string;
  projectId: string;
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
  const index = useMemo(() => (map ? buildTopicIndex(map, rows) : null), [map, rows]);
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion() ?? false;
  // 처음부터 데이터가 있었으면(다른 화면에서 건너오며 이미 받아 둔 경우) 내용이 움직이지 않는다
  const [sawSkeleton] = useState(query.isLoading);

  // 머리(제목·요약·탭)는 프로젝트의 노트 목록과 같은 틀(`max-w-4xl`·`px-5 sm:px-8`·`pt-8 sm:pt-11`)이라 탭을 오가도 한 픽셀도 움직이지 않는다.
  // 그 아래 판·옆 패널·보는 법은 그 틀 밖으로 좌우 대칭으로 넓게 펼친다: 쓸 수 있는 본문 폭의 양쪽에 20~24px 만 남기고, 아주 넓은 화면에서는 1600px 에서 멈춘다
  const narrow = "mx-auto w-full max-w-[832px]";
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName="overflow-x-hidden!">
      {!focused ? (
        <div className="mx-auto w-full max-w-4xl px-5 pt-8 sm:px-8 sm:pt-11">
          <header className="border-b border-[var(--el-hairline)]">
            {/* 제목·부제·탭 줄은 프로젝트의 노트 목록(`workspace-page`)과 같은 틀이다 — 탭을 눌러도 이 줄들이 움직이지 않는다 */}
            <h2 className="min-h-[1.05em] truncate text-screen-title font-light leading-[1.05] tracking-[-0.035em] text-[var(--el-ink)]">
              {project?.name}
            </h2>
            <p className="mt-3 min-h-6 text-sm leading-6 text-[var(--el-muted)]">
              {map && index
                ? `회의 ${map.meetings.length}개 · 주제 ${index.topics.size}개` +
                  (skipped > 0 ? ` · 안건 없는 회의 ${skipped}개 제외` : "")
                : null}
            </p>
            <ProjectViewTabs workspaceId={workspaceId} projectId={projectId} current="map" className="mt-5" />
          </header>
        </div>
      ) : null}

      <div className={focused ? "mx-auto w-full max-w-[1600px] px-5 pb-16 pt-6 sm:px-6" : "mx-auto w-full max-w-[1600px] px-5 pb-16 sm:px-6"}>
        <ProjectViewBody>
          {/* 자리표시가 데이터로 바뀔 때는 내용 덩어리 하나만 옅게 들어온다(안쪽 자식은 움직이지 않는다) */}
          {query.isLoading ? (
            <div className={narrow}>
              <MapSkeleton />
            </div>
          ) : !map || !index ? (
            <div className={narrow}>
              <InlineRetry className="mt-6" label="연결 지도를 불러오지 못했습니다" onRetry={() => void query.refetch()} />
            </div>
          ) : map.meetings.length === 0 || index.topics.size === 0 ? (
            <div className={narrow}>
              <MapEmpty meetings={map.meetings.length} />
            </div>
          ) : (
            <motion.div
              initial={sawSkeleton ? { opacity: 0 } : false}
              animate={{ opacity: 1, transition: fadeOf(reduced) }}
            >
              <MapStage
                workspaceId={workspaceId}
                projectId={projectId}
                map={map}
                rows={rows}
                index={index}
                focus={focus}
                onFocused={setFocused}
              />
            </motion.div>
          )}
        </ProjectViewBody>
      </div>
    </ScrollArea>
  );
}

function MapStage({
  workspaceId,
  projectId,
  map,
  rows,
  index,
  focus,
  onFocused,
}: {
  workspaceId: string;
  projectId: string;
  map: AgendaMap;
  rows: TopicRow[];
  index: TopicIndex;
  focus?: Focus;
  onFocused: (focused: boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // 처음 자리와, 판의 화면 상태(펼친 열·고른 것·패널·가로 스크롤). 상태는 포커스로 들어갔다 돌아와도 되살린다
  const [seed] = useState(() => {
    // 기록 항목에 남은 화면이 있으면(뒤로 가기·새로고침) 그대로 되살린다 — 첫 렌더부터 서 있어 깜빡임·펼침 움직임이 없다
    const saved = readSaved(projectId);
    if (saved) {
      if (saved.kind === "focus" && saved.topicId && index.topics.has(saved.topicId))
        return { memory: saved.memory, saved, stage: { kind: "focus", session: 0, topicId: saved.topicId, agendaId: saved.agendaId } as Stage };
      return { memory: saved.memory, saved, stage: { kind: "overview", session: 0, initial: { ...saved.memory } } as Stage };
    }
    const topicId = focus?.topic ? index.topicOfAgenda.get(focus.topic) : undefined;
    if (topicId) {
      const agendaId = focus?.agenda && index.topicOfAgenda.get(focus.agenda) === topicId ? focus.agenda : undefined;
      return { memory: emptyMemory(), saved: null, stage: { kind: "focus", session: 0, topicId, agendaId } as Stage };
    }
    const memory = emptyMemory();
    const agenda = focus?.agenda ? map.agendaById.get(focus.agenda) : undefined;
    if (agenda) {
      const row = rows.find((candidate) => [...candidate.cells.values()].flat().some((entry) => entry === agenda));
      // 이어짐 없는 안건은 펼친 열에서만 보이니 그 회의를 펼쳐 둔다
      memory.open = row ? [] : [agenda.noteId];
      memory.selection = { rowId: row?.id ?? null, agendaId: agenda.agendaId };
      memory.panelOpen = true;
    }
    return { memory, saved: null, stage: { kind: "overview", session: 0, initial: { ...memory } } as Stage };
  });
  const memory = useRef<BoardMemory>(seed.memory);
  const [stage, setStage] = useState<Stage>(seed.stage);
  const stageRef = useRef(stage);
  /** 포커스로 들어올 때 쌓은 기록 항목이 있는가(있으면 돌아갈 때 `history.back()` 이 한 단계를 되돌린다) */
  const pushed = useRef(seed.saved?.pushed ?? false);
  const saveTimer = useRef<number | undefined>(undefined);
  const snapshot = (kind: Saved["kind"], extra?: Partial<Saved>): Saved => {
    const page = rootRef.current?.closest("[data-slot=scroll-area-viewport]");
    const current = stageRef.current;
    return {
      project: projectId,
      kind,
      topicId: current.kind === "focus" ? current.topicId : undefined,
      agendaId: current.kind === "focus" ? current.agendaId : undefined,
      memory: { ...memory.current },
      pageTop: page?.scrollTop ?? 0,
      pushed: pushed.current,
      ...extra,
    };
  };
  const pageTop = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const inFocus = stage.kind === "focus";

  useEffect(() => onFocused(inFocus), [inFocus, onFocused]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    stageRef.current = stage;
    // 단계가 바뀌면 지금 기록 항목에 바로 적는다
    if (stage.kind !== "leaving") writeSaved(snapshot(stage.kind === "focus" ? "focus" : "overview"), false);
    // `snapshot` 은 참조만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  // 판의 화면 상태(펼친 열·고른 점·패널·가로 스크롤)가 바뀌면 잠깐 뒤(스크롤은 모아서) 적는다
  const onMemory = useCallback((next: Partial<BoardMemory>) => {
    memory.current = { ...memory.current, ...next };
    window.clearTimeout(saveTimer.current);
    // 스크롤이 아닌 변화(펼침·고른 것·패널·탭)는 바로 적는다 — 곧바로 다른 화면으로 가도 돌아올 때 낡은 상태가 되살아나지 않는다
    if (Object.keys(next).some((key) => key !== "scrollLeft" && key !== "scrollTop") && stageRef.current.kind === "overview") {
      writeSaved(snapshot("overview"), false);
      return;
    }
    saveTimer.current = window.setTimeout(() => {
      if (stageRef.current.kind === "overview") writeSaved(snapshot("overview"), false);
    }, 160);
    // `snapshot` 은 참조만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);
  // 돌아온 화면의 페이지 세로 스크롤(스크롤 상자는 문서가 아니라 브라우저가 되살려 주지 않는다)
  useLayoutEffect(() => {
    const page = rootRef.current?.closest("[data-slot=scroll-area-viewport]");
    if (seed.saved && page && seed.saved.kind === "overview") page.scrollTop = seed.saved.pageTop;
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (topicId: string, agendaId: string | undefined) => {
    window.clearTimeout(timer.current);
    if (stage.kind === "overview") {
      const page = rootRef.current?.closest("[data-slot=scroll-area-viewport]");
      pageTop.current = page?.scrollTop ?? 0;
      // 개요의 화면을 이 기록 항목에 적어 두고, 포커스 단계는 새 항목으로 쌓는다(브라우저 뒤로 = 개요 한 단계)
      window.clearTimeout(saveTimer.current);
      writeSaved(snapshot("overview"), false);
      pushed.current = true;
      writeSaved(snapshot("focus", { topicId, agendaId, pushed: true }), true);
      if (reducedMotion()) {
        setStage({ kind: "focus", session: stage.session, topicId, agendaId });
        return;
      }
      setStage({ ...stage, kind: "leaving", topicId });
      timer.current = window.setTimeout(() => setStage({ kind: "focus", session: stage.session, topicId, agendaId }), LEAVE_MS);
    } else if (stage.kind === "focus") setStage({ ...stage, topicId, agendaId });
  };

  const back = () => {
    if (stage.kind !== "focus") return;
    // 쌓아 둔 기록 항목이 있으면 그것을 되돌린다(popstate 가 개요로 돌려 놓는다). 주소로 곧바로 들어온 포커스는 직접 돌아간다
    if (pushed.current) {
      window.history.back();
      return;
    }
    toOverview(stage);
  };
  const toOverview = (from: Extract<Stage, { kind: "focus" }>) => {
    setStage({
      kind: "overview",
      session: from.session + 1,
      initial: { ...memory.current },
      restore: { topicId: from.topicId, pageTop: pageTop.current },
    });
  };
  // 브라우저 뒤로·앞으로: 기록 항목에 적힌 단계로 한 단계씩 간다
  useEffect(() => {
    const onPop = () => {
      const saved = readSaved(projectId);
      const current = stageRef.current;
      // 포커스로 들어가는 짧은 사이(`leaving`)에 예약해 둔 전환은 취소한다 — 돌아온 기록 항목이 이 타이머에 덮이지 않는다
      window.clearTimeout(timer.current);
      if (!saved) return;
      if (saved.kind === "overview" && current.kind === "leaving") {
        pushed.current = false;
        memory.current = { ...saved.memory };
        setStage({ kind: "overview", session: current.session, initial: current.initial, restore: current.restore });
      } else if (saved.kind === "overview" && current.kind === "focus") {
        pushed.current = false;
        memory.current = { ...saved.memory };
        toOverview(current);
      } else if (saved.kind === "focus" && saved.topicId && current.kind === "overview" && index.topics.has(saved.topicId)) {
        pushed.current = true;
        setStage({ kind: "focus", session: current.session, topicId: saved.topicId, agendaId: saved.agendaId });
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [projectId, index]);

  // 포커스 화면의 Esc 는 기본 화면으로 돌아온다(기본 화면의 Esc 는 판이 한 겹씩 닫는다)
  useEffect(() => {
    if (stage.kind !== "focus") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, [role=dialog]")) return;
      back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // 포커스 화면의 주소: 줄기의 마지막 안건을 `topic` 으로, 짚은 안건을 `agenda` 로 남긴다. 같은 화면의 상태라 라우터를 거치지 않는다
  useEffect(() => {
    if (stage.kind !== "focus") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("agenda");
    url.searchParams.delete("topic");
    const topic = index.topics.get(stage.topicId);
    if (topic) url.searchParams.set("topic", topic.agendas.at(-1)!.agendaId);
    if (stage.agendaId) url.searchParams.set("agenda", stage.agendaId);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [stage, index]);

  const reduced = useReducedMotion() ?? false;
  const key = stage.kind === "focus" ? `focus:${stage.session}` : `board:${stage.session}`;
  const [firstKey] = useState(key);
  const enter = swapIn(reduced);
  return (
    <div ref={rootRef} className="mt-0">
      {/* 화면이 바뀌면 새 화면이 옅게 나타나며 올라온다(점·카드가 옛 자리에서 날아오지 않는다). 첫 화면은 그대로 선다 */}
      <motion.div key={key} initial={key === firstKey ? false : enter.initial} animate={enter.animate}>
        {stage.kind === "focus" ? (
          <AgendaFocus
            workspaceId={workspaceId}
            map={map}
            rows={rows}
            index={index}
            topicId={stage.topicId}
            agendaId={stage.agendaId}
            onBack={back}
            onPick={pick}
          />
        ) : (
          <RibbonBoard
            workspaceId={workspaceId}
            map={map}
            rows={rows}
            initial={stage.initial}
            restore={stage.restore}
            leaving={stage.kind === "leaving" ? stage.topicId : null}
            onMemory={onMemory}
            onFocusTopic={(topicId) => pick(topicId, undefined)}
          />
        )}
      </motion.div>
    </div>
  );
}

/**
 * 이어진 안건이 아직 없을 때. 지도는 회의 둘 이상에서 안건이 이어져야 줄기가 서므로, 비어 있는 이유와 언제 채워지는지를 적는다.
 * 안건이 정리된 회의가 아직 없는 경우(`meetings` 가 0)와 회의는 있으나 이어짐이 없는 경우를 가른다.
 */
function MapEmpty({ meetings }: { meetings: number }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-2 rounded-block border border-dashed border-[var(--el-hairline-strong)] px-6 py-14 text-center">
      <Orbit aria-hidden className="size-6 text-[var(--el-muted-soft)]" />
      <p className="text-[15px] font-medium text-[var(--el-ink)]">
        회의가 둘 이상 쌓여 안건이 이어지면 흐름이 여기 보입니다
      </p>
      <p className="max-w-md text-sm leading-6 text-[var(--el-muted)]">
        {meetings === 0
          ? "아직 안건이 정리된 회의가 없습니다. 회의가 끝나면 그 회의의 안건이 여기에 모입니다."
          : `안건이 정리된 회의 ${meetings}개가 있지만 서로 이어진 안건은 아직 없습니다. 앞 회의와 이어지는 안건이 나오면 줄기로 그려집니다.`}
      </p>
    </div>
  );
}

/** 불러오는 동안. 판과 슬라이더 자리만 잡는다 */
function MapSkeleton() {
  return (
    <div aria-label="연결 지도를 불러오는 중" className="mt-6">
      <div className="mb-2.5 h-7" />
      <Skeleton className="h-[320px] w-full rounded-block" />
      <div className="mt-2.5 h-3.5" />
    </div>
  );
}
