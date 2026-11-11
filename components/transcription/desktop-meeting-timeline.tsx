"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  emptyMeetingSelection,
  getMeetingSelection,
  setMeetingSelection,
  subscribeMeetingSelection,
} from "@/lib/desktop/meeting-selection";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DesktopBridge } from "@heymoa/desktop-contracts";
import { useGetNote, useGetNoteAgendas } from "@/lib/api/generated/notes/notes";
import { useLivePartial } from "@/components/notes/use-live-partial";
import {
  placeAgendas,
  samePlacement,
  type AgendaPlacement,
} from "@/lib/notes/proposals/timeline";
import { okData } from "@/lib/api/ok-data";
import { ApiError } from "@/lib/api/fetcher";
import { useGetMeetingReviewSummary } from "@/lib/api/generated/meeting-review/meeting-review";
import { useGetAnalysisFlow } from "@/lib/api/generated/analysis/analysis";
import { flowPollInterval } from "@/lib/notes/review/flow-cache";
import { overviewText, summaryTopics } from "@/lib/notes/review/summary";
import { isMeetingActive } from "@/lib/notes/meeting-state";
import { meetingTimelineSnapshot } from "@/lib/desktop/meeting-timeline";
import {
  NoteRealtimeProvider,
  useNoteRealtime,
} from "@/components/notes/note-realtime-provider";
import { useRecording } from "./recording-provider";

function desktopBridge() {
  return typeof window === "undefined"
    ? undefined
    : (window as unknown as { heymoaDesktop?: DesktopBridge }).heymoaDesktop;
}

/** Mounted inside the note's existing provider. Hidden main windows keep receiving events. */
export function DesktopMeetingTimelineReporter() {
  if (!desktopBridge()?.reportMeetingTimeline) return null;
  return (desktopBridge()?.meetingTimelineVersion ?? 1) >= 2 ? (
    <DetailedMeetingTimelineReporter />
  ) : (
    <MeetingTimelineReporter />
  );
}

const NO_PLACEMENT: AgendaPlacement = new Map();
const deniedNote = (error: unknown) =>
  error instanceof ApiError && [403, 404].includes(error.status);
function DetailedMeetingTimelineReporter() {
  const { noteId, context } = useNoteRealtime();
  const partial = useLivePartial(noteId);
  const selection = useSyncExternalStore(
    subscribeMeetingSelection,
    getMeetingSelection,
    emptyMeetingSelection
  );
  const recording = useRecording();
  const selectionId =
    selection?.noteId === noteId ? selection.requestId : undefined;
  const [validated, setValidated] = useState<{
    noteId: string;
    requestId: number;
  } | null>(null);
  const needsValidation =
    selectionId !== undefined &&
    (validated?.noteId !== noteId || validated.requestId !== selectionId);
  const note = useGetNote(noteId, {
    query: {
      refetchInterval: (query) =>
        deniedNote(query.state.error)
          ? false
          : selectionId !== undefined &&
              (needsValidation || query.state.status === "error")
            ? 3000
            : false,
      refetchIntervalInBackground: true,
    },
  });
  const refreshNote = note.refetch;
  const [validationStarted, setValidationStarted] = useState({
    noteId,
    selectionId,
    at: note.dataUpdatedAt,
  });
  if (
    validationStarted.noteId !== noteId ||
    validationStarted.selectionId !== selectionId
  )
    setValidationStarted({ noteId, selectionId, at: note.dataUpdatedAt });
  useEffect(() => {
    if (selectionId === undefined) return;
    let cancelled = false;
    void refreshNote()
      .then((result) => {
        if (cancelled) return;
        if (!result.isError && okData(result.data))
          setValidated({ noteId, requestId: selectionId });
        else
          void desktopBridge()
            ?.reportMeetingUnavailable?.(
              noteId,
              selectionId,
              !deniedNote(result.error)
            )
            .catch(() => {});
      })
      .catch((error) => {
        if (!cancelled)
          void desktopBridge()
            ?.reportMeetingUnavailable?.(
              noteId,
              selectionId,
              !deniedNote(error)
            )
            .catch(() => {});
      });
    return () => {
      cancelled = true;
    };
  }, [noteId, selectionId, refreshNote]);
  const selected =
    selectionId !== undefined &&
    ((validated?.noteId === noteId && validated.requestId === selectionId) ||
      (!note.isError &&
        Boolean(okData(note.data)) &&
        validationStarted.noteId === noteId &&
        validationStarted.selectionId === selectionId &&
        note.dataUpdatedAt > validationStarted.at));
  const admitted = selected;
  if (
    selected &&
    !(validated?.noteId === noteId && validated.requestId === selectionId)
  )
    setValidated({ noteId, requestId: selectionId! });
  const ended = okData(note.data)?.meetingStatus === "ENDED";
  const flow = useGetAnalysisFlow(noteId, {
    query: {
      enabled: selected && ended,
      refetchInterval: (q) =>
        flowPollInterval(
          okData(q.state.data)?.status ?? null,
          okData(q.state.data)?.regions
        ),
      refetchIntervalInBackground: true,
    },
  });
  const flowData = okData(flow.data);
  const summaryQuery = useGetMeetingReviewSummary(noteId, {
    query: {
      enabled: selected && ended,
      refetchInterval:
        selected && ended
          ? flowPollInterval(flowData?.status ?? null, flowData?.regions)
          : false,
      refetchIntervalInBackground: true,
    },
  });
  const summaryData = okData(summaryQuery.data);
  const refreshSummary = summaryQuery.refetch;
  useEffect(() => {
    if (ended && flowData) void refreshSummary();
  }, [ended, flowData, refreshSummary]);
  const summary = useMemo<
    NonNullable<Parameters<typeof meetingTimelineSnapshot>[5]>["summary"]
  >(
    () => ({
      status: !ended
        ? "unavailable"
        : summaryData?.status === "SUCCEEDED"
          ? "ready"
          : summaryQuery.isError || summaryData?.status === "FAILED"
            ? "failed"
            : summaryQuery.isPending
              ? "loading"
              : flowData &&
                  (["DIARIZING", "ANALYZING"].includes(flowData.status) ||
                    flowData.regions.some(
                      (region) => region.status === "PENDING"
                    ))
                ? "pending"
                : "unavailable",
      lead: summaryData ? overviewText(summaryData).slice(0, 4000) : "",
      sections: summaryTopics(summaryData)
        .slice(0, 20)
        .map((topic) => ({
          id: topic.agendaId ?? `ordinal-${topic.ordinal}`,
          title: topic.title.slice(0, 300),
          description: (
            topic.summary ?? topic.description.map((s) => s.text).join(" ")
          ).slice(0, 4000),
          conclusions: topic.conclusions
            .slice(0, 5)
            .map((s) => s.text.slice(0, 2000)),
          openItems: topic.openItems
            .slice(0, 5)
            .map((s) => s.text.slice(0, 2000)),
        })),
    }),
    [ended, summaryData, summaryQuery.isError, summaryQuery.isPending, flowData]
  );
  const agendas = useGetNoteAgendas(noteId);
  const list = okData(agendas.data);
  const [placed, setPlaced] = useState({ noteId, placement: NO_PLACEMENT });
  const previous = placed.noteId === noteId ? placed.placement : NO_PLACEMENT;
  const placement = useMemo(
    () =>
      list
        ? placeAgendas(
            previous,
            Object.values(context.state.proposals),
            list,
            !ended
          )
        : previous,
    [list, previous, context.state.proposals, ended]
  );
  if (placed.noteId !== noteId || !samePlacement(previous, placement))
    setPlaced({ noteId, placement });
  const detail = useMemo(
    () => ({
      plan: list ? { list, placement } : null,
      partial: ended ? null : partial,
      ended,
      summary,
      workspaceId:
        okData(note.data)?.workspaceId ??
        selection?.workspaceId ??
        recording.activeWorkspaceId ??
        "",
      ownsRecording:
        recording.activeNoteId === noteId &&
        ["recording", "stopping"].includes(recording.phase),
      selectionId,
      meetingState: okData(note.data)?.meetingStatus,
    }),
    [
      list,
      placement,
      partial,
      ended,
      summary,
      note.data,
      selection,
      recording.activeNoteId,
      recording.activeWorkspaceId,
      recording.phase,
      noteId,
      selectionId,
    ]
  );
  return (
    <MeetingTimelineReporter
      detail={detail}
      selected={selected}
      admitted={admitted}
    />
  );
}

function MeetingTimelineReporter({
  detail,
  selected = false,
  admitted = false,
}: {
  detail?: Parameters<typeof meetingTimelineSnapshot>[5];
  selected?: boolean;
  admitted?: boolean;
}) {
  const t = useTranslations("recording.desktopTimeline");
  const tKinds = useTranslations("notes.kinds");
  const { activeNoteId, phase } = useRecording();
  const { noteId, context, reconnecting, subscriptionIssue } =
    useNoteRealtime();
  const note = useGetNote(noteId);
  const bridge = desktopBridge();
  const noteData =
    note.data?.status === 200 && note.data.data.success
      ? note.data.data.data
      : undefined;
  // 내가 녹음하지 않아도 열어 둔 노트의 회의가 진행 중이면 뷰어로 보는 것이다(APP-1092).
  // 내 녹음이 있으면 그쪽이 메뉴 막대를 쓴다.
  // 팝오버에서 「보기 종료」를 누르면 이 노트는 노트를 닫았다 다시 열 때까지 보고하지 않는다(APP-1096).
  const [dismissed, setDismissed] = useState(false);
  const viewing = detail
    ? selected
    : phase !== "recording" && isMeetingActive(noteData) && !dismissed;
  const enabled = Boolean(
    bridge?.reportMeetingTimeline &&
    (detail
      ? admitted
      : (phase === "recording" && noteId === activeNoteId) || viewing) &&
    !note.isError &&
    !(note.data !== undefined && !noteData)
  );
  const title = noteData?.title ?? t("untitled");
  const snapshot = useMemo(
    () =>
      meetingTimelineSnapshot(
        noteId,
        title,
        context.state,
        {
          loading: context.loading,
          failed: context.failed || subscriptionIssue !== null,
          reconnecting,
        },
        (kind) => tKinds(kind),
        detail
      ),
    [
      tKinds,
      noteId,
      title,
      context.state,
      context.loading,
      context.failed,
      subscriptionIssue,
      reconnecting,
      detail,
    ]
  );
  const lastPublishedAt = useRef(0);
  useEffect(() => {
    if (!bridge?.subscribeRecordingActions) return;
    return bridge.subscribeRecordingActions((action) => {
      if (action === "stop-viewing") setDismissed(true);
    });
  }, [bridge]);
  // 목록에서 같은 회의를 다시 고르면 다시 본다. 같은 노트 주소로 가는 이동은 이 화면을 다시
  // 만들지 않아 끝낸 상태가 남는다.
  useEffect(() => {
    if (!bridge?.subscribeOpenNote) return;
    return bridge.subscribeOpenNote((target) => {
      if (target.noteId === noteId) setDismissed(false);
    });
  }, [bridge, noteId]);
  // 노트를 닫거나 회의가 끝나거나 보기를 끝내면 메뉴 막대에서 지운다.
  useEffect(() => {
    if (detail || !viewing || !bridge?.reportMeetingTimeline) return;
    return () => void bridge.reportMeetingTimeline!(null).catch(() => {});
  }, [bridge, viewing, detail]);
  useEffect(() => {
    if (detail) {
      if (note.isError)
        void bridge
          ?.reportMeetingUnavailable?.(
            noteId,
            detail.selectionId,
            !deniedNote(note.error)
          )
          .catch(() => {});
      return;
    }
    if (
      (note.isError || (note.data !== undefined && !noteData)) &&
      (detail || noteId === activeNoteId || viewing)
    ) {
      void bridge?.reportMeetingTimeline?.(null).catch(() => {});
    }
  }, [
    bridge,
    note.isError,
    note.error,
    note.data,
    noteData,
    detail,
    noteId,
    activeNoteId,
    viewing,
  ]);
  useEffect(() => {
    if (!enabled || !bridge?.reportMeetingTimeline) return;
    const publish = () => {
      lastPublishedAt.current = performance.now();
      void bridge.reportMeetingTimeline!(snapshot).catch(() => {
        // Native independently marks missing heartbeats as stale.
        console.warn("Desktop meeting timeline could not be reported");
      });
    };
    const delay = detail?.partial
      ? Math.max(0, 250 - (performance.now() - lastPublishedAt.current))
      : 0;
    const queued = delay ? window.setTimeout(publish, delay) : null;
    if (!delay) publish();
    const timer = window.setInterval(publish, 10_000);
    return () => {
      window.clearInterval(timer);
      if (queued !== null) window.clearTimeout(queued);
    };
    // `viewing` 이 바뀌면(같은 노트에서 녹음을 시작) 위 정리가 지운 값을 바로 다시 올린다.
  }, [bridge, enabled, snapshot, viewing, detail]);
  return null;
}

/** Only owns a provider when the current recording note is not already open. */
export function DesktopMeetingTimeline() {
  if (!desktopBridge()?.reportMeetingTimeline) return null;
  return desktopBridge()?.subscribeMeetingSelection ? (
    <SelectedMeetingTimelineOwner />
  ) : (
    <MeetingTimelineOwner />
  );
}

function SelectedMeetingTimelineOwner() {
  const recording = useRecording();
  const pathname = usePathname();
  const bridge = desktopBridge();
  const selection = useSyncExternalStore(
    subscribeMeetingSelection,
    getMeetingSelection,
    emptyMeetingSelection
  );
  useEffect(() => {
    if (!bridge?.subscribeMeetingSelection) return;
    let received = false,
      disposed = false;
    const unsubscribe = bridge.subscribeMeetingSelection((value) => {
      received = true;
      setMeetingSelection(value);
    });
    void bridge
      .getMeetingSelection?.()
      .then((value) => {
        if (!received && !disposed) setMeetingSelection(value);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unsubscribe();
      setMeetingSelection(null);
    };
  }, [bridge]);
  useEffect(() => {
    if (!bridge?.reportRecordingTarget) return;
    const active = [
      "requesting-permission",
      "connecting",
      "recording",
      "stopping",
    ].includes(recording.phase);
    void bridge
      .reportRecordingTarget(
        active && recording.activeNoteId && recording.activeWorkspaceId
          ? {
              noteId: recording.activeNoteId,
              workspaceId: recording.activeWorkspaceId,
            }
          : null
      )
      .catch(() => {});
  }, [
    bridge,
    recording.phase,
    recording.activeNoteId,
    recording.activeWorkspaceId,
  ]);
  const target = selection;
  const targetNoteId = target?.noteId,
    targetRequestId = target?.requestId;
  const onNotMember = useCallback(() => {
    if (targetNoteId)
      void bridge
        ?.reportMeetingUnavailable?.(targetNoteId, targetRequestId)
        .catch(() => {});
  }, [targetNoteId, targetRequestId, bridge]);
  const targetPath = target
    ? `/w/${encodeURIComponent(target.workspaceId)}/notes/${encodeURIComponent(target.noteId)}`
    : null;
  if (!target || pathname === targetPath) return null;
  return (
    <NoteRealtimeProvider
      key={`${target.noteId}:${target.requestId ?? "recording"}`}
      noteId={target.noteId}
      onNotMember={onNotMember}
    >
      <DesktopMeetingTimelineReporter />
    </NoteRealtimeProvider>
  );
}

function MeetingTimelineOwner() {
  const { activeNoteId, activeWorkspaceId, phase } = useRecording();
  const pathname = usePathname();
  const bridge = desktopBridge();
  const [deniedNote, setDeniedNote] = useState<string | null>(null);
  const onNotMember = useCallback(() => {
    setDeniedNote(activeNoteId);
    void bridge?.reportMeetingTimeline?.(null).catch(() => {});
  }, [activeNoteId, bridge]);
  const enabled = Boolean(
    bridge?.reportMeetingTimeline &&
    activeNoteId &&
    activeWorkspaceId &&
    phase === "recording"
  );
  useEffect(() => {
    if (!enabled) void bridge?.reportMeetingTimeline?.(null).catch(() => {});
  }, [bridge, enabled]);
  const recordingPath =
    activeWorkspaceId && activeNoteId
      ? `/w/${encodeURIComponent(activeWorkspaceId)}/notes/${encodeURIComponent(activeNoteId)}`
      : null;
  if (
    !enabled ||
    !activeNoteId ||
    deniedNote === activeNoteId ||
    pathname === recordingPath
  )
    return null;
  return (
    <NoteRealtimeProvider
      key={activeNoteId}
      noteId={activeNoteId}
      onNotMember={onNotMember}
    >
      <DesktopMeetingTimelineReporter />
    </NoteRealtimeProvider>
  );
}
