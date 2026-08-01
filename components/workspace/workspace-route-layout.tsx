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
  const params = useParams<{ noteId?: string | string[] }>();
  const noteId = Array.isArray(params.noteId)
    ? params.noteId[0]
    : params.noteId;
  // 회의 목록은 셸이 아니라 이 자리의 기본 화면이다. 노트 상세는 그 위에 덮으므로
  // 목록이 살아 있어야 하지만, 액션 아이템·프로젝트 타임라인은 목록을 대체한다 —
  // 같이 그리면 두 표가 겹친다.
  const segments = useSelectedLayoutSegments();
  const showNoteList = !["action-items", "projects", "settings"].includes(
    segments[0] ?? ""
  );

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
