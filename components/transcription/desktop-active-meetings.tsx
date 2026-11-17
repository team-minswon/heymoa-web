"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ActiveMeeting, DesktopBridge } from "@heymoa/desktop-contracts";

import {
  recordingClockOriginMs,
  noteOrderedAt,
} from "@/lib/notes/meeting-state";
import { useNoteListPages } from "@/lib/workspace/use-note-list-pages";
import { ApiError } from "@/lib/api/fetcher";

const REPORT_MS = 30_000;

function desktopBridge() {
  return typeof window === "undefined"
    ? undefined
    : (window as unknown as { heymoaDesktop?: DesktopBridge }).heymoaDesktop;
}

export function DesktopActiveMeetings() {
  if (!desktopBridge()?.reportActiveMeetings) return null;
  return <ActiveMeetingsReporter />;
}

function ActiveMeetingsReporter() {
  const router = useRouter();
  const { workspaceId: routeWorkspaceId } = useParams<{
    workspaceId?: string;
  }>();
  const [lastWorkspaceId, setLastWorkspaceId] = useState(routeWorkspaceId);
  if (routeWorkspaceId && routeWorkspaceId !== lastWorkspaceId)
    setLastWorkspaceId(routeWorkspaceId);
  const workspaceId = routeWorkspaceId ?? lastWorkspaceId;
  const bridge = desktopBridge();
  const list = useNoteListPages({
    scope: { kind: "workspace", workspaceId: workspaceId ?? "" },
    pages: 1,
    enabled: Boolean(workspaceId),
    refetchInterval: () => REPORT_MS,
    refetchIntervalInBackground: true,
  });
  const notes =
    workspaceId && list.data?.status === 200 && list.data.data.success
      ? list.data.data.data.notes
      : undefined;
  const settled = notes && !list.isPlaceholderData ? notes : undefined;
  const meetings = useMemo<ActiveMeeting[]>(
    () =>
      workspaceId
        ? (settled ?? [])
            .filter(
              (note) =>
                (bridge?.meetingTimelineVersion ?? 1) >= 2 ||
                note.meetingStatus === "IN_PROGRESS"
            )
            .slice(0, 20)
            .map((note) => {
              const date = Date.parse(noteOrderedAt(note));
              return {
                workspaceId,
                noteId: note.noteId,
                title: note.title,
                ...((bridge?.meetingTimelineVersion ?? 1) >= 2
                  ? {
                      ended: note.meetingStatus === "ENDED",
                      state: note.meetingStatus,
                    }
                  : {}),
                startedAt:
                  note.meetingStatus === "IN_PROGRESS"
                    ? recordingClockOriginMs(note)
                    : Number.isFinite(date)
                      ? date
                      : null,
              };
            })
        : [],
    [settled, workspaceId, bridge]
  );

  const fresh = settled !== undefined ? list.dataUpdatedAt : 0;
  useEffect(() => {
    if (!bridge?.reportMeetingList || fresh) return;
    const status = !workspaceId
      ? "no-workspace"
      : list.isPending || list.isPlaceholderData
        ? "loading"
        : "failed";
    void bridge
      .reportMeetingList({
        workspaceId: workspaceId ?? null,
        status,
        meetings: [],
      })
      .catch(() => {});
  }, [
    bridge,
    fresh,
    list.isPending,
    list.isPlaceholderData,
    list.isError,
    workspaceId,
  ]);
  useEffect(() => {
    if (!bridge?.reportActiveMeetings || !fresh) return;
    if (bridge.reportMeetingList) {
      void bridge
        .reportMeetingList({
          workspaceId: workspaceId ?? null,
          status: list.isError ? "failed" : "ready",
          meetings:
            list.isError &&
            list.error instanceof ApiError &&
            [401, 403, 404].includes(list.error.status)
              ? []
              : meetings,
        })
        .catch(() => {});
      return;
    }
    void bridge.reportActiveMeetings(meetings).catch(() => {
      console.warn("Desktop active meetings could not be reported");
    });
  }, [bridge, meetings, fresh, list.isError, list.error, workspaceId]);

  useEffect(() => {
    if (!bridge?.subscribeOpenNote) return;
    return bridge.subscribeOpenNote(({ workspaceId: ws, noteId, tab }) =>
      router.push(
        `/w/${encodeURIComponent(ws)}/notes/${encodeURIComponent(noteId)}?view=full&tab=${tab ?? "transcript"}`
      )
    );
  }, [bridge, router]);
  return null;
}
