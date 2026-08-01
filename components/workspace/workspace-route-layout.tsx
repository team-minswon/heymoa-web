"use client";

import { useParams, useSelectedLayoutSegments } from "next/navigation";

import { WorkspaceAppShell } from "@/components/workspace/workspace-app-shell";
import { WorkspacePage } from "@/components/workspace/workspace-page";
import { WorkspaceRouteSkeleton } from "@/components/workspace/workspace-route-skeleton";
import { DataBoundary } from "@/components/ui/data-boundary";

export function WorkspaceRouteLayout({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  // 주소는 meetingId 지만 아래로는 noteId 로 흐른다 — 계약 엔티티가 note 라서다.
  const params = useParams<{ meetingId?: string | string[] }>();
  const noteId = Array.isArray(params.meetingId)
    ? params.meetingId[0]
    : params.meetingId;
  // 회의 목록은 셸이 아니라 이 자리의 기본 화면이다. 노트 상세는 그 위에 덮으므로
  // 목록이 살아 있어야 하지만, 나머지 화면들은 목록을 **대체한다** — 같이 그리면 표가 겹친다.
  //
  // denylist 가 아니라 allowlist 다. 모르는 세그먼트를 「목록도 같이」로 두면 새 라우트를
  // 더할 때마다 조용히 겹치고, 그 배열을 고치는 걸 잊었다는 신호가 아무 데도 안 남는다.
  const segments = useSelectedLayoutSegments();
  const showNoteList = ["", "meetings"].includes(segments[0] ?? "");

  // v5: 사이드바는 full 모드에서도 유지한다 — full 노트 표면이 SidebarInset 안에서
  // 255 우측에 앉으므로 내비를 잃지 않는다. (이전 hideSidebar 폐기)
  return (
    <DataBoundary
      fallback={<WorkspaceRouteSkeleton />}
      errorLabel="워크스페이스를 불러오지 못했습니다"
      resetKeys={[workspaceId]}
    >
      <WorkspaceAppShell workspaceId={workspaceId} activeNoteId={noteId}>
        {showNoteList ? <WorkspacePage workspaceId={workspaceId} /> : null}
        {children}
      </WorkspaceAppShell>
    </DataBoundary>
  );
}
