"use client";

import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { errorCodeOf } from "@/lib/api/error-message";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { forgetWorkspace } from "@/lib/workspace/cache";
import { notifyWorkspaceGone } from "@/lib/workspace/gone-notice";
import { rememberWorkspaceId } from "@/lib/workspaces/last-workspace";

import {
  isWorkspaceRecordingActive,
  useRecording,
} from "@/components/transcription/recording-provider";

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

  // **다음 진입의 목적지가 여기서 정해진다.** 로그인·랜딩·연동 복귀는 전부 `pickWorkspaceId`로
  // 어디를 열지 고르고, 그 근거가 이 한 줄이다(APP-401 — 서버의 `isDefault`를 대신한다).
  //
  // 아래 훅이 「사라진 워크스페이스」를 감지하기 전에 먼저 기록된다. **잘못된 곳으로 보내지는
  // 않는다** — 기억은 늘 목록으로 검증되고, 없으면 첫 항목으로 떨어진다. 대신 접근 못 하는
  // `/w/{id}`를 한 번 열면 직전 기억이 덮여 다음 진입이 첫 항목으로 간다. 잃는 것이 기억뿐이고
  // 최악이 최초 진입과 같은 상태라 조회 성공까지 기다리지 않는다.
  useEffect(() => {
    rememberWorkspaceId(workspaceId);
  }, [workspaceId]);

  /**
   * **골격은 곧 나타날 화면과 같은 모양이어야 한다.** 이 경계는 셸(워크스페이스·프로젝트
   * suspense 조회)과 노트를 함께 감싸므로, `?view=full`로 바로 들어오면 셸이 매달린 동안
   * fallback이 뜬다. 그런데 전체 뷰는 사이드바도 워크스페이스 상단바도 통째로 덮으므로
   * (design.pen `XtEMZ`) `WorkspaceRouteSkeleton`을 그리면 **보일 리 없는 사이드바가 잠깐
   * 뜬 다음 노트가 그 위를 덮는다.** 노트 모양으로 그린다.
   *
   * 사이드 뷰는 그대로다 — 시트 뒤에 목록이 실제로 남아 있어 그 골격이 맞다.
   */
  const fallback = isFullNote ? (
    <NoteFullSkeleton />
  ) : (
    <WorkspaceRouteSkeleton />
  );

  return (
    <DataBoundary
      fallback={fallback}
      errorLabel="워크스페이스를 불러오지 못했습니다"
      resetKeys={[workspaceId]}
      // 첫 진입부터 404면(남의 워크스페이스 URL 등) 캐시가 없어 여기까지 던져진다. 이동은
      // 위 훅이 하므로 여기서는 「다시 시도」가 번쩍이지 않게 골격만 유지한다. 나머지 실패
      // (네트워크·500)는 재시도가 의미 있으니 공용 처리 그대로 둔다.
      renderError={(error) =>
        errorCodeOf(error) === "WORKSPACE_NOT_FOUND" ? fallback : null
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
 * 이 실패가 "이 워크스페이스는 더 이상 내 것이 아니다"라는 뜻인가.
 *
 * 서버는 비멤버에게 워크스페이스의 존재를 숨기려고 403이 아니라 404를 쓴다
 * (`WorkspaceAccessHandler.requireMember`). 노트·프로젝트 조회도 결국 같은 멤버십을 보므로
 * (`NoteAccessHandler.requireProjectMember`) **어느 엔드포인트였든 코드가 같다** — 그래서
 * 경로를 나열하지 않고 코드 하나로 판정한다.
 */
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
 * 노트 폴링에 얹으려다 되돌렸다 — **프로젝트가 하나도 없는 워크스페이스에는 노트 조회 자체가
 * 없어서**(`workspace-page.tsx`의 `projects.map`) 새 워크스페이스에서 감지가 통째로 죽는다
 * (codex 리뷰 2회차). 비어 있든 아니든 같은 주기로 확인한다.
 *
 * 30초는 노트 목록의 비활성 주기와 맞춘 값이다. TanStack은 창이 안 보이면 이 타이머를
 * 멈추므로(`refetchIntervalInBackground` 기본 false) 방치된 탭은 요청을 안 낸다.
 */
const MEMBERSHIP_POLL_MS = 30_000;

/**
 * 이 워크스페이스가 더 이상 내 것이 아니면(추방당했거나 내가 나갔다) 갈 수 있는 곳으로
 * 보낸다. 재시도가 성공할 수 없는 유일한 실패라 「다시 시도」를 그려 두면 영원히 못 벗어난다.
 *
 * **경계(ErrorBoundary)로는 이 상황을 못 잡는다.** 화면을 보고 있는 중에 멤버십이 사라지면
 * 캐시된 데이터가 남은 채로 배경 재조회만 실패하는데, 그때 `useSuspenseQuery`는 오류를
 * 던지지 않고 낡은 화면을 그대로 둔다(격리 재현으로 확인). 그래서 같은 캐시 항목을
 * **비-suspense로 하나 더 구독해** 실패를 직접 본다 — 키가 같아 요청은 늘지 않는다.
 *
 * **판정은 이 워크스페이스의 조회 하나만 본다.** 캐시 전체를 구독해 아무 404나 신호로 쓰면
 * 남의 워크스페이스 실패에 걸린다 — 녹음 세션 폴링은 route를 넘어 살아 있고(`RecordingProvider`가
 * `app/providers.tsx`에 있다) 키에 워크스페이스가 없어서, A를 녹음하다 B로 옮긴 뒤 A에서
 * 추방되면 **멀쩡한 B에서 쫓겨난다**(codex 리뷰 1회차).
 *
 * 목적지는 홈이다. 로그인한 사람에게는 남은 워크스페이스를 `pickWorkspaceId`로 골라 주는
 * CTA가 이미 있고(`landing-cta.tsx`), 하나도 없으면 그 CTA가 생성 폼을 연다.
 */
function useRedirectWhenWorkspaceGone(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const recording = useRecording();
  const { data, error, failureReason } = useGetWorkspace(workspaceId, {
    query: { refetchInterval: MEMBERSHIP_POLL_MS },
  });

  // **`error`만 보면 못 잡는다.** TanStack에서 `error`는 `status`가 `"error"`가 되어야,
  // 즉 재시도를 전부 소진해야 채워지고, 그 전에 `fetchStatus`가 `paused`로 넘어가면
  // 영영 안 채워진다(브라우저 실측 — 새로고침하면 골격만 남던 것이 이것이다). 404는 다시
  // 물어도 답이 같으니 **첫 실패가 곧 결론**이고, 그 첫 실패가 `failureReason`이다.
  const gone = meansWorkspaceGone(error) || meansWorkspaceGone(failureReason);
  // 이 워크스페이스를 녹음 중이면 마이크와 소켓을 끊어야 한다. **다른 워크스페이스의 녹음은
  // 건드리지 않는다** — 녹음은 route를 넘어 살아 있어서 A를 녹음한 채 B를 볼 수 있고,
  // 그때 B에서 추방당했다고 A의 녹음을 죽이면 하던 일이 이유 없이 끊긴다.
  const recordingHere = isWorkspaceRecordingActive(recording, workspaceId);
  const { disconnect } = recording;

  /**
   * **한 번이라도 들어와 본 곳인가.** 이것이 「쫓겨났다」와 「원래 내 것이 아니었다」를 가른다.
   *
   * 남의 워크스페이스 URL을 붙여넣으면 첫 조회부터 404다. 그때도 홈으로 보내는 것은 맞지만
   * 「나가게 되었습니다」는 거짓말이다 — 들어온 적이 없다.
   *
   * 자발적 나가기도 여기 걸린다. 나가기는 `forgetWorkspace`로 상세 조회를 **지우고** 이동하고,
   * 지워진 자리에 새로 뜬 조회에는 데이터가 없다. 그래서 「내가 눌러서 나갔다」를 따로 표시해
   * 둘 필요가 없다 — 표시를 쓰면 요청보다 먼저 도착한 404를 못 막고, 소비되지 않은 표시가
   * 남아 나중의 진짜 추방을 가리는 두 갈래 경계 상태가 생긴다(codex 리뷰 1회차).
   */
  const wasMember = data !== undefined;
  /**
   * **지금 내가 나가는 중인가.** 30초 폴링이 나가기 DELETE와 겹칠 수 있다 — 서버에서 탈퇴가
   * 먼저 커밋되고 그 GET의 404가 DELETE의 204보다 먼저 도착하면, 캐시에는 아직 성공 데이터가
   * 남아 있어 `wasMember`가 참이고 **내가 누른 나가기에 「나가게 되었습니다」가 뜬다.**
   *
   * mutation 캐시는 앱 전역이라 설정 시트가 다른 트리에 있어도 여기서 보인다. 요청이 시작될
   * 때 켜지고 성패와 무관하게 끝나면 꺼지므로 따로 치울 상태가 없다 — 예전에 모듈 수준
   * 표시를 뒀다가 "요청보다 먼저 온 404를 못 막고, 소비 안 된 표시가 나중의 진짜 추방을
   * 가린다"는 지적을 받았다(codex 리뷰 1·3회차).
   */
  const leavingHere =
    useIsMutating({
      predicate: (mutation) =>
        String(mutation.options.mutationKey?.[0]) === "leaveWorkspace" &&
        (mutation.state.variables as { workspaceId?: string } | undefined)
          ?.workspaceId === workspaceId,
    }) > 0;

  useEffect(() => {
    if (!gone) return;
    // 화면 밖 녹음은 프로바이더가 자기 세션 조회로 직접 끊는다. 여기서 한 번 더 보는 것은
    // 세션 id가 붙기 전(권한 요청·연결 중)이라 그 조회가 아직 없을 때를 위해서다.
    // `stop()`이 아니라 `disconnect()`다 — 이미 비멤버라 세션 종료 API도 404로 떨어진다.
    if (recordingHere) void disconnect();
    if (wasMember && !leavingHere) notifyWorkspaceGone();
    forgetWorkspace(queryClient, workspaceId);
    router.replace("/");
  }, [
    disconnect,
    gone,
    leavingHere,
    queryClient,
    recordingHere,
    router,
    wasMember,
    workspaceId,
  ]);
}
