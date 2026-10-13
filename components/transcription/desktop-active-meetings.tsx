"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ActiveMeeting, DesktopBridge } from "@heymoa/desktop-contracts";

import { useNoteListPages } from "@/lib/workspace/use-note-list-pages";

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
  const { workspaceId } = useParams<{ workspaceId?: string }>();
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
    list.data?.status === 200 && list.data.data.success
      ? list.data.data.data.notes
      : undefined;
  // 워크스페이스를 옮기면 새 조회가 오기 전까지 이전 목록이 남는다(placeholder). 그 노트에
  // 새 워크스페이스 id 를 붙여 보내면 팝오버가 없는 주소로 보낸다.
  const settled = notes && !list.isPlaceholderData ? notes : undefined;
  const meetings = useMemo<ActiveMeeting[]>(
    () =>
      workspaceId
        ? (settled ?? [])
            .filter((note) => note.meetingStatus === "IN_PROGRESS")
            .slice(0, 20)
            .map((note) => ({
              workspaceId,
              noteId: note.noteId,
              title: note.title,
              startedAt: note.activeSessionStartedAt
                ? Date.parse(note.activeSessionStartedAt)
                : null,
            }))
        : [],
    [settled, workspaceId]
  );

  // 조회가 성공해 데이터가 새로 올 때마다 보낸다. 조회가 실패하거나 멈추면 하트비트도 멈춰
  // 네이티브가 150초 뒤 목록을 비운다 — 옛 목록을 새것처럼 계속 보내지 않는다.
  // ponytail: 첫 쪽(30개)만 본다. 진행 중 회의보다 새로 만든 노트가 30개 넘게 쌓이면 빠진다.
  const fresh = settled !== undefined ? list.dataUpdatedAt : 0;
  useEffect(() => {
    if (!bridge?.reportActiveMeetings || !fresh) return;
    void bridge.reportActiveMeetings(meetings).catch(() => {
      console.warn("Desktop active meetings could not be reported");
    });
  }, [bridge, meetings, fresh]);

  useEffect(() => {
    if (!bridge?.subscribeOpenNote) return;
    return bridge.subscribeOpenNote(({ workspaceId: ws, noteId }) =>
      router.push(
        `/w/${encodeURIComponent(ws)}/notes/${encodeURIComponent(noteId)}?view=full&tab=transcript`
      )
    );
  }, [bridge, router]);
  return null;
}
