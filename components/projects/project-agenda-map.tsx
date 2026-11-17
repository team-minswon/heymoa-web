"use client";

import { track } from "@/lib/analytics/track";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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

export type Focus = { agenda?: string; topic?: string };

const emptyMemory = (): BoardMemory => ({ open: [], selection: null, panelOpen: false, tab: "agenda", scrollLeft: null });

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
    if (push) state.heymoaSel = false;
    if (push) window.history.pushState(state, "", window.location.href);
    else window.history.replaceState(state, "", window.location.href);
  } catch {
  }
}; 

const LEAVE_MS = 140;

type Stage =
  | { kind: "overview"; session: number; initial: BoardMemory; restore?: Restore }
  | { kind: "leaving"; session: number; initial: BoardMemory; restore?: Restore; topicId: string }
  | { kind: "focus"; session: number; topicId: string; agendaId?: string };
type Restore = { topicId: string; pageTop: number };

export function ProjectAgendaMap({
  workspaceId,
  projectId,
  focus,
}: {
  workspaceId: string;
  projectId: string;
  focus?: Focus;
}) {
  const t = useTranslations("workspace.agendaMap");
  const { projects } = useWorkspaceShell();
  const project = projects.find((candidate) => candidate.projectId === projectId);
  const query = useGetProjectMeetingLinks(projectId);
  const data = okData(query.data);
  const withAgendas = useMemo(() => (data ? data.notes.filter((note) => note.agendas.length > 0) : []), [data]);
  const skipped = data ? data.notes.length - withAgendas.length : 0;
  const map = useMemo(() => (data ? buildAgendaMap({ ...data, notes: withAgendas }) : null), [data, withAgendas]);
  const rows = useMemo(() => (map ? topicRows(map).rows : []), [map]);
  const index = useMemo(() => (map ? buildTopicIndex(map, rows) : null), [map, rows]);
  const [focused, setFocused] = useState(false);
  const reduced = useReducedMotion() ?? false;
  const [sawSkeleton] = useState(query.isLoading);

  const narrow = "mx-auto w-full max-w-[832px]";
  return (
    <ScrollArea className="min-h-0 flex-1" viewportClassName="overflow-x-hidden!">
      {!focused ? (
        <div className="mx-auto w-full max-w-4xl px-5 pt-8 sm:px-8 sm:pt-11">
          <header className="border-b border-[var(--el-hairline)]">
            <h2 className="min-h-[1.05em] truncate text-screen-title font-light leading-[1.05] tracking-[-0.035em] text-[var(--el-ink)]">
              {project?.name}
            </h2>
            <p className="mt-3 min-h-6 text-sm leading-6 text-[var(--el-muted)]">
              {map && index
                ? [
                    t("summary", { meetings: map.meetings.length, topics: index.topics.size }),
                    skipped > 0 ? t("skipped", { count: skipped }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : null}
            </p>
            <ProjectViewTabs workspaceId={workspaceId} projectId={projectId} current="map" className="mt-5" />
          </header>
        </div>
      ) : null}

      <div className={focused ? "mx-auto w-full max-w-[1600px] px-5 pb-16 pt-6 sm:px-6" : "mx-auto w-full max-w-[1600px] px-5 pb-16 sm:px-6"}>
        <ProjectViewBody>
          {query.isLoading ? (
            <div className={narrow}>
              <MapSkeleton />
            </div>
          ) : !map || !index ? (
            <div className={narrow}>
              <InlineRetry className="mt-6" label={t("loadFailed")} onRetry={() => void query.refetch()} />
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
  useEffect(() => {
    track("agenda_map_opened", { workspace_id: workspaceId, meetings: map.meetings.length, topics: rows.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [seed] = useState(() => {
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
      memory.open = row ? [] : [agenda.noteId];
      memory.selection = { rowId: row?.id ?? null, agendaId: agenda.agendaId };
      memory.panelOpen = true;
    }
    return { memory, saved: null, stage: { kind: "overview", session: 0, initial: { ...memory } } as Stage };
  });
  const memory = useRef<BoardMemory>(seed.memory);
  const [stage, setStage] = useState<Stage>(seed.stage);
  const stageRef = useRef(stage);
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
    if (stage.kind !== "leaving") writeSaved(snapshot(stage.kind === "focus" ? "focus" : "overview"), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  const onMemory = useCallback((next: Partial<BoardMemory>) => {
    memory.current = { ...memory.current, ...next };
    window.clearTimeout(saveTimer.current);
    if (Object.keys(next).some((key) => key !== "scrollLeft" && key !== "scrollTop") && stageRef.current.kind === "overview") {
      writeSaved(snapshot("overview"), false);
      return;
    }
    saveTimer.current = window.setTimeout(() => {
      if (stageRef.current.kind === "overview") writeSaved(snapshot("overview"), false);
    }, 160);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);
  // 돌아온 화면의 페이지 세로 스크롤(스크롤 상자는 문서가 아니라 브라우저가 되살려 주지 않는다)
  useLayoutEffect(() => {
    const page = rootRef.current?.closest("[data-slot=scroll-area-viewport]");
    if (seed.saved && page && seed.saved.kind === "overview") page.scrollTop = seed.saved.pageTop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (topicId: string, agendaId: string | undefined) => {
    window.clearTimeout(timer.current);
    if (stage.kind === "overview") {
      const page = rootRef.current?.closest("[data-slot=scroll-area-viewport]");
      pageTop.current = page?.scrollTop ?? 0;
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
  useEffect(() => {
    const onPop = () => {
      const saved = readSaved(projectId);
      const current = stageRef.current;
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

function MapEmpty({ meetings }: { meetings: number }) {
  const t = useTranslations("workspace.agendaMap.empty");
  return (
    <div className="mt-8 flex flex-col items-center gap-2 rounded-block border border-dashed border-[var(--el-hairline-strong)] px-6 py-14 text-center">
      <Orbit aria-hidden className="size-6 text-[var(--el-muted-soft)]" />
      <p className="text-[15px] font-medium text-[var(--el-ink)]">
        {t("title")}
      </p>
      <p className="max-w-md text-sm leading-6 text-[var(--el-muted)]">
        {meetings === 0 ? t("noMeetings") : t("noLinks", { count: meetings })}
      </p>
    </div>
  );
}

function MapSkeleton() {
  const t = useTranslations("workspace.agendaMap");
  return (
    <div aria-label={t("loading")} className="mt-6">
      <div className="mb-2.5 h-7" />
      <Skeleton className="h-[320px] w-full rounded-block" />
      <div className="mt-2.5 h-3.5" />
    </div>
  );
}
