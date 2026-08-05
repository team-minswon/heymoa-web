"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { errorCodeOf } from "@/lib/api/error-message";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { forgetWorkspace } from "@/lib/workspace/cache";

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

  useRedirectWhenWorkspaceGone(workspaceId);

  return (
    <DataBoundary
      fallback={<WorkspaceRouteSkeleton />}
      errorLabel="워크스페이스를 불러오지 못했습니다"
      resetKeys={[workspaceId]}
      // 첫 진입부터 404면(남의 워크스페이스 URL 등) 캐시가 없어 여기까지 던져진다. 이동은
      // 위 훅이 하므로 여기서는 「다시 시도」가 번쩍이지 않게 골격만 유지한다. 나머지 실패
      // (네트워크·500)는 재시도가 의미 있으니 공용 처리 그대로 둔다.
      renderError={(error) =>
        errorCodeOf(error) === "WORKSPACE_NOT_FOUND" ? (
          <WorkspaceRouteSkeleton />
        ) : null
      }
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

/**
 * 이 워크스페이스가 더 이상 내 것이 아니면(추방당했거나 내가 나갔다) 갈 수 있는 곳으로
 * 보낸다. 재시도가 성공할 수 없는 유일한 실패라 「다시 시도」를 그려 두면 영원히 못 벗어난다.
 *
 * **경계(ErrorBoundary)로는 이 상황을 못 잡는다.** 화면을 보고 있는 중에 멤버십이 사라지면
 * 캐시된 데이터가 남은 채로 배경 재조회만 실패하는데, 그때 `useSuspenseQuery`는 오류를
 * 던지지 않고 낡은 화면을 그대로 둔다(격리 재현으로 확인). 그래서 같은 캐시 항목을
 * **비-suspense로 하나 더 구독해** 오류 상태를 직접 본다 — 키가 같아 요청은 늘지 않는다.
 *
 * 목적지는 홈이다. 로그인한 사람에게는 남은 워크스페이스를 `find(isDefault) ?? [0]`으로
 * 골라 주는 CTA가 이미 있고(`landing-cta.tsx`), 하나도 없으면 그 화면이 그 사실을 말한다.
 */
function useRedirectWhenWorkspaceGone(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { error } = useGetWorkspace(workspaceId);
  const gone = errorCodeOf(error) === "WORKSPACE_NOT_FOUND";

  useEffect(() => {
    if (!gone) return;
    forgetWorkspace(queryClient, workspaceId);
    router.replace("/");
  }, [gone, queryClient, router, workspaceId]);
}
