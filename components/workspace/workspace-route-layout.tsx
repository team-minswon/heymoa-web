"use client";

import { useParams, useSearchParams } from "next/navigation";

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

  // 노트 전체 화면은 뷰포트를 통째로 덮는다(design.pen `XtEMZ`) — 사이드바도 상단바도
  // 안 보인다. **뒤에 깔린 목록은 계속 살아 있으므로** 포커스에서 빼야 한다: 안 그러면
  // Tab이 가려진 노트 행·메뉴로 들어가고 Enter로 이동이 실행된다.
  // side 시트는 안 덮으므로 그대로 둔다.
  const searchParams = useSearchParams();
  const isFullNote = Boolean(noteId) && searchParams.get("view") !== "side";
  return (
    <DataBoundary
      fallback={<WorkspaceRouteSkeleton />}
      errorLabel="워크스페이스를 불러오지 못했습니다"
      resetKeys={[workspaceId]}
    >
      <WorkspaceAppShell workspaceId={workspaceId} activeNoteId={noteId}>
        <div inert={isFullNote} className="contents">
          <WorkspacePage workspaceId={workspaceId} />
        </div>
        {children}
      </WorkspaceAppShell>
    </DataBoundary>
  );
}
