"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowLeft,
  Expand,
  MoreHorizontal,
  PanelRight,
  Shrink,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";

import { useLocale, useTranslations } from "next-intl";

import { useAuth } from "@/components/auth/auth-provider";
import { usePersonalChat } from "@/components/chat/personal-chat";
import {
  MeetingControls,
  MeetingStatusChip,
} from "@/components/notes/meeting-controls";
import { NoteArchive } from "@/components/notes/note-archive";
import { useNoteRealtime } from "@/components/notes/note-realtime-provider";
import {
  NoteDetails,
  NoteDetailsSkeleton,
} from "@/components/notes/note-details";
import { NoteStatusBand } from "@/components/notes/note-status-band";
import { NoteDeleteDialog } from "@/components/notes/note-delete-dialog";
import {
  claimEndFeedback,
  END_FEEDBACK_DELAY_MS,
  MeetingEndFeedback,
} from "@/components/notes/meeting-end-feedback";
import { NoteAgentRail } from "@/components/notes/note-agent-rail";
import { NoteTimeline } from "@/components/notes/note-timeline";
import {
  graduateTimelineHint,
  TimelineHint,
  timelineHintEligible,
} from "@/components/notes/timeline-hint";
import { NoteParticipantAvatars } from "@/components/notes/note-participants";
import { ReviewBoardSkeleton } from "@/components/notes/review/review-board";
import { ReviewTab } from "@/components/notes/review/review-tab";
import { TranscriptView } from "@/components/notes/transcript-view";
import { RecordingDock } from "@/components/transcription/recording-dock";
import { RecordingConnectionNotice } from "@/components/transcription/recording-connection-notice";
import { RecordingDegradedNotice } from "@/components/transcription/recording-degraded-notice";
import {
  isNoteRecordingActive,
  useRecording,
} from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineRetry } from "@/components/ui/inline-retry";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetNote } from "@/lib/api/generated/notes/notes";
import { useGetNoteTranscript } from "@/lib/api/generated/transcription/transcription";
import { deriveMeetingPhase } from "@/lib/notes/meeting-state";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";
import { buildNoteHeaderMeta } from "@/lib/notes/note-header-meta";
import { toNoteMeta } from "@/lib/notes/copy-markdown";
import {
  forgetNoteRecordings,
  RECORDING_BEAT_MS,
  recordingClaimOf,
} from "@/lib/transcription/recorder-lease";
import { track } from "@/lib/analytics/track";
import { useDesktopApp } from "@/lib/desktop/use-desktop-app";
import { errorCodeOf } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { useIsWorkspaceAdmin } from "@/lib/workspace/use-is-workspace-admin";
import { localePath } from "@/lib/i18n/locales";

const NOTE_GONE_CODES = new Set(["NOTE_NOT_FOUND", "PROJECT_NOT_FOUND"]);

export type NoteTab = "context" | "details" | "transcript" | "summary";

const TAB_ITEM =
  // 덮을 때는 기본값과 같은 variant 셀렉터로 써야 한다 — 평범한 `after:bottom-0` 은 tailwind-merge 가 충돌로 보지 않아 조용히 무시된다.
  "h-14 flex-none px-0 text-xs group-data-horizontal/tabs:after:bottom-0";

function subscribeRecordingClaims(notify: () => void) {
  const timer = window.setInterval(notify, RECORDING_BEAT_MS);
  window.addEventListener("storage", notify);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("storage", notify);
  };
}

export function NotePanel({
  workspaceId,
  noteId,
  view,
  tab,
  onTabChange,
  onClose,
  onExpand,
  onCollapse,
  onDeleted,
  linkedSegmentId = null,
  fromMail = false,
}: {
  workspaceId: string;
  noteId: string;
  view: "side" | "full";
  tab: NoteTab;
  onTabChange: (tab: NoteTab, options?: { push?: boolean }) => void;
  onClose: () => void;
  onExpand?: () => void;
  onCollapse?: () => void;
  onDeleted?: () => void;
  linkedSegmentId?: string | null;
  fromMail?: boolean;
}) {
  const t = useTranslations("notes.panel");
  const tActions = useTranslations("common.actions");
  const tDates = useTranslations("dates");
  const dateLocale = useDisplayLocale();
  const locale = useLocale();
  const noteRealtime = useNoteRealtime();
  const noteQuery = useGetNote(noteId);
  const isDesktopApp = useDesktopApp();
  const note =
    noteQuery.data?.status === 200 && noteQuery.data.data.success
      ? noteQuery.data.data.data
      : undefined;
  const phase = deriveMeetingPhase(note);
  const timelineItemCount = noteRealtime.context.cards.length;
  const timelineHintOpen = timelineHintEligible({
    phase,
    tab,
    itemCount: timelineItemCount,
  });
  const noteMeta = useMemo(() => (note ? toNoteMeta(note) : null), [note]);
  const { user } = useAuth();
  const isStarter = Boolean(
    user && note?.meetingStartedBy?.userId === user.userId
  );
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const canDelete = useIsWorkspaceAdmin(workspaceId);
  const [endFeedback, setEndFeedback] = useState<{
    noteId: string;
    round: number;
    phase: "pending" | "open" | "closed";
  } | null>(null);
  const meetingEnded = () => {
    onTabChange("summary");
    if (claimEndFeedback(user?.userId, note?.recordedDurationMs ?? 0))
      setEndFeedback({ noteId, round: Date.now(), phase: "pending" });
  };
  if (endFeedback !== null && endFeedback.noteId !== noteId) {
    setEndFeedback(null);
  }
  useEffect(() => {
    if (endFeedback?.phase !== "pending") return;
    const timer = setTimeout(
      () =>
        setEndFeedback((prev) =>
          prev?.round === endFeedback.round ? { ...prev, phase: "open" } : prev
        ),
      END_FEEDBACK_DELAY_MS
    );
    return () => clearTimeout(timer);
  }, [endFeedback]);
  if (deleteTargetId !== null && deleteTargetId !== noteId) {
    setDeleteTargetId(null);
  }
  const noteLoadFailed = noteQuery.isError && !note;
  const noteGone =
    noteLoadFailed && NOTE_GONE_CODES.has(errorCodeOf(noteQuery.error) ?? "");
  const showAgentRail = view === "full" && !noteLoadFailed;
  const [agentRail, setAgentRail] = useState<boolean | null>(null);
  const { isTurnActive: personalTurnActive } = usePersonalChat();
  const turnActive = personalTurnActive;
  const railFoldedOnNarrow = agentRail === null && !personalTurnActive;
  const showContextTab =
    !noteLoadFailed &&
    (view === "full" || phase !== "not-started" || tab === "context");
  const showSummaryTab =
    view === "full" ||
    (view === "side" &&
      !noteLoadFailed &&
      (phase === "ended" || (phase === "unknown" && tab === "summary")));
  const [archiveState, setArchiveState] = useState({
    noteId,
    phase,
    visible: phase === "ended",
  });
  if (archiveState.noteId !== noteId || archiveState.phase !== phase) {
    const viewerEndTransition =
      archiveState.noteId === noteId &&
      archiveState.phase === "active" &&
      phase === "ended" &&
      !isStarter;
    setArchiveState({
      noteId,
      phase,
      visible: phase === "ended" && !viewerEndTransition,
    });
  }
  const showViewerEndNotice =
    phase === "ended" && !isStarter && !archiveState.visible;
  const showArchive = phase === "ended" && archiveState.visible;

  const [focusSegmentId, setFocusSegmentId] = useState<string | null>(
    linkedSegmentId
  );
  const [linkSeen, setLinkSeen] = useState({ noteId, linkedSegmentId });
  if (
    linkSeen.noteId !== noteId ||
    linkSeen.linkedSegmentId !== linkedSegmentId
  ) {
    setLinkSeen({ noteId, linkedSegmentId });
    if (linkSeen.noteId !== noteId) setFocusSegmentId(linkedSegmentId);
    else if (linkedSegmentId) setFocusSegmentId(linkedSegmentId);
  }
  const [participantsRequest, setParticipantsRequest] = useState<{
    noteId: string;
    arrived: boolean;
  } | null>(null);
  if (participantsRequest) {
    if (participantsRequest.noteId !== noteId) {
      setParticipantsRequest(null);
    } else if (tab === "details" && !participantsRequest.arrived) {
      setParticipantsRequest({ ...participantsRequest, arrived: true });
    } else if (tab !== "details" && participantsRequest.arrived) {
      setParticipantsRequest(null);
    }
  }
  const closeParticipantsRequest = useCallback(
    () => setParticipantsRequest(null),
    []
  );
  const [timelineFocus, setTimelineFocus] = useState<{
    noteId: string;
    agendaId: string;
  } | null>(null);
  const clearTimelineFocus = useCallback(() => setTimelineFocus(null), []);
  const handleTabChange = useCallback(
    (next: NoteTab) => {
      if (next !== tab) {
        track("note_tab_opened", { workspace_id: workspaceId, tab: next });
      }
      setFocusSegmentId(null);
      setTimelineFocus(null);
      setParticipantsRequest(null);
      onTabChange(next);
    },
    [onTabChange, tab, workspaceId]
  );
  const editParticipants = useCallback(() => {
    setFocusSegmentId(null);
    onTabChange("details");
    setParticipantsRequest({ noteId, arrived: false });
  }, [noteId, onTabChange]);
  const jumpToSegment = useCallback(
    (segmentId: string) => {
      onTabChange("transcript", { push: true });
      setFocusSegmentId(segmentId);
    },
    [onTabChange]
  );
  const clearFocusSegment = useCallback(() => setFocusSegmentId(null), []);
  const recording = useRecording();
  const recordingNoteLive = isNoteRecordingActive(recording, noteId);
  const localProviderCanControlNote =
    recordingNoteLive &&
    !(recording.phase === "failed" && recording.session?.status === "ACTIVE");
  const finishedHere =
    recording.activeNoteId === noteId &&
    recording.session?.noteId === noteId &&
    ((recording.phase === "completed" &&
      recording.session.status === "COMPLETED" &&
      note?.activeSessionStartedAt === recording.session.startedAt) ||
      (recording.phase === "failed" &&
        recording.session.status === "INTERRUPTED"));
  const recordingHere = recording.activeNoteId === noteId;
  const recordingDegraded = recordingHere && recording.transcriptionDegraded;

  const showDock = Boolean(
    note &&
    (note.meetingStatus === "NOT_STARTED" ||
      note.meetingStatus === "IN_PROGRESS" ||
      note.meetingStatus === "PAUSED")
  );
  const noteNotInThisWorkspace =
    note !== undefined && note.workspaceId !== workspaceId;
  const confirmedWorkspaceId = noteNotInThisWorkspace
    ? undefined
    : note?.workspaceId;
  const recordingClaim = useSyncExternalStore(
    subscribeRecordingClaims,
    () => recordingClaimOf(noteId),
    () => null
  );
  const meetingNotRecording =
    note !== undefined && note.meetingStatus !== "IN_PROGRESS";
  useEffect(() => {
    if (meetingNotRecording && !recordingNoteLive && recordingClaim) {
      forgetNoteRecordings(noteId);
    }
  }, [meetingNotRecording, recordingNoteLive, recordingClaim, noteId]);
  const startBlockedReason = noteNotInThisWorkspace
    ? t("startBlocked.otherWorkspace")
    : note?.meetingStatus === "IN_PROGRESS" &&
        !localProviderCanControlNote &&
        !finishedHere &&
        recordingClaim !== "mine" &&
        recordingClaim !== "dead"
      ? t("startBlocked.otherDevice")
      : null;
  const startLabel =
    note?.meetingStatus === "PAUSED" ? t("resume") : t("start");

  const isFull = view === "full";
  const paneChrome = isFull
    ? "rounded-panel border border-[var(--el-hairline)] shadow-e2"
    : "";
  const headerTranscriptQuery = useGetNoteTranscript(noteId, {
    query: { enabled: phase === "paused" || phase === "ended" },
  });
  const headerTranscript =
    headerTranscriptQuery.data?.status === 200 &&
    headerTranscriptQuery.data.data.success
      ? headerTranscriptQuery.data.data.data
      : null;
  const meta = note
    ? buildNoteHeaderMeta(note, {
        isStarter,
        transcript: headerTranscript,
        locale: dateLocale,
        t: tDates,
      })
    : null;
  const canEndMeeting =
    note?.meetingStatus === "IN_PROGRESS" || note?.meetingStatus === "PAUSED";

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col max-lg:landscape:flex-row lg:flex-row",
        isFull ? "lg:gap-2.5 lg:bg-transparent" : "bg-white"
      )}
    >
      <div
        className={cn(
          // `hidden` 이 아니라 `clip` 이다. `hidden` 은 스크롤 컨테이너라 `scrollIntoView` 가 이 면을 굴려 상단바가 잘려 나간다.
          "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-clip bg-white",
          "[--note-gutter:20px] sm:[--note-gutter:36px]",
          isFull ? "lg:[--note-gutter:64px]" : "lg:[--note-gutter:100px]",
          paneChrome
        )}
      >
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (!value) return;
            if (value === "context") graduateTimelineHint();
            handleTabChange(value as NoteTab);
          }}
          className="min-h-0 flex-1 gap-0"
        >

          <div
            data-slot="note-top-bar"
            className="@container/topbar flex shrink-0 flex-wrap items-center gap-x-3 border-b border-[var(--el-hairline)] px-4 sm:h-14 sm:flex-nowrap sm:px-8"
          >
            <div className="flex h-14 min-w-0 flex-1 items-center gap-2">
              <div
                role="group"
                aria-label={t("windowControls")}
                className="flex shrink-0 items-center gap-2"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-control text-[var(--el-muted)]"
                  aria-label={t("backToList")}
                  onClick={onClose}
                >
                  <ArrowLeft />
                </Button>
                {onExpand ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-control text-[var(--el-muted)]"
                    aria-label={
                      turnActive ? t("expandBusy") : t("expand")
                    }
                    disabled={turnActive}
                    onClick={onExpand}
                  >
                    <Expand />
                  </Button>
                ) : null}
                {onCollapse ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-control text-[var(--el-muted)]"
                    aria-label={
                      turnActive ? t("collapseBusy") : t("collapse")
                    }
                    disabled={turnActive}
                    onClick={onCollapse}
                  >
                    <Shrink />
                  </Button>
                ) : null}
              </div>
              <span
                aria-hidden
                className="h-[18px] w-px shrink-0 bg-[var(--el-hairline)]"
              />

              {note ? (
                <MeetingStatusChip status={note.meetingStatus} />
              ) : (
                <span
                  aria-hidden
                  className="flex shrink-0 items-center gap-1.5"
                >
                  <Skeleton className="size-1.5 rounded-full" />
                  <Skeleton className="h-3 w-[27px] rounded-chip" />
                </span>
              )}
              {note ? (
                <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--el-ink)]">
                  {note.title}
                </span>
              ) : (
                <Skeleton
                  aria-label={t("loading")}
                  className="h-3.5 w-40 max-w-full rounded-chip"
                />
              )}
            </div>

            {/* 높이는 `group-data-horizontal/tabs:h-14` 처럼 같은 variant 셀렉터로 덮는다 — 평범한 `h-14` 는 tailwind-merge 가 조용히 무시한다. */}
            <TabsList
              variant="line"
              className="shrink-0 gap-5 group-data-horizontal/tabs:h-14 max-sm:order-last max-sm:w-full max-sm:justify-start max-sm:group-data-horizontal/tabs:h-11"
            >
              <TabsTrigger value="details" className={TAB_ITEM}>
                {t("tabs.details")}
              </TabsTrigger>
              <TabsTrigger value="transcript" className={TAB_ITEM}>
                {t("tabs.transcript")}
              </TabsTrigger>
              {showContextTab ? (
                <span className="relative flex">
                  <TabsTrigger value="context" className={TAB_ITEM}>
                    {t("tabs.timeline")}
                  </TabsTrigger>
                  <TimelineHint
                    noteId={noteId}
                    workspaceId={workspaceId}
                    eligible={timelineHintOpen}
                    role={recordingNoteLive ? "recorder" : "viewer"}
                    onOpen={() => handleTabChange("context")}
                  />
                </span>
              ) : null}
              {showSummaryTab ? (
                <TabsTrigger value="summary" className={TAB_ITEM}>
                  {t("tabs.summary")}
                </TabsTrigger>
              ) : null}
            </TabsList>

            {note && canEndMeeting ? (
              <MeetingControls
                key={noteId}
                note={note}
                onMeetingEnded={meetingEnded}
                onEditParticipants={editParticipants}
              />
            ) : null}
            {note && !canDelete ? null : note ? (
              <div className="flex shrink-0 items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t("menu")}
                        className="rounded-control text-[var(--el-muted)]"
                      />
                    }
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteTargetId(noteId)}
                    >
                      <Trash2 /> {tActions("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <NoteDeleteDialog
                  workspaceId={workspaceId}
                  noteId={noteId}
                  projectId={note.projectId}
                  title={note.title}
                  open={deleteTargetId === noteId}
                  onOpenChange={(open) =>
                    setDeleteTargetId(open ? noteId : null)
                  }
                  onDeleted={onDeleted ?? onClose}
                />
              </div>
            ) : (
              <Skeleton
                aria-hidden
                className="size-8 shrink-0 rounded-control"
              />
            )}
            {showAgentRail && (agentRail === false || railFoldedOnNarrow) ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "shrink-0 rounded-control text-[var(--el-muted)]",
                  railFoldedOnNarrow && "lg:hidden"
                )}
                aria-label={t("openAgent")}
                aria-expanded={false}
                onClick={() => setAgentRail(true)}
              >
                <PanelRight />
              </Button>
            ) : null}
          </div>

          {note ? <NoteStatusBand note={note} fromMail={fromMail} /> : null}

          {tab === "details" && !noteGone ? (
            <header className="relative z-10 shrink-0 border-b border-[var(--el-hairline)] bg-white px-[var(--note-gutter)] pb-5 pt-5">
              <div className="mx-auto flex w-full max-w-[820px] items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {note ? (
                    <span className="flex h-5 w-fit shrink-0 items-center rounded-full border border-[var(--el-hairline)] px-2 text-[11px] font-medium text-[var(--el-body)]">
                      {note.projectName}
                    </span>
                  ) : null}
                  <h1 className="truncate text-2xl font-light leading-[1.2] tracking-[-0.024em] text-[var(--el-ink)] lg:text-screen-title">
                    {note ? (
                      note.title
                    ) : (
                      <Skeleton
                        aria-label={t("titleLoading")}
                        className="h-9 w-64 max-w-full rounded-chip"
                      />
                    )}
                  </h1>
                  {meta ? (
                    <div className="flex min-w-0 items-center gap-2.5">
                      <NoteParticipantAvatars
                        participants={note?.participants}
                        max={4}
                        size="sm"
                        className="-space-x-1.5 *:data-[slot=avatar]:ring-white"
                      />
                      <p className="min-w-0 text-xs leading-[1.5] text-[var(--el-body)]">
                        <span className="block truncate">
                          {meta.participantLabel
                            ? `${meta.participantLabel} · `
                            : null}
                          <time dateTime={meta.whenIso}>{meta.whenLabel}</time>
                        </span>
                        <span className="block truncate">{meta.secondary}</span>
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </header>
          ) : null}

          {noteGone ? (
            <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pb-4 pt-6">
              <div
                role="alert"
                className="rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-4"
              >
                <p className="text-sm font-medium text-[var(--el-ink)]">
                  {t("gone.title")}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--el-muted)]">
                  {t("gone.description")}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-[30px]"
                  onClick={onClose}
                >
                  {t("gone.back")}
                </Button>
              </div>
            </div>
          ) : noteLoadFailed ? (
            <div className="mx-auto w-full max-w-[calc(820px+2*var(--note-gutter))] px-[var(--note-gutter)] pb-4 pt-4">
              <InlineRetry
                label={t("statusLoadFailed")}
                onRetry={() => void noteQuery.refetch()}
              />
            </div>
          ) : null}
          {noteRealtime.reconnecting ? (
            <div
              role="status"
              className="mx-[var(--note-gutter)] mt-3 flex shrink-0 items-center gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3 text-sm text-[var(--el-body)]"
            >
              <WifiOff className="size-4 shrink-0 text-amber-600" />
              <span>{t("reconnecting")}</span>
            </div>
          ) : null}
          {noteRealtime.subscriptionIssue ? (
            <div
              role="alert"
              className="mx-[var(--note-gutter)] mt-3 flex shrink-0 items-center justify-between gap-3 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3 text-sm text-[var(--el-body)]"
            >
              <span>
                {noteRealtime.subscriptionIssue === "ALREADY_SUBSCRIBED"
                  ? t("subscription.alreadySubscribed")
                  : noteRealtime.subscriptionIssue === "UNAVAILABLE"
                    ? t("subscription.unavailable")
                    : t("subscription.full")}
              </span>
              {noteRealtime.subscriptionIssue !== "ALREADY_SUBSCRIBED" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={noteRealtime.retrySubscription}
                >
                  {tActions("retry")}
                </Button>
              ) : null}
            </div>
          ) : null}
          {/* 숨긴 탭은 `display:none` 이라 브라우저가 스크롤 위치를 쥐고 있다가 보일 때 되살린다 — 그래서 내리지 않고 숨긴다(`keepMounted`). */}
          <TabsContent
            value="transcript"
            keepMounted
            className="flex min-h-0 flex-1 flex-col"
          >
            {showViewerEndNotice ? (
              <div
                role="region"
                aria-label={t("viewerEnded.region")}
                className="mx-[var(--note-gutter)] mt-4 flex shrink-0 items-center justify-between gap-4 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--el-ink)]">
                    {t("viewerEnded.title")}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--el-muted)]">
                    {t("viewerEnded.description")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={false}
                  onClick={() =>
                    setArchiveState((current) => ({
                      ...current,
                      visible: true,
                    }))
                  }
                >
                  {t("viewerEnded.action")}
                </Button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1">
              {showArchive ? (
                <NoteArchive
                  workspaceId={confirmedWorkspaceId}
                  key={noteId}
                  noteId={noteId}
                  participants={note?.participants ?? []}
                  noteMeta={noteMeta}
                  focusSegmentId={focusSegmentId}
                  onFocusHandled={clearFocusSegment}
                  active={tab === "transcript"}
                />
              ) : (
                <TranscriptView
                  key={noteId}
                  noteId={noteId}
                  phase={phase}
                  participants={note?.participants ?? []}
                  noteMeta={noteMeta}
                  focusSegmentId={phase === "unknown" ? null : focusSegmentId}
                  onFocusHandled={clearFocusSegment}
                />
              )}
            </div>
          </TabsContent>
          {showContextTab ? (
            <TabsContent value="context" keepMounted className="min-h-0 flex-1">
              <NoteTimeline
                key={noteId}
                participants={note?.participants ?? []}
                header={
                  note && meta
                    ? {
                        title: note.title,
                        whenIso: meta.whenIso,
                        whenLabel: meta.whenLabel,
                        participantCount: note.participants?.length ?? 0,
                        projectName: note.projectName ?? null,
                      }
                    : null
                }
                onEvidenceSelect={jumpToSegment}
                focusAgendaId={
                  timelineFocus?.noteId === noteId
                    ? timelineFocus.agendaId
                    : null
                }
                onFocusHandled={clearTimelineFocus}
                meetingEnded={phase === "ended"}
                recording={phase === "active"}
                active={tab === "context"}
              />
            </TabsContent>
          ) : null}
          {showSummaryTab ? (
            <TabsContent value="summary" keepMounted className="min-h-0 flex-1">
              <ScrollArea key={noteId} className="h-full">
                {phase === "unknown" ? (
                  noteLoadFailed ? null : (
                    <ReviewBoardSkeleton />
                  )
                ) : (
                  <ReviewTab
                    noteId={noteId}
                    workspaceId={confirmedWorkspaceId}
                    projectId={note?.projectId}
                    isEnded={phase === "ended"}
                    noteMeta={noteMeta}
                    participants={note?.participants ?? []}
                    currentUserId={user?.userId}
                    currentUserName={user?.name}
                    dockRaised={showAgentRail && agentRail === false}
                    onEvidenceSelect={jumpToSegment}
                    note={note}
                    onEditParticipants={editParticipants}
                    onMeetingEnded={meetingEnded}
                    onOpenTranscript={() => handleTabChange("transcript")}
                    active={tab === "summary"}
                    onOpenTimeline={
                      showContextTab
                        ? (agendaId) => {
                            handleTabChange("context");
                            if (agendaId)
                              setTimelineFocus({ noteId, agendaId });
                          }
                        : undefined
                    }
                  />
                )}
              </ScrollArea>
            </TabsContent>
          ) : null}
          {noteGone ? null : (
            <TabsContent value="details" className="min-h-0 flex-1">
              <ScrollArea className="h-full">
                <DataBoundary
                  fallback={<NoteDetailsSkeleton />}
                  errorLabel={t("detailsLoadFailed")}
                  resetKeys={[noteId]}
                >
                  <NoteDetails
                    noteId={noteId}
                    workspaceId={confirmedWorkspaceId}
                    autoOpenParticipants={
                      participantsRequest?.noteId === noteId
                    }
                    onParticipantsAutoOpened={closeParticipantsRequest}
                  />
                </DataBoundary>
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>

        {showDock || (showAgentRail && agentRail === false) ? (
          <div
            className={cn(
              "pointer-events-none z-30 flex shrink-0 items-end justify-center gap-2 pb-6 pl-5 pr-[84px] sm:px-9 lg:absolute lg:inset-x-0 lg:bottom-6 lg:pb-0",
              !showDock && "max-lg:hidden"
            )}
          >
            {showDock ? (
              <div className="pointer-events-auto flex min-w-0 max-w-full flex-col items-center gap-2">
                {recordingHere ? (
                  <RecordingConnectionNotice
                    notice={recording.connectionNotice}
                    buffer={recording.buffer}
                    microphone={recording.microphone}
                    systemAudio={recording.systemAudio}
                    finishing={recording.phase === "stopping"}
                  />
                ) : null}
                {recordingDegraded ? <RecordingDegradedNotice /> : null}
                {isDesktopApp === false &&
                note?.meetingStatus === "NOT_STARTED" &&
                !recordingHere ? (
                  <p
                    data-testid="desktop-app-hint"
                    className="relative rounded-full border border-[var(--el-hairline-strong)] bg-white px-3 whitespace-nowrap py-1.5 text-[12px] text-[var(--el-muted)] shadow-e2 animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
                  >
                    {t.rich("desktopHint", {
                      link: (chunks) => (
                        <a
                          href={localePath(locale, "/download")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-sm font-semibold text-[var(--el-ink)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-ink)]"
                        >
                          {chunks}
                        </a>
                      ),
                    })}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -bottom-[6px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 border-r border-b border-[var(--el-hairline-strong)] bg-white"
                    />
                  </p>
                ) : null}
                <RecordingDock
                  noteId={noteId}
                  workspaceId={confirmedWorkspaceId}
                  disabledReason={startBlockedReason}
                  startLabel={startLabel}
                  onStart={() => onTabChange("transcript")}
                />
              </div>
            ) : null}
            {showAgentRail && agentRail === false ? (
              <button
                type="button"
                onClick={() => setAgentRail(true)}
                className="pointer-events-auto flex h-11 w-[300px] shrink-0 items-center gap-2.5 rounded-full border border-[var(--el-hairline)] bg-white/95 pr-4 pl-4 text-left shadow-e2 backdrop-blur max-lg:hidden"
              >
                <Sparkles
                  aria-hidden
                  className="size-[15px] shrink-0 text-[var(--el-muted)]"
                />
                <span className="truncate text-[13.5px] text-[var(--el-muted-soft)]">
                  {t("askAboutMeeting")}
                </span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {showAgentRail ? (
        <div
          data-testid="note-agent-rail"
          className={cn(
            "flex h-[clamp(14rem,36dvh,18rem)] w-full shrink-0 flex-col overflow-hidden bg-white max-lg:landscape:h-full max-lg:landscape:w-[min(22rem,42vw)] lg:h-full lg:w-[440px]",
            paneChrome,
            "max-lg:rounded-none max-lg:border-t max-lg:border-[var(--el-hairline)] max-lg:landscape:border-l max-lg:landscape:border-t-0",
            railFoldedOnNarrow && "max-lg:hidden",
            agentRail === false && "hidden"
          )}
        >
          <NoteAgentRail
            onCollapse={() => setAgentRail(false)}
            collapseDisabled={personalTurnActive}
          />
        </div>
      ) : null}
      {endFeedback ? (
        <MeetingEndFeedback
          key={endFeedback.round}
          noteId={noteId}
          open={endFeedback.phase === "open"}
          onClose={() =>
            setEndFeedback((prev) => prev && { ...prev, phase: "closed" })
          }
        />
      ) : null}
    </div>
  );
}
