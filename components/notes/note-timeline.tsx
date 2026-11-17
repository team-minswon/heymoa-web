"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronRight,
  Folder,
  Users,
} from "lucide-react";

import { useNoteRealtime } from "@/components/notes/note-realtime-provider";
import { useLivePartial } from "@/components/notes/use-live-partial";
import {
  evidenceMarkOf,
  SCREEN_CHANGE_HOLD_MS,
} from "@/components/notes/use-transcript-focus";
import {
  useRecording,
  useRecordingTranscript,
} from "@/components/transcription/recording-provider";
import { flowPollInterval } from "@/lib/notes/review/flow-cache";
import { useEventStreamHealthy } from "@/lib/events/health";
import { hintedInterval } from "@/lib/events/interval";
import { useGetAnalysisFlow } from "@/lib/api/generated/analysis/analysis";
import {
  SpeakerChip,
  useSpeakerFallbackNames,
} from "@/components/notes/speaker-chip";
import { useGetNoteAgendas } from "@/lib/api/generated/notes/notes";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";
import { okData } from "@/lib/api/ok-data";
import {
  createSpeakerIdentityResolver,
  type SpeakerFace,
  type SpeakerIdentity,
} from "@/lib/transcription/speaker-identity";
import { CopyMarkdownButton } from "@/components/notes/copy-markdown-button";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import {
  LiveChip,
  TIMELINE_ROW_GRID,
  TONE_TEXT,
  TONE_TITLE,
} from "@/components/notes/timeline-visual";
import { ScrollToBottomButton } from "@/components/heymoa/scroll-to-bottom-button";
import { InlineRetry } from "@/components/ui/inline-retry";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { timelineToMarkdown } from "@/lib/notes/minutes/markdown";
import { minutesTimeline } from "@/lib/notes/minutes/model";
import type { ProposalHead } from "@/lib/notes/proposals/contract";
import {
  inFilter,
  placeAgendas,
  samePlacement,
  selectTimeline,
  TIMELINE_FILTERS,
  type AgendaPlacement,
  type TimelineFilter,
  type TimelineGroup,
  type TimelineItem,
} from "@/lib/notes/proposals/timeline";
import {
  formatOffset,
  mergeLiveSegments,
} from "@/lib/transcription/presentation";
import { cn } from "@/lib/utils";
import {
  distanceFromBottom,
  FOLLOW_STICK_PX,
  nextFollowing,
  watchUpwardInput,
} from "@/lib/notes/follow-scroll";

const MotionChevronDown = motion.create(ChevronDown);

export type TimelineHeader = {
  title: string;
  whenIso: string;
  whenLabel: string;
  participantCount: number;
  projectName: string | null;
};

type TimelineT = ReturnType<typeof useTranslations<"notes.timeline">>;

export function formatFreshness(
  lastBatchAt: string | null,
  now: number,
  t: TimelineT
) {
  if (!lastBatchAt) return null;
  const elapsed = now - Date.parse(lastBatchAt);
  if (!Number.isFinite(elapsed)) return null;
  if (elapsed < 45_000) return t("freshness.justNow");
  const minutes = Math.round(elapsed / 60_000);
  if (minutes < 60) return t("freshness.minutesAgo", { count: minutes });
  return t("freshness.hoursAgo", { count: Math.floor(minutes / 60) });
}

/** 흐르는 시계. 렌더 중에 `Date.now()` 를 부르면 hydration 이 어긋난다. 서버에서는 `null` 이다. */
function useNow(intervalMs: number) {
  const [now, setNow] = useState<number | null>(() =>
    typeof window === "undefined" ? null : Date.now()
  );
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const NONE: ReadonlySet<string> = new Set();

const itemId = (proposalId: string) => `timeline-item-${proposalId}`;
const groupId = (key: string) => `timeline-agenda-${key}`;

function metaOf(
  item: TimelineItem,
  t: TimelineT
): Array<{ text: string; tone?: "error" }> {
  const { proposal } = item;
  const parts: Array<{ text: string; tone?: "error" }> = [];
  if (proposal.closeReason === "RETRACTED") {
    parts.push({ text: t("retracted"), tone: "error" });
  } else if (
    proposal.operation === "AMEND" ||
    proposal.operation === "CORRECT"
  ) {
    parts.push({ text: t(`operations.${proposal.operation}`) });
  }
  if (item.tone === "open" && proposal.kind === "QUESTION") {
    parts.push({ text: t("awaitingAnswer") });
  }
  if (item.tone === "answered") {
    const at = item.answers[0]?.citations[0]?.startedAtMs;
    parts.push({
      text:
        at === undefined
          ? t("answered")
          : t("answeredAt", { time: formatOffset(at) }),
    });
  }
  return parts;
}

const NO_PLACEMENT: AgendaPlacement = new Map();

function groupRange(group: TimelineGroup, recording: boolean, t: TimelineT) {
  if (group.startMs === null) return null;
  const start = formatOffset(group.startMs);
  if (group.endMs !== null && group.endMs !== group.startMs)
    return `${start} – ${formatOffset(group.endMs)}`;
  if (group.last && recording) return t("rangeNow", { start });
  return start;
}

export function NoteTimeline({
  header,
  onEvidenceSelect,
  meetingEnded = false,
  recording = false,
  participants = [],
  focusAgendaId = null,
  onFocusHandled,
  active = true,
}: {
  /** 타임라인 탭이 보이는가. 숨은 동안의 스크롤 이동은 브라우저가 무시하므로 보이는 순간 첫 위치를 잡는다. */
  active?: boolean;
  focusAgendaId?: string | null;
  onFocusHandled?: () => void;
  header: TimelineHeader | null;
  participants?: SpeakerFace[];
  onEvidenceSelect: (segmentId: string) => void;
  meetingEnded?: boolean;
  recording?: boolean;
}) {
  const t = useTranslations("notes.timeline");
  const fallbackNames = useSpeakerFallbackNames();
  const { context, noteId, transcript: topicTranscript } = useNoteRealtime();
  const ownRecording = useRecording();
  const ownTranscript = useRecordingTranscript();
  const liveForNote =
    (ownRecording.activeNoteId ?? ownRecording.session?.noteId) === noteId;
  const partial = useLivePartial(noteId);

  const [view, setView] = useState<{
    noteId: string;
    endedSeen: boolean;
    foldByDefault: boolean;
    instant: boolean;
    filter: TimelineFilter;
    open: ReadonlySet<string>;
    flipped: ReadonlySet<string>;
  }>({
    noteId,
    endedSeen: meetingEnded,
    foldByDefault: meetingEnded,
    instant: false,
    filter: "ALL",
    open: NONE,
    flipped: NONE,
  });
  if (view.noteId !== noteId) {
    setView({
      noteId,
      endedSeen: meetingEnded,
      foldByDefault: meetingEnded,
      instant: false,
      filter: "ALL",
      open: NONE,
      flipped: NONE,
    });
  } else if (view.endedSeen !== meetingEnded) {
    setView({
      ...view,
      endedSeen: meetingEnded,
      foldByDefault: meetingEnded,
      instant: false,
      flipped: NONE,
    });
  }
  const evidenceOpen = view.noteId === noteId && view.open.size > 0;
  const streamHealthy = useEventStreamHealthy();
  const flowQuery = useGetAnalysisFlow(noteId, {
    query: {
      enabled: meetingEnded,
      refetchInterval: (query) => {
        const flow = okData(query.state.data);
        return hintedInterval(
          streamHealthy,
          flowPollInterval(flow?.status ?? null, flow?.regions)
        );
      },
    },
  });
  const analyzing =
    meetingEnded &&
    (["DIARIZING", "NOT_REQUESTED", "ANALYZING"].includes(
      okData(flowQuery.data)?.status ?? ""
    ) ||
      (okData(flowQuery.data)?.regions ?? []).some(
        (row) => row.status === "PENDING"
      ));
  const diarizing =
    meetingEnded && okData(flowQuery.data)?.status === "DIARIZING";
  const transcriptQuery = useGetNoteTranscript(noteId, {
    query: {
      enabled: evidenceOpen,
      refetchInterval: (query) => {
        const status = okData(query.state.data)?.diarization.status;
        return diarizing || status === "ASSEMBLING" || status === "SUBMITTED"
          ? 5_000
          : false;
      },
    },
  });
  const transcript = okData(transcriptQuery.data);
  const citationSpeakers = useMemo(() => {
    const speakerOf = createSpeakerIdentityResolver(
      transcript?.diarization.status === "MAPPED"
        ? transcript.diarization.speakers
        : [],
      participants,
      fallbackNames.speaker
    );
    return new Map(
      mergeLiveSegments(
        transcript?.segments ?? [],
        liveForNote ? ownTranscript.finalSegments : [],
        topicTranscript.finalSegments
      ).map((segment) => [
        segment.segmentId,
        speakerOf(segment.speakerLabel, segment.assignedParticipantId),
      ])
    );
  }, [
    transcript,
    participants,
    fallbackNames,
    liveForNote,
    ownTranscript.finalSegments,
    topicTranscript.finalSegments,
  ]);
  const filter = view.filter;
  const listFilter = useDeferredValue(filter);
  const reducedMotion = useReducedMotion();

  const agendasQuery = useGetNoteAgendas(noteId, {
    query: { refetchInterval: analyzing ? 10_000 : false },
  });
  const refetchAgendas = agendasQuery.refetch;
  const wasAnalyzing = useRef(analyzing);
  useEffect(() => {
    if (wasAnalyzing.current && !analyzing) void refetchAgendas();
    wasAnalyzing.current = analyzing;
  }, [analyzing, refetchAgendas]);
  const agendaList = okData(agendasQuery.data);
  const listLoading = context.loading || agendasQuery.isPending;
  const agendasFailed = agendasQuery.isError;
  const [placed, setPlaced] = useState<{
    noteId: string;
    placement: AgendaPlacement;
  }>({
    noteId,
    placement: NO_PLACEMENT,
  });
  const previousPlacement =
    placed.noteId === noteId ? placed.placement : NO_PLACEMENT;
  const placement = useMemo(
    () =>
      agendaList
        ? placeAgendas(
            previousPlacement,
            Object.values(context.state.proposals),
            agendaList,
            !meetingEnded
          )
        : null,
    [agendaList, previousPlacement, context.state.proposals, meetingEnded]
  );
  if (
    placement &&
    (placed.noteId !== noteId || !samePlacement(placement, previousPlacement))
  ) {
    setPlaced({ noteId, placement });
  }

  const allTimeline = useMemo(
    () =>
      selectTimeline(
        context.state,
        "ALL",
        agendaList && placement ? { list: agendaList, placement } : null
      ),
    [context.state, agendaList, placement]
  );
  const timeline = useMemo(
    () =>
      listFilter === "ALL"
        ? allTimeline
        : {
            ...allTimeline,
            groups: allTimeline.groups
              .map((group) => ({
                ...group,
                items: group.items.filter((item) =>
                  inFilter(item.tone, listFilter)
                ),
              }))
              .filter((group) => group.items.length > 0),
          },
    [allTimeline, listFilter]
  );

  const [seenGroups, setSeenGroups] = useState({
    noteId,
    groups: allTimeline.groups,
  });
  if (
    seenGroups.noteId !== noteId ||
    seenGroups.groups !== allTimeline.groups
  ) {
    setSeenGroups({ noteId, groups: allTimeline.groups });
    const before = new Map(
      seenGroups.noteId === noteId
        ? seenGroups.groups.map((group) => [group.key, group.total])
        : []
    );
    const grown = allTimeline.groups.filter(
      (group) =>
        group.agenda &&
        before.has(group.key) &&
        group.total > before.get(group.key)!
    );
    if (!meetingEnded && view.noteId === noteId && grown.length > 0) {
      const flipped = new Set(view.flipped);
      for (const group of grown) {
        if (view.foldByDefault) flipped.add(group.key);
        else flipped.delete(group.key);
      }
      if (
        flipped.size !== view.flipped.size ||
        [...flipped].some((key) => !view.flipped.has(key))
      ) {
        setView({ ...view, flipped, instant: true });
      }
    }
  }

  const pendingScroll = useRef<{
    id: string;
    block: ScrollLogicalPosition;
  } | null>(null);
  const jumpTo = (proposal: ProposalHead) => {
    updateFollowing(false);
    pendingScroll.current = {
      id: itemId(proposal.proposalId),
      block: "center",
    };
    setView((current) => ({
      ...current,
      filter: "ALL",
      open: new Set(current.open).add(proposal.proposalId),
      foldByDefault: false,
      instant: true,
      flipped: NONE,
    }));
  };
  const jumpToGroup = (key: string, block: ScrollLogicalPosition = "start") => {
    updateFollowing(false);
    pendingScroll.current = { id: groupId(key), block };
    setView((current) => {
      const flipped = new Set(current.flipped);
      if (current.foldByDefault) flipped.add(key);
      else flipped.delete(key);
      return { ...current, filter: "ALL", flipped, instant: true };
    });
  };
  useEffect(() => {
    const target = pendingScroll.current;
    if (!target) return;
    const element = document.getElementById(target.id);
    if (!element) return;
    pendingScroll.current = null;
    element.scrollIntoView?.({ block: target.block });
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const readAwayNoteRef = useRef<string | null>(null);
  const positionedNoteRef = useRef<string | null>(null);
  const [followingState, setFollowingState] = useState({
    noteId,
    following: true,
  });
  const isFollowing =
    followingState.noteId === noteId ? followingState.following : true;
  const updateFollowing = useCallback(
    (following: boolean) => {
      followingRef.current = following;
      setFollowingState((current) =>
        current.noteId === noteId && current.following === following
          ? current
          : { noteId, following }
      );
    },
    [noteId]
  );
  const toggle = useCallback(
    (key: "open" | "flipped", id: string) => {
      updateFollowing(false);
      readAwayNoteRef.current = noteId;
      setView((current) => {
        const next = new Set(current[key]);
        if (!next.delete(id)) next.add(id);
        return { ...current, [key]: next, instant: false };
      });
    },
    [noteId, updateFollowing]
  );
  const syncFollowing = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    updateFollowing(distanceFromBottom(viewport) <= FOLLOW_STICK_PX);
  }, [updateFollowing]);
  const jumpToGroupRef = useRef(jumpToGroup);
  useEffect(() => {
    jumpToGroupRef.current = jumpToGroup;
  });
  const focusGroup = focusAgendaId
    ? allTimeline.groups.find(
        (group) => group.agenda && group.key.startsWith(`${focusAgendaId}:`)
      )
    : undefined;
  const focusKey = focusGroup?.key ?? null;
  const focusMark = focusGroup?.agenda
    ? evidenceMarkOf(focusGroup.agenda.title, { holdMs: SCREEN_CHANGE_HOLD_MS })
    : null;
  const focusLifetimeMs = focusMark?.lifetimeMs ?? 0;
  const [priorMark, setPriorMark] = useState<{
    key: string;
    nonce: number;
  } | null>(null);
  const priorGroup = priorMark
    ? allTimeline.groups.find((group) => group.key === priorMark.key)
    : undefined;
  const priorPen = priorGroup?.agenda
    ? evidenceMarkOf(priorGroup.agenda.title)
    : null;
  const priorLifetimeMs = priorPen?.lifetimeMs ?? 0;
  useEffect(() => {
    if (!priorMark) return;
    const timer = window.setTimeout(() => setPriorMark(null), priorLifetimeMs);
    return () => window.clearTimeout(timer);
  }, [priorMark, priorLifetimeMs]);
  const jumpToPrior = (key: string) => {
    setPriorMark((current) => ({ key, nonce: (current?.nonce ?? 0) + 1 }));
    jumpToGroup(key, "center");
  };
  useEffect(() => {
    if (!focusKey) return;
    const frame = requestAnimationFrame(() => jumpToGroupRef.current(focusKey));
    const timer = window.setTimeout(() => onFocusHandled?.(), focusLifetimeMs);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusKey, focusLifetimeMs, onFocusHandled]);

  const scrollToLatest = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = Math.max(
      0,
      viewport.scrollHeight - viewport.clientHeight
    );
    syncFollowing();
  };
  useEffect(() => {
    readAwayNoteRef.current = null;
    positionedNoteRef.current = null;
    followingRef.current = true;
  }, [noteId]);
  const endedRef = useRef(meetingEnded);
  useEffect(() => {
    if (endedRef.current === meetingEnded) return;
    endedRef.current = meetingEnded;
    if (!meetingEnded) return;
    readAwayNoteRef.current = null;
    positionedNoteRef.current = null;
  }, [meetingEnded]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let previousTop: number | null = null;
    let previousHeight = viewport.scrollHeight;
    const handleScroll = () => {
      const top = viewport.scrollTop;
      const previous = previousTop;
      previousTop = top;
      const height = viewport.scrollHeight;
      const contentGrew = height > previousHeight;
      previousHeight = height;
      if (previous !== null && top === previous) return;
      updateFollowing(
        nextFollowing({
          following: followingRef.current,
          top,
          previousTop: previous,
          distance: distanceFromBottom(viewport),
          contentGrew,
        })
      );
      if (!followingRef.current) readAwayNoteRef.current = noteId;
    };
    const stopWatching = watchUpwardInput(viewport, () => {
      if (!followingRef.current) return;
      updateFollowing(false);
      readAwayNoteRef.current = noteId;
    });
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    if (!recording) syncFollowing();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (!recording) syncFollowing();
            else if (followingRef.current) {
              viewport.scrollTop = Math.max(
                0,
                viewport.scrollHeight - viewport.clientHeight
              );
              previousTop = viewport.scrollTop;
              previousHeight = viewport.scrollHeight;
            }
          });
    observer?.observe(viewport);
    if (viewport.firstElementChild)
      observer?.observe(viewport.firstElementChild);
    return () => {
      stopWatching();
      viewport.removeEventListener("scroll", handleScroll);
      observer?.disconnect();
    };
  }, [noteId, recording, syncFollowing, updateFollowing]);
  useEffect(() => {
    if (!active) return;
    const initial =
      positionedNoteRef.current !== noteId &&
      !listLoading &&
      !context.failed &&
      timeline.groups.length > 0;
    if (!initial && (!recording || !followingRef.current)) return;
    const frame = window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport || (!initial && !followingRef.current)) return;
      if (initial) {
        positionedNoteRef.current = noteId;
        if (readAwayNoteRef.current === noteId && !followingRef.current) return;
      }
      const toTop = initial && meetingEnded;
      viewport.scrollTop = toTop
        ? 0
        : Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      if (initial) updateFollowing(!toTop);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    active,
    noteId,
    recording,
    meetingEnded,
    listLoading,
    context.failed,
    timeline.groups,
    partial?.confirmedText,
    partial?.pendingText,
    updateFollowing,
  ]);

  const settled = !listLoading && !context.failed;
  const now = useNow(20_000);
  const freshness =
    now === null ? null : formatFreshness(context.state.lastBatchAt, now, t);
  const hint = meetingEnded
    ? t("status.ended")
    : freshness
      ? t("status.liveUpdated", { freshness })
      : t("status.live");

  return (
    <ScrollArea
      className="h-full"
      viewportRef={viewportRef}
      viewportClassName="overflow-x-hidden!"
      overlay={
        !isFollowing ? (
          <ScrollToBottomButton
            label={t("scrollToBottom")}
            onClick={scrollToLatest}
            className="lg:bottom-20"
          />
        ) : null
      }
    >
      <div
        aria-busy={listLoading}
        className="mx-auto w-full max-w-[calc(760px+2*var(--note-gutter))] px-[var(--note-gutter)] pt-10 pb-36"
      >
        {header ? (
          <header>
            <h2 className="text-[28px] font-medium leading-[38px] tracking-[-0.4px] text-[var(--el-ink)]">
              {header.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <HeaderChip icon={Calendar}>
                <time dateTime={header.whenIso}>{header.whenLabel}</time>
              </HeaderChip>
              {header.participantCount > 0 ? (
                <HeaderChip icon={Users}>
                  {t("participants", { count: header.participantCount })}
                </HeaderChip>
              ) : null}
              {header.projectName ? (
                <HeaderChip icon={Folder}>{header.projectName}</HeaderChip>
              ) : null}
            </div>
          </header>
        ) : listLoading ? (
          <header aria-label={t("headerLoading")}>
            <div aria-hidden="true">
              <Skeleton className="h-[38px] w-2/3 max-w-80 motion-reduce:animate-none" />
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Skeleton className="h-7 w-40 motion-reduce:animate-none" />
                <Skeleton className="h-7 w-14 motion-reduce:animate-none" />
                <Skeleton className="h-7 w-20 motion-reduce:animate-none" />
              </div>
            </div>
          </header>
        ) : null}

        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--el-hairline-soft)] pb-2.5",
            header || listLoading ? "mt-8" : null
          )}
        >
          <div
            role="group"
            aria-label={t("filter.label")}
            className="flex flex-wrap items-center gap-0.5"
          >
            {TIMELINE_FILTERS.map((option) => {
              const active = option === filter;
              const count = timeline.counts[option];
              const label = t(`filter.${option}`);
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  aria-label={settled ? `${label} ${count}` : label}
                  onClick={() =>
                    setView((current) => ({ ...current, filter: option }))
                  }
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-[7px] px-[9px] text-[13px] transition-colors",
                    active
                      ? "bg-[var(--el-surface-strong)] font-medium text-[var(--el-ink)]"
                      : "text-[var(--el-muted)] hover:bg-[var(--el-canvas-soft)] hover:text-[var(--el-ink)]"
                  )}
                >
                  {label}
                  <span className="text-[12px] font-normal tabular-nums text-[var(--el-muted-soft)]">
                    {settled ? count : "–"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            <p className="text-[12px] text-[var(--el-muted-soft)]">{hint}</p>
            {header ? (
              <CopyMarkdownButton
                kind="timeline"
                iconOnly
                disabled={!settled || context.failed}
                build={(doc) =>
                  timelineToMarkdown(
                    {
                      title: header.title,
                      whenIso: header.whenIso,
                      participantCount: header.participantCount,
                      participantNames: participants
                        .map((person) => person.name)
                        .filter((name): name is string => Boolean(name)),
                    },
                    minutesTimeline(
                      selectTimeline(
                        context.state,
                        "ALL",
                        agendaList && placement
                          ? { list: agendaList, placement }
                          : null
                      ).groups,
                      doc
                    ),
                    doc
                  )
                }
              />
            ) : null}
          </div>
        </div>

        {settled && context.state.needsRefetch ? (
          <div
            role="status"
            className="mt-4 flex items-center justify-between gap-3 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-3.5 py-2.5 text-[13px] text-[var(--el-body)]"
          >
            <span>{t("resync.message")}</span>
            <button
              type="button"
              onClick={context.retry}
              className="shrink-0 text-[13px] font-medium text-[var(--el-ink)] underline decoration-[var(--el-hairline-strong)] underline-offset-[3px]"
            >
              {t("resync.action")}
            </button>
          </div>
        ) : null}

        {view.open.size > 0 && transcriptQuery.isError ? (
          <InlineRetry
            className="mt-4"
            variant="line"
            label={t("citationSpeakersFailed")}
            onRetry={() => void transcriptQuery.refetch()}
          />
        ) : null}

        {listLoading ? (
          <ul aria-label={t("loading")} className="mt-7 flex flex-col">
            {[0, 1, 2, 3, 4].map((row) => (
              <li
                key={row}
                aria-hidden="true"
                className={cn(TIMELINE_ROW_GRID, "py-3")}
              >
                <Skeleton className="mt-1.5 ml-auto h-3 w-9 motion-reduce:animate-none" />
                <span className="flex justify-center">
                  <Skeleton className="mt-1.5 size-2.5 rounded-full motion-reduce:animate-none" />
                </span>
                <span className="flex flex-col gap-1.5">
                  <Skeleton
                    className={cn(
                      "h-[18px] motion-reduce:animate-none",
                      row % 2 ? "w-[70%]" : "w-[90%]"
                    )}
                  />
                  {row % 2 === 0 ? (
                    <Skeleton className="h-[18px] w-1/2 motion-reduce:animate-none" />
                  ) : null}
                  <Skeleton className="h-3.5 w-24 motion-reduce:animate-none" />
                </span>
              </li>
            ))}
          </ul>
        ) : context.failed ? (
          <InlineRetry
            className="mt-7"
            label={t("loadFailed")}
            onRetry={context.retry}
          />
        ) : null}
        {!listLoading && !context.failed && agendasFailed ? (
          <InlineRetry
            variant="line"
            className="mt-7"
            label={agendaList ? t("agendasRefreshFailed") : t("agendasFailed")}
            onRetry={() => void agendasQuery.refetch()}
          />
        ) : null}
        {listLoading || context.failed ? null : timeline.groups.length === 0 ? (
          <p className="mt-7 text-[14px] leading-relaxed text-[var(--el-muted)]">
            {timeline.counts.ALL === 0
              ? meetingEnded
                ? t("empty.ended")
                : t("empty.live")
              : t("empty.filtered")}
          </p>
        ) : (
          timeline.groups.map((group) => {
            const key = group.key;
            const folded =
              !!group.agenda && view.foldByDefault !== view.flipped.has(key);
            const listId = `timeline-group-${key}`;
            return (
              <section key={key} id={groupId(key)} className="mt-7 scroll-mt-4">
                {group.agenda ? (
                  <h3 className="-mx-2 grid w-[calc(100%+16px)] grid-cols-[auto_minmax(0,1fr)] items-center gap-0.5 sm:flex sm:h-[30px]">
                    {group.agenda.citation ? (
                      <button
                        type="button"
                        aria-label={t("jumpToTranscript", {
                          time: formatOffset(group.agenda.citation.startedAtMs),
                        })}
                        onClick={() =>
                          onEvidenceSelect(group.agenda!.citation!.segmentId)
                        }
                        className="h-[30px] shrink-0 rounded-[7px] px-2 text-[12px] tabular-nums text-[var(--el-muted-soft)] transition-colors hover:bg-[var(--el-canvas-soft)] hover:text-[var(--el-ink)]"
                      >
                        {groupRange(group, recording, t)}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-expanded={!folded}
                      aria-controls={listId}
                      onClick={() => toggle("flipped", key)}
                      className={cn(
                        "flex h-[30px] min-w-0 flex-1 items-center gap-2.5 rounded-[7px] pr-2 text-left transition-colors hover:bg-[var(--el-canvas-soft)]",
                        group.agenda.citation ? "pl-1" : "pl-2"
                      )}
                    >
                      <span
                        className={cn(
                          "min-w-0 truncate text-[15px] font-semibold text-[var(--el-ink)]",
                          group.agenda.retracted &&
                            "text-[var(--el-muted-soft)] line-through"
                        )}
                      >
                        {key === focusKey && focusMark ? (
                          <span {...focusMark.props}>{group.agenda.title}</span>
                        ) : key === priorMark?.key && priorPen ? (
                          <span key={priorMark.nonce} {...priorPen.props}>
                            {group.agenda.title}
                          </span>
                        ) : (
                          group.agenda.title
                        )}
                      </span>
                      {group.previous ? (
                        <span className="shrink-0 text-xs font-normal text-[var(--el-muted)]">
                          {t("continued")}
                        </span>
                      ) : null}
                      {group.agenda.retracted ? (
                        <span className="shrink-0 text-[12px] font-medium text-[var(--el-error-strong)]">
                          {t("agendaRetracted")}
                        </span>
                      ) : null}
                      <span className="-ml-1 shrink-0 text-[12.5px] tabular-nums text-[var(--el-muted-soft)]">
                        {group.total}
                      </span>
                      <ChevronRight
                        aria-hidden
                        className={cn(
                          "-ml-1.5 size-3.5 shrink-0 text-[var(--el-muted-soft)] transition-transform duration-200 motion-reduce:transition-none",
                          !folded && "rotate-90"
                        )}
                      />
                      <span className="flex-1" />
                      {group.last && recording ? (
                        <LiveChip label={t("live")} />
                      ) : null}
                    </button>
                    {group.previous ? (
                      <button
                        type="button"
                        aria-label={
                          group.previous.startMs === null
                            ? t("previous.aria", { title: group.agenda.title })
                            : t("previous.ariaAt", {
                                title: group.agenda.title,
                                time: formatOffset(group.previous.startMs),
                              })
                        }
                        onClick={() => jumpToPrior(group.previous!.key)}
                        className={cn(
                          "h-[26px] shrink-0 justify-self-start rounded-[7px] px-2 text-xs text-[var(--el-muted)] underline decoration-[var(--el-hairline-strong)] underline-offset-2 hover:text-[var(--el-ink)] sm:h-full",
                          group.agenda.citation ? "col-start-2" : "col-start-1"
                        )}
                      >
                        {t("previous.button")}
                        {group.previous.startMs === null
                          ? ""
                          : ` ${formatOffset(group.previous.startMs)}`}
                      </button>
                    ) : null}
                  </h3>
                ) : null}
                <AnimatePresence initial={false}>
                  {folded ? null : (
                    <motion.div
                      key="items"
                      className="overflow-hidden"
                      initial={view.instant ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        duration: reducedMotion || view.instant ? 0 : 0.2,
                        ease: [0.2, 0, 0, 1],
                      }}
                    >
                      <ol id={listId} className="relative mt-1.5">
                        <span
                          aria-hidden
                          className="absolute top-4 bottom-4 left-[75px] w-px bg-[var(--el-hairline)]"
                        />
                        <AnimatePresence initial={false}>
                          {group.items.map((item) => (
                            <TimelineRow
                              key={item.proposal.proposalId}
                              item={item}
                              citationSpeakers={citationSpeakers}
                              open={view.open.has(item.proposal.proposalId)}
                              onToggle={() =>
                                toggle("open", item.proposal.proposalId)
                              }
                              onEvidenceSelect={onEvidenceSelect}
                              onJump={jumpTo}
                            />
                          ))}
                        </AnimatePresence>
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })
        )}

        {partial ? (
          <div
            aria-live="polite"
            aria-atomic="true"
            className={cn(
              TIMELINE_ROW_GRID,
              "mt-[18px] border-t border-dashed border-[var(--el-hairline)] pt-4"
            )}
          >
            <span />
            <span className="flex justify-center pt-[9px]">
              <span className="size-1.5 rounded-full bg-red-500" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[15px] leading-6 text-[var(--el-muted-soft)]">
                {partial.confirmedText ? (
                  <span className="text-[var(--el-muted)]">
                    {partial.confirmedText}
                  </span>
                ) : null}
                {partial.pendingText}
              </span>
              <span className="text-[12.5px] leading-[19px] text-[var(--el-muted)]">
                {t("transcribing")}
              </span>
            </span>
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}

function HeaderChip({
  icon: Icon,
  children,
}: {
  icon: typeof Calendar;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 rounded-[8px] border border-[var(--el-hairline)] px-[9px] text-[12.5px] text-[var(--el-body)]">
      <Icon aria-hidden className="size-[13px] text-[var(--el-muted)]" />
      {children}
    </span>
  );
}

function TimelineRow({
  item,
  citationSpeakers,
  open,
  onToggle,
  onEvidenceSelect,
  onJump,
}: {
  item: TimelineItem;
  citationSpeakers: ReadonlyMap<string, SpeakerIdentity | null>;
  open: boolean;
  onToggle: () => void;
  onEvidenceSelect: (segmentId: string) => void;
  onJump: (proposal: ProposalHead) => void;
}) {
  const t = useTranslations("notes.timeline");
  const tNotes = useTranslations("notes");
  const { proposal, tone } = item;
  const reduced = useReducedMotion();
  const [opened, setOpened] = useState(open);
  const [expanded, setExpanded] = useState(open);
  if (open && !opened) setOpened(true);
  if (!open && expanded) setExpanded(false);
  const visible = open && (reduced || expanded);
  const transition = { duration: reduced ? 0 : 0.2, ease: "easeOut" as const };
  const retracted = proposal.closeReason === "RETRACTED";
  const first = proposal.citations[0];
  const relations = [
    ...item.answers.map((answer) => ({
      lead: t("relation.answer"),
      proposal: answer,
    })),
    ...(item.answersTo
      ? [{ lead: t("relation.answeredQuestion"), proposal: item.answersTo }]
      : []),
  ];
  const expandable = proposal.citations.length > 0 || relations.length > 0;
  const detailsId = `${itemId(proposal.proposalId)}-details`;
  const meta = metaOf(item, t);

  return (
    <motion.li
      id={itemId(proposal.proposalId)}
      className="relative"
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.18, ease: "easeOut" }}
    >
      <article className={cn(TIMELINE_ROW_GRID, "py-[7px]")}>
        {first ? (
          <button
            type="button"
            aria-label={t("jumpToTranscript", {
              time: formatOffset(first.startedAtMs),
            })}
            onClick={() => onEvidenceSelect(first.segmentId)}
            className="self-start whitespace-nowrap text-right text-[12px] leading-6 tabular-nums text-[var(--el-muted-soft)] transition-colors hover:text-[var(--el-ink)]"
          >
            {formatOffset(first.startedAtMs)}
          </button>
        ) : (
          <span />
        )}
        <span className="flex justify-center pt-1">
          <span className="inline-flex rounded-full bg-white">
            <TimelineToneIcon tone={tone} retracted={retracted} />
          </span>
        </span>
        <div className="min-w-0">
          <button
            type="button"
            disabled={!expandable}
            aria-expanded={expandable ? open : undefined}
            aria-controls={expandable ? detailsId : undefined}
            onClick={onToggle}
            className={cn(
              "group/row -ml-2 grid w-[calc(100%+8px)] grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 rounded-[7px] px-2 text-left transition-colors",
              expandable ? "hover:bg-[var(--el-canvas-soft)]" : "cursor-default"
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "text-[15px] leading-6",
                  retracted
                    ? "text-[var(--el-muted-soft)] line-through decoration-[var(--el-muted-soft)]"
                    : TONE_TITLE[tone]
                )}
              >
                {proposal.content}
              </span>
              <span className="text-[12.5px] leading-[19px] text-[var(--el-muted)]">
                <span className={TONE_TEXT[tone]}>
                  {tNotes(`kinds.${proposal.kind}`)}
                </span>
                {meta.map((part) => (
                  <span key={part.text}>
                    <span
                      aria-hidden
                      className="mx-1.5 text-[var(--el-hairline-strong)]"
                    >
                      ·
                    </span>
                    <span
                      className={
                        part.tone === "error"
                          ? "font-medium text-[var(--el-error-strong)]"
                          : undefined
                      }
                    >
                      {part.text}
                    </span>
                  </span>
                ))}
              </span>
            </span>
            {expandable ? (
              <MotionChevronDown
                aria-hidden
                initial={false}
                animate={{ rotate: open ? 180 : 0 }}
                transition={transition}
                className="mt-1 size-4 text-[var(--el-hairline-strong)] group-hover/row:text-[var(--el-muted)]"
              />
            ) : null}
          </button>

          {expandable ? (
            <motion.div
              id={detailsId}
              initial={false}
              animate={{ gridTemplateRows: open ? "1fr" : "0fr" }}
              onAnimationComplete={(target) => {
                if (
                  open &&
                  typeof target === "object" &&
                  "gridTemplateRows" in target &&
                  target.gridTemplateRows === "1fr"
                )
                  setExpanded(true);
              }}
              transition={transition}
              aria-hidden={!open}
              inert={!open}
              className="grid"
            >
              <div className="min-h-0 overflow-hidden">
                {opened ? (
                  <div className="mt-2.5 overflow-hidden rounded-[10px] border border-[var(--el-hairline)]">
                    <motion.div
                      initial={false}
                      animate={{ opacity: visible ? 1 : 0 }}
                      transition={{ duration: reduced || !visible ? 0 : 0.12 }}
                      aria-hidden={!visible}
                      inert={!visible}
                    >
                      {proposal.citations.length > 0 ? (
                        <ul className="flex flex-col gap-0.5 px-2 py-2">
                          {proposal.citations.map((citation) => (
                            <li key={`${citation.segmentId}-${citation.role}`}>
                              <button
                                type="button"
                                onClick={() =>
                                  onEvidenceSelect(citation.segmentId)
                                }
                                className="grid w-full grid-cols-[52px_minmax(0,1fr)] gap-x-2.5 rounded-[7px] px-1.5 py-1 text-left transition-colors hover:bg-[var(--el-canvas-soft)]"
                              >
                                <time className="whitespace-nowrap text-[12px] leading-[22px] tabular-nums text-[var(--el-muted-soft)]">
                                  {formatOffset(citation.startedAtMs)}
                                </time>
                                <span className="flex min-w-0 flex-col gap-1">
                                  {citationSpeakers.get(citation.segmentId) ? (
                                    <SpeakerChip
                                      identity={
                                        citationSpeakers.get(
                                          citation.segmentId
                                        )!
                                      }
                                    />
                                  ) : null}
                                  <span className="text-[14px] leading-[22px] text-[var(--el-body-strong)]">
                                    {citation.text}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {relations.map((relation) => {
                        const at = relation.proposal.citations[0]?.startedAtMs;
                        return (
                          <button
                            key={`${relation.lead}-${relation.proposal.proposalId}`}
                            type="button"
                            onClick={() => onJump(relation.proposal)}
                            className={cn(
                              "flex w-full items-center gap-2 bg-[var(--el-canvas-soft)] px-3.5 py-[9px] text-left text-[13px] leading-5 text-[var(--el-muted)] transition-colors hover:text-[var(--el-ink)]",
                              proposal.citations.length > 0 &&
                                "border-t border-[var(--el-hairline-soft)]"
                            )}
                          >
                            <ArrowUpRight
                              aria-hidden
                              className="size-[13px] shrink-0"
                            />
                            <span className="shrink-0">{relation.lead}</span>
                            <span className="min-w-0 truncate text-[var(--el-ink)]">
                              {relation.proposal.content}
                            </span>
                            <span className="flex-1" />
                            {at !== undefined ? (
                              <span className="shrink-0 tabular-nums text-[var(--el-muted-soft)]">
                                {formatOffset(at)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </motion.div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </div>
      </article>
    </motion.li>
  );
}
