"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { DesktopBridge } from "@heymoa/desktop-contracts";
import { useGetNote } from "@/lib/api/generated/notes/notes";
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
  return <MeetingTimelineReporter />;
}

function MeetingTimelineReporter() {
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
  const viewing =
    phase !== "recording" && isMeetingActive(noteData) && !dismissed;
  const enabled = Boolean(
    bridge?.reportMeetingTimeline &&
    ((phase === "recording" && noteId === activeNoteId) || viewing) &&
    !note.isError
  );
  const title = noteData?.title ?? "진행 중인 회의";
  const snapshot = useMemo(
    () =>
      meetingTimelineSnapshot(noteId, title, context.state, {
        loading: context.loading,
        failed: context.failed || subscriptionIssue !== null,
        reconnecting,
      }),
    [
      noteId,
      title,
      context.state,
      context.loading,
      context.failed,
      subscriptionIssue,
      reconnecting,
    ]
  );
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
    if (!viewing || !bridge?.reportMeetingTimeline) return;
    return () => void bridge.reportMeetingTimeline!(null).catch(() => {});
  }, [bridge, viewing]);
  useEffect(() => {
    if (note.isError && (noteId === activeNoteId || viewing))
      void bridge?.reportMeetingTimeline?.(null).catch(() => {});
  }, [bridge, note.isError, noteId, activeNoteId, viewing]);
  useEffect(() => {
    if (!enabled || !bridge?.reportMeetingTimeline) return;
    const publish = () =>
      void bridge.reportMeetingTimeline!(snapshot).catch(() => {
        // Native independently marks missing heartbeats as stale.
        console.warn("Desktop meeting timeline could not be reported");
      });
    publish();
    const timer = window.setInterval(publish, 10_000);
    return () => window.clearInterval(timer);
    // `viewing` 이 바뀌면(같은 노트에서 녹음을 시작) 위 정리가 지운 값을 바로 다시 올린다.
  }, [bridge, enabled, snapshot, viewing]);
  return null;
}

/** Only owns a provider when the current recording note is not already open. */
export function DesktopMeetingTimeline() {
  if (!desktopBridge()?.reportMeetingTimeline) return null;
  return <MeetingTimelineOwner />;
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
