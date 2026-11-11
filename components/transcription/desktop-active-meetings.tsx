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

/**
 * 열린 워크스페이스에서 진행 중인 회의를 메뉴 막대 팝오버로 알리고, 팝오버에서 고른 회의를 연다.
 * 목록은 노트 목록과 같은 조회를 쓰므로 목록 화면이 열려 있으면 요청이 늘지 않는다. 옛 앱에는
 * 이 메서드가 없어 아무것도 하지 않는다.
 */
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
    // 창을 닫아 트레이에만 둬도 목록이 갱신돼야 한다.
    refetchIntervalInBackground: true,
  });
  const notes =
    workspaceId && list.data?.status === 200 && list.data.data.success
      ? list.data.data.data.notes
      : undefined;
  // 워크스페이스를 옮기면 새 조회가 오기 전까지 이전 목록이 남는다(placeholder). 그 노트에
  // 새 워크스페이스 id 를 붙여 보내면 팝오버가 없는 주소로 보낸다.
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
                // 트레이가 `지금 − startedAt` 으로 경과를 잰다. 녹음 시계의 원점이라 재개한 회의도 처음부터 센다.
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

  // 조회가 성공해 데이터가 새로 올 때마다 보낸다. 조회가 실패하거나 멈추면 하트비트도 멈춰
  // 네이티브가 150초 뒤 목록을 비운다 — 옛 목록을 새것처럼 계속 보내지 않는다.
  // shortcut: 첫 쪽에서 최근 20건만 보여 준다. 더 오래된 회의 탐색은 큰 앱을 사용한다.
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
