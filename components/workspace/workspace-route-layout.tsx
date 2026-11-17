"use client";

import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { errorCodeOf } from "@/lib/api/error-message";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { forgetWorkspace } from "@/lib/workspace/cache";
import {
  notifyWorkspaceGone,
  notifyWorkspaceUnavailable,
} from "@/lib/workspace/gone-notice";
import { rememberWorkspaceId } from "@/lib/workspaces/last-workspace";

import {
  isWorkspaceRecordingActive,
  useRecording,
} from "@/components/transcription/recording-provider";

import { useAuth } from "@/components/auth/auth-provider";
import { NoteFullSkeleton } from "@/components/notes/note-full-skeleton";
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
  const t = useTranslations("shell.routeLayout");
  const params = useParams<{ noteId?: string | string[] }>();
  const noteId = Array.isArray(params.noteId)
    ? params.noteId[0]
    : params.noteId;

  const searchParams = useSearchParams();
  const isFullNote = Boolean(noteId) && searchParams.get("view") !== "side";
  const pathname = usePathname();
  const replacesList =
    pathname === `/w/${workspaceId}/tasks` ||
    pathname.startsWith(`/w/${workspaceId}/projects/`);

  useRedirectWhenWorkspaceGone(workspaceId);

  useEffect(() => {
    rememberWorkspaceId(workspaceId);
  }, [workspaceId]);

  const fallback = isFullNote ? (
    <NoteFullSkeleton />
  ) : (
    <WorkspaceRouteSkeleton />
  );

  return (
    <DataBoundary
      fallback={fallback}
      errorLabel={t("loadFailed")}
      resetKeys={[workspaceId]}
      renderError={(error) =>
        errorCodeOf(error) === "WORKSPACE_NOT_FOUND" ? fallback : null
      }
    >
      <WorkspaceAppShell workspaceId={workspaceId} activeNoteId={noteId}>
        {replacesList ? null : (
          <div inert={isFullNote} className="contents">
            <WorkspacePage workspaceId={workspaceId} />
          </div>
        )}
        {children}
      </WorkspaceAppShell>
    </DataBoundary>
  );
}

function meansWorkspaceGone(error: unknown) {
  return errorCodeOf(error) === "WORKSPACE_NOT_FOUND";
}

/**
 * 멤버십을 다시 물어보는 주기.
 *
 * **추방은 아무 신호도 안 준다.** 서버가 밀어주지 않으므로 물어보지 않으면 영영 모른다.
 * 상세 조회는 staleTime 60초 + 전역 `refetchOnWindowFocus: false`라 가만히 있으면 재조회가
 * 아예 안 나가고, 그래서 사용자는 이미 접근할 수 없는 화면을 계속 봤다.
 *
 * 30초는 노트 목록의 비활성 주기와 맞춘 값이다. TanStack은 창이 안 보이면 이 타이머를
 * 멈추므로(`refetchIntervalInBackground` 기본 false) 방치된 탭은 요청을 안 낸다.
 */
const MEMBERSHIP_POLL_MS = 30_000;

function useRedirectWhenWorkspaceGone(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const recording = useRecording();
  const { logout } = useAuth();
  const { data, error, failureReason } = useGetWorkspace(workspaceId, {
    query: { refetchInterval: MEMBERSHIP_POLL_MS },
  });

  // **`error`만 보면 못 잡는다.** TanStack에서 `error`는 `status`가 `"error"`가 되어야,
  // 즉 재시도를 전부 소진해야 채워지고, 그 전에 `fetchStatus`가 `paused`로 넘어가면
  // 영영 안 채워진다(브라우저 실측 — 새로고침하면 골격만 남던 것이 이것이다). 404는 다시
  // 물어도 답이 같으니 **첫 실패가 곧 결론**이고, 그 첫 실패가 `failureReason`이다.
  const gone = meansWorkspaceGone(error) || meansWorkspaceGone(failureReason);
  const recordingHere = isWorkspaceRecordingActive(recording, workspaceId);
  const { disconnect } = recording;

  const wasMember = data !== undefined;
  const everReadRef = useRef(false);
  useEffect(() => {
    if (data !== undefined) everReadRef.current = true;
  }, [data]);
  const leavingHere =
    useIsMutating({
      predicate: (mutation) =>
        String(mutation.options.mutationKey?.[0]) === "leaveWorkspace" &&
        (mutation.state.variables as { workspaceId?: string } | undefined)
          ?.workspaceId === workspaceId,
    }) > 0;

  useEffect(() => {
    if (!gone) return;
    if (recordingHere) void disconnect();
    if (wasMember && !leavingHere) notifyWorkspaceGone();
    else if (!wasMember && !everReadRef.current)
      notifyWorkspaceUnavailable(() => void logout());
    forgetWorkspace(queryClient, workspaceId);
    router.replace("/");
  }, [
    disconnect,
    gone,
    leavingHere,
    logout,
    queryClient,
    recordingHere,
    router,
    wasMember,
    workspaceId,
  ]);
}
