"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { DesktopBridge } from "@heymoa/desktop-contracts";
import { useGetNote } from "@/lib/api/generated/notes/notes";
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
  const enabled = Boolean(
    bridge?.reportMeetingTimeline &&
    phase === "recording" &&
    noteId === activeNoteId &&
    !note.isError
  );
  const title =
    note.data?.status === 200 && note.data.data.success
      ? note.data.data.data.title
      : "진행 중인 회의";
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
    if (note.isError && noteId === activeNoteId)
      void bridge?.reportMeetingTimeline?.(null).catch(() => {});
  }, [bridge, note.isError, noteId, activeNoteId]);
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
  }, [bridge, enabled, snapshot]);
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
