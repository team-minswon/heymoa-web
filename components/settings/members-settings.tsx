"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertTriangle, Info } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { WorkspaceGuestsSettings } from "@/components/settings/workspace-guests-settings";
import {
  isWorkspaceRecordingActive,
  useRecording,
} from "@/components/transcription/recording-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessageOf } from "@/lib/api/error-message";
import {
  getGetWorkspaceInvitationsQueryKey,
  useCancelWorkspaceInvitation,
  useCreateWorkspaceInvitation,
  useGetWorkspaceInvitations,
} from "@/lib/api/generated/workspace-invitations/workspace-invitations";
import {
  getGetWorkspaceMembersQueryKey,
  useChangeWorkspaceMemberRole,
  useGetWorkspaceMembers,
  useLeaveWorkspace,
  useRemoveWorkspaceMember,
} from "@/lib/api/generated/workspace-members/workspace-members";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { forgetWorkspace } from "@/lib/workspace/cache";
import { pickWorkspaceId } from "@/lib/workspaces/last-workspace";
import type {
  WorkspaceInvitationListResponseDataInvitationsItem,
  WorkspaceMemberListResponseDataMembersItem,
} from "@/lib/api/generated/models";
import { formatAppDate } from "@/lib/format/date";

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "이메일을 입력해 주세요.")
    .email("올바른 이메일을 입력해 주세요."),
  role: z.enum(["MEMBER", "ADMIN"]),
});
type InviteValues = z.infer<typeof inviteSchema>;

const ROLE_LABEL: Record<string, string> = { ADMIN: "관리자", MEMBER: "멤버" };

/** orval이 operationId로 만드는 mutationKey. 멤버 목록을 바꾸는 셋을 잠금에 센다. */
const MEMBER_MUTATION_KEYS = new Set([
  "changeWorkspaceMemberRole",
  "removeWorkspaceMember",
  "leaveWorkspace",
]);

/**
 * 같은 워크스페이스의 멤버 변경이 하나라도 진행 중인가. 역할 변경·추방·나가기가 **서로를**
 * 잠근다 — 셋 다 「ADMIN 최소 1명」이라는 목록 전체 판정을 놓고 겹치므로, 아직 무효화되지
 * 않은 낡은 목록으로 두 번째 조작을 시작하면 어느 쪽이 성공하고 어느 쪽이 403·409를 받는지가
 * 요청 도착 순서에 달라진다.
 *
 * **키만으로 거르지 않는다** — QueryClient가 앱 전역이라 A에서 시작한 변경이 B의 멤버 탭까지
 * 잠근다. mutation은 언마운트로 취소되지 않아 A의 요청이 멈추면 B가 계속 잠긴 채로 남는다
 * (rule AGENTS의 「경계 상태」). 그래서 변수의 workspaceId까지 본다.
 */
function useMemberMutationBusy(workspaceId: string) {
  return (
    useIsMutating({
      predicate: (mutation) =>
        MEMBER_MUTATION_KEYS.has(String(mutation.options.mutationKey?.[0])) &&
        (mutation.state.variables as { workspaceId?: string } | undefined)
          ?.workspaceId === workspaceId,
    }) > 0
  );
}

/**
 * 표시 이름은 OAuth에서 오므로 유일하지 않다 — 같은 워크스페이스에 「김민수」가 둘이면
 * 이름만으로는 컨트롤도 확인창도 어느 계정인지 말하지 못한다. 행이 이미 이메일을 함께
 * 그리는 이유가 그것이고, 접근성 이름과 확인창도 같은 식별자를 써야 한다.
 */
function memberLabel(member: WorkspaceMemberListResponseDataMembersItem) {
  return `${member.name}(${member.email})`;
}

function RoleChip({ role }: { role: string }) {
  return (
    <Badge variant={role === "ADMIN" ? "secondary" : "outline"}>
      {ROLE_LABEL[role] ?? role}
    </Badge>
  );
}

/**
 * 설정 멤버 탭. **초대·취소는 ADMIN 단독**이라 역할을 멤버 목록의 내 userId로 가른다(연동
 * 설정과 같은 규칙) — 역할을 모르는 동안엔 폼·대기 목록을 그리지 않는다. 초대 실패는 입력에
 * 붙은 지속 상태라 인라인이다.
 */
export function MembersSettings({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const membersQuery = useGetWorkspaceMembers(workspaceId);

  const membersResponse = membersQuery.data;
  const members =
    membersResponse !== undefined &&
    membersResponse.status === 200 &&
    membersResponse.data.success
      ? (membersResponse.data.data?.members ?? [])
      : [];
  const myRole = members.find((member) => member.userId === user?.userId)?.role;
  // 계약은 가입순으로 내려준다. 나를 맨 위로 올리고 **나머지 순서는 그대로 둔다** — 서버 정렬을
  // 여기서 다시 짜면 목록이 이 화면에서만 다른 순서가 된다. 내 행에는 「나」 배지와 역할이
  // 붙어서, 멤버가 많을수록 스크롤해서 찾아야 했다.
  const myUserId = user?.userId;
  const orderedMembers = myUserId
    ? [...members].sort(
        (a, b) => Number(b.userId === myUserId) - Number(a.userId === myUserId)
      )
    : members;
  // 역할이 확정되기 전(로딩)이나 실패 시엔 관리 조작을 열지 않는다 — MEMBER에게 눌러 봤자
  // 403인 폼이 보이면 안 된다.
  const canManage = myRole === "ADMIN" && !membersQuery.isError;

  // 초대 목록은 ADMIN 전용 엔드포인트다 — 역할이 ADMIN으로 확정되기 전엔 부르지 않는다
  // (MEMBER가 열면 403 + 재시도만 쌓인다).
  const invitationsQuery = useGetWorkspaceInvitations(workspaceId, {
    query: { enabled: canManage },
  });

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <header className="mb-8">
        <h2 className="font-serif text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
          멤버
        </h2>
        <p className="mt-2 text-sm text-[var(--el-muted)]">
          이 워크스페이스의 멤버와 대기 중인 초대를 관리합니다.
        </p>
      </header>

      {membersQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-[52px] rounded-block" />
          <Skeleton className="h-[52px] rounded-block" />
          <Skeleton className="h-[52px] rounded-block" />
        </div>
      ) : membersQuery.isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-[var(--el-ink)]">
            멤버를 불러오지 못했습니다.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-[30px]"
            onClick={() => void membersQuery.refetch()}
          >
            다시 시도
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--el-hairline)] overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-white">
          {orderedMembers.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              isMe={member.userId === user?.userId}
              canManage={canManage}
              workspaceId={workspaceId}
            />
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="mt-8 space-y-8">
          <InviteForm workspaceId={workspaceId} />
          <PendingInvitations
            workspaceId={workspaceId}
            isLoading={invitationsQuery.isLoading}
            isError={invitationsQuery.isError}
            invitations={pendingInvitationsOf(invitationsQuery.data)}
            onRetry={() => void invitationsQuery.refetch()}
          />
        </div>
      ) : null}

      {/* 멤버 목록과 **섞지 않는다** — 역할 변경·내보내기가 임시 참여자에게도 있는
          것처럼 읽힌다. 목록은 전원이 보고 관리만 ADMIN이다. */}
      <WorkspaceGuestsSettings workspaceId={workspaceId} canManage={canManage} />

      <LeaveWorkspaceSection workspaceId={workspaceId} />
    </div>
  );

  function pendingInvitationsOf(
    response: typeof invitationsQuery.data
  ): WorkspaceInvitationListResponseDataInvitationsItem[] {
    return response !== undefined &&
      response.status === 200 &&
      response.data.success
      ? (response.data.data?.invitations ?? [])
      : [];
  }
}

/**
 * 역할 변경·추방은 ADMIN 전용이라 `canManage`가 꺼지면 이 행은 배지만 그린다.
 *
 * **자기 자신은 추방 버튼을 그리지 않는다** — 서버도 400으로 막지만 UI가 먼저 없앤다.
 * 자기 역할은 select로 바꿀 수 있게 둔다 — 마지막 관리자가 자기를 강등하려는 시도까지
 * 포함해 서버가 최종 판정한다(409 `LAST_WORKSPACE_ADMIN`).
 *
 * 두 mutation 모두 실패해도 `onSettled`로 목록을 다시 부른다 — 성공에만 걸면 서버 상태가
 * 이미 바뀐 뒤(예: 동시에 다른 관리자가 바꾼 경우)에도 화면이 옛 값에 머문다(APP-187).
 * 실패 토스트는 전역 `MutationCache.onError`가 띄우므로 여기서 opt-out하거나 자기
 * `toast.error`를 부르지 않는다 — 그러면 마지막 관리자 409 같은 서버 문구가 안 뜨거나
 * 두 번 뜬다.
 */
function MemberRow({
  member,
  isMe,
  canManage,
  workspaceId,
}: {
  member: WorkspaceMemberListResponseDataMembersItem;
  isMe: boolean;
  canManage: boolean;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();
  const invalidateMembers = () =>
    queryClient.invalidateQueries({
      queryKey: getGetWorkspaceMembersQueryKey(workspaceId),
    });

  const changeRole = useChangeWorkspaceMemberRole({
    mutation: { onSettled: invalidateMembers },
  });
  const remove = useRemoveWorkspaceMember({
    mutation: { onSettled: invalidateMembers },
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = useMemberMutationBusy(workspaceId);

  return (
    <li className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--el-ink)]">
          <span className="truncate">{member.name}</span>
          {isMe ? (
            <span className="shrink-0 text-xs font-normal text-[var(--el-muted)]">
              (나)
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-[var(--el-muted)]">
          {member.email}
        </p>
      </div>

      {canManage ? (
        <select
          aria-label={`${memberLabel(member)} 역할`}
          value={member.role}
          disabled={busy}
          onChange={(event) =>
            changeRole.mutate({
              workspaceId,
              userId: member.userId,
              data: { role: event.target.value as "ADMIN" | "MEMBER" },
            })
          }
          className="h-[30px] shrink-0 rounded-control border border-[var(--el-hairline)] bg-white px-2 text-xs"
        >
          <option value="MEMBER">멤버</option>
          <option value="ADMIN">관리자</option>
        </select>
      ) : (
        <RoleChip role={member.role} />
      )}

      {/*
        가입일은 모바일에서 숨긴다. 375px에서 행 안쪽은 약 290px인데 역할 select와 내보내기
        버튼만으로 이미 200px 가까이 쓴다 — 날짜 120px까지 두면 이름·이메일이 0폭으로 눌려
        누구를 내보내는지 못 보고 버튼을 누르게 된다. 셋 중 없어도 되는 것은 날짜다.
      */}
      <p className="hidden w-[120px] shrink-0 text-right text-xs text-[var(--el-muted)] sm:block">
        {formatAppDate(member.joinedAt, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      {canManage && !isMe ? (
        <>
          {/*
            보이는 글자는 「내보내기」지만 접근성 이름에는 대상을 넣는다. 행이 여럿이면 스크린
            리더의 버튼 목록에 같은 이름이 반복되어 누구를 내보내는 버튼인지 구분할 수 없고,
            되돌릴 수 없는 조작이라 그 모호함의 대가가 크다. 보이는 글자를 그대로 품고 있어
            음성 제어로 「내보내기」라고 말해도 여전히 잡힌다.
          */}
          <Button
            variant="outline"
            size="sm"
            className="h-[30px] shrink-0"
            aria-label={`${memberLabel(member)} 내보내기`}
            loading={remove.isPending}
            disabled={busy}
            onClick={() => setConfirmOpen(true)}
          >
            내보내기
          </Button>
          {/* 나가기와 같은 이유로 요청 중에는 닫지 않는다. */}
          <AlertDialog
            open={confirmOpen}
            onOpenChange={(open) => {
              if (remove.isPending) return;
              setConfirmOpen(open);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {member.name}님을 내보낼까요?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {member.email} 계정이 이 워크스페이스의 멤버 목록과 접근
                  권한을 잃습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={remove.isPending}>
                  취소
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  loading={remove.isPending}
                  disabled={remove.isPending}
                  onClick={async () => {
                    // 다이얼로그를 연 채 기다린다 — 여기서 바로 닫으면 remove.isPending이
                    // 다이얼로그 안에서 참으로 보일 틈이 없다(`note-delete-dialog.tsx`와 같은
                    // 패턴). 거절은 여기서 소비한다 — 안 그러면 unhandled rejection으로 남고,
                    // 토스트는 전역 `MutationCache.onError`가 띄운다.
                    const response = await remove
                      .mutateAsync({ workspaceId, userId: member.userId })
                      .catch(() => null);
                    if (response?.status !== 204) return;
                    setConfirmOpen(false);
                  }}
                >
                  내보내기
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </li>
  );
}

/**
 * 나가기는 역할과 무관하게 모두에게 보인다 — 마지막 ADMIN인지는 서버가 판정한다(409).
 * 가입 시 만들어진 개인 워크스페이스는 본인이 유일 ADMIN이라 이 불변식이 자동으로 막으므로
 * 별도 UI 분기를 두지 않는다.
 *
 * **실패 문구는 토스트가 아니라 다이얼로그 안에 남긴다.** 「마지막 관리자라 나갈 수 없다」는
 * 방금 한 행동의 실패가 아니라 다른 멤버를 관리자로 올리기 전까지 계속 참인 상태다 —
 * 토스트로 사라지면 왜 막혔는지 알 수 없다(rule error-loading의 「지속 상태」 줄).
 * 그래서 전역 토스트를 `suppressErrorToast`로 끈다. 안 끄면 같은 문구가 두 번 뜬다.
 */
function LeaveWorkspaceSection({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspacesQuery = useGetWorkspaces();
  const leave = useLeaveWorkspace({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<unknown>(null);
  const busy = useMemberMutationBusy(workspaceId);
  /**
   * **녹음 중에는 못 나간다.** 나가도 `RecordingProvider`는 route를 넘어 살아 있어서
   * (`app/providers.tsx`) 마이크와 소켓이 그대로 남고, 이미 접근할 수 없게 된 노트로 음성을
   * 계속 보낸다. 권한 요청·연결 중에 나가면 고아 세션까지 생긴다.
   *
   * **여기서만 막는다** — 다른 워크스페이스를 녹음 중인 것은 이 화면과 무관하다.
   */
  const recordingHere = isWorkspaceRecordingActive(useRecording(), workspaceId);

  const leaveMessage = leaveError
    ? errorMessageOf(leaveError, "워크스페이스를 나가지 못했습니다.")
    : null;

  return (
    <section className="mt-8 border-t border-[var(--el-hairline)] pt-8">
      <h3 className="text-sm font-medium text-[var(--el-ink)]">
        워크스페이스 나가기
      </h3>
      <p className="mt-1 text-xs text-[var(--el-muted)]">
        이 워크스페이스의 회의 기록과 프로젝트에 더 이상 접근할 수 없게 됩니다.
        다시 들어오려면 초대를 받아야 합니다.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 h-[30px]"
        loading={leave.isPending}
        disabled={busy || recordingHere}
        onClick={() => {
          // 지난 실패 안내를 지우고 연다 — 상황이 바뀐 뒤에도 옛 문구가 붙어 있으면 안 된다.
          setLeaveError(null);
          setConfirmOpen(true);
        }}
      >
        워크스페이스 나가기
      </Button>

      {/*
        오류가 아니라 "지금 할 수 없음"이라 인라인이다(rule `error-loading`) — 토스트로
        띄우면 사라진 뒤에 왜 못 누르는지 알 수 없다. 잠긴 버튼에 `title`을 다는 것도 안 된다:
        터치에는 호버가 없고 `disabled`는 포커스도 안 받는다(`recording-dock`이 같은 이유로
        시작 버튼 자리에 문구를 그린다).
      */}
      {recordingHere ? (
        <p role="status" className="mt-2 text-xs text-[var(--el-muted)]">
          녹음을 끝낸 뒤 나갈 수 있습니다.
        </p>
      ) : null}

      {/*
        요청 중에는 Escape·바깥 클릭으로도 닫히지 않는다. 창만 사라지면 취소한 줄 알지만
        요청은 계속 가고, 뒤늦게 성공하면 갑자기 다른 워크스페이스로 튕긴다.
      */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (leave.isPending) return;
          setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 워크스페이스를 나갈까요?</AlertDialogTitle>
            <AlertDialogDescription>
              회의 기록과 프로젝트에 더 이상 접근할 수 없게 됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {leaveMessage ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] px-3 py-2.5"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
              <p className="text-xs leading-relaxed text-[var(--el-body)]">
                {leaveMessage}
              </p>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={leave.isPending}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={leave.isPending}
              disabled={leave.isPending}
              onClick={async () => {
                setLeaveError(null);
                const response = await leave
                  .mutateAsync({ workspaceId })
                  .catch((error: unknown) => {
                    setLeaveError(error);
                    return null;
                  });
                if (response?.status !== 204) return;
                setConfirmOpen(false);
                // **목적지를 먼저 고른 뒤** 캐시를 걷어낸다 — 순서가 뒤집히면 목록에서 이미
                // 빠진 뒤라 어디로 갈지 고를 수 없다.
                const destination = nextWorkspacePath();
                forgetWorkspace(queryClient, workspaceId);
                // 떠난 워크스페이스의 노트·프로젝트·멤버도 전부 stale로 둔다 — 접근이 이미 끊겼다.
                void queryClient.invalidateQueries();
                router.replace(destination);
              }}
            >
              나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );

  /**
   * 목적지는 `auth-callback-client.tsx`가 로그인 직후 쓰는 규칙 그대로다 —
   * `pickWorkspaceId`. 새 규칙을 만들지 않는다.
   *
   * 떠난 곳이 마지막 방문으로 기억돼 있어도 목록에서 뺀 뒤 고르므로 그리로 되돌아가지 않는다.
   */
  function nextWorkspacePath() {
    const response = workspacesQuery.data;
    const items =
      response !== undefined && response.status === 200 && response.data.success
        ? (response.data.data?.workspaces ?? [])
        : [];
    const remaining = items.filter((item) => item.workspaceId !== workspaceId);
    const next = pickWorkspaceId(remaining);
    // 남은 워크스페이스가 없으면 홈으로 보낸다 — 랜딩 CTA가 그 상태를 받아 생성 폼을 연다.
    return next ? `/w/${next}` : "/";
  }
}

function InviteForm({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  // 초대 실패는 인라인으로 그리니 전역 토스트를 끈다.
  const create = useCreateWorkspaceInvitation({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [inviteError, setInviteError] = useState<unknown>(null);
  // create.isPending은 무효화가 끝나기 전에 false로 떨어진다 — 그동안 폼엔 방금 낸 이메일이
  // 남아 있어 버튼이 다시 열리면 같은 초대가 또 나간다(중복 409). 제출~리셋 구간을 직접 잠근다.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "MEMBER" },
  });

  const submit = form.handleSubmit(async (values) => {
    setInviteError(null);
    setIsSubmitting(true);
    try {
      await create.mutateAsync({ workspaceId, data: values });
      await queryClient.invalidateQueries({
        queryKey: getGetWorkspaceInvitationsQueryKey(workspaceId),
      });
      form.reset({ email: "", role: "MEMBER" });
    } catch (error) {
      setInviteError(error);
    } finally {
      setIsSubmitting(false);
    }
  });

  const inviteMessage = inviteError
    ? errorMessageOf(inviteError, "초대에 실패했습니다.")
    : null;

  const emailField = form.register("email");

  return (
    <section>
      <h3 className="text-sm font-medium text-[var(--el-ink)]">멤버 초대</h3>
      <p className="mt-1 text-xs text-[var(--el-muted)]">
        이메일로 초대합니다. 미가입자도 초대 메일의 링크로 가입해 합류할 수
        있습니다.
      </p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="invite-email" className="sr-only">
              초대할 이메일
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@company.com"
              aria-invalid={
                Boolean(inviteError) || Boolean(form.formState.errors.email)
              }
              {...emailField}
              onChange={(event) => {
                // 주소를 고치면 지난 실패 안내를 지운다 — 새 값에 옛 오류가 붙어 있으면 안 된다.
                if (inviteError) setInviteError(null);
                void emailField.onChange(event);
              }}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-[var(--el-error)]">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-role" className="sr-only">
              역할
            </Label>
            <select
              id="invite-role"
              {...form.register("role")}
              className="h-8 rounded-control border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="MEMBER">멤버</option>
              <option value="ADMIN">관리자</option>
            </select>
          </div>
          <Button type="submit" loading={isSubmitting} className="rounded-full">
            초대
          </Button>
        </div>

        {inviteMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-block border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] px-3 py-2.5"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
            <p className="text-xs leading-relaxed text-[var(--el-body)]">
              {inviteMessage}
            </p>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function PendingInvitations({
  workspaceId,
  isLoading,
  isError,
  invitations,
  onRetry,
}: {
  workspaceId: string;
  isLoading: boolean;
  isError: boolean;
  invitations: WorkspaceInvitationListResponseDataInvitationsItem[];
  onRetry: () => void;
}) {
  const queryClient = useQueryClient();
  // 만료 판정은 렌더 시점 1회 고정 — hydration 불일치 방지. 서버는 만료 PENDING을
  // 처리 시점에 EXPIRED로 밀므로 이 판정은 그 사이의 표시용이다.
  const [now] = useState(() => Date.now());
  const cancel = useCancelWorkspaceInvitation({
    mutation: {
      // 실패해도 재조회한다 — 만료 409는 서버가 초대를 EXPIRED로 전이시킨 뒤라(APP-184),
      // 성공시에만 갱신하면 이미 목록에서 빠진 행이 화면에 남는다.
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: getGetWorkspaceInvitationsQueryKey(workspaceId),
        }),
    },
  });

  return (
    <section>
      <h3 className="text-sm font-medium text-[var(--el-ink)]">
        대기 중인 초대
      </h3>
      <div className="mt-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-[52px] rounded-block" />
            <Skeleton className="h-[52px] rounded-block" />
          </div>
        ) : isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-[var(--el-ink)]">
              대기 중인 초대를 불러오지 못했습니다.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-[30px]"
              onClick={onRetry}
            >
              다시 시도
            </Button>
          </div>
        ) : invitations.length === 0 ? (
          <div className="flex items-center gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-6">
            <Info className="size-4 shrink-0 text-[var(--el-muted)]" />
            <p className="text-sm text-[var(--el-muted)]">
              대기 중인 초대가 없습니다.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--el-hairline)] overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-white">
            {invitations.map((invitation) => (
              <li
                key={invitation.invitationId}
                className="flex min-h-[52px] items-center gap-3 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  {/* 미가입자는 이름이 없다(null) — 이메일이 곧 신원이라 주 텍스트로 올린다 */}
                  <p className="truncate text-sm font-medium text-[var(--el-ink)]">
                    {invitation.inviteeName ?? invitation.inviteeEmail}
                  </p>
                  {invitation.inviteeName !== null && (
                    <p className="truncate text-xs text-[var(--el-muted)]">
                      {invitation.inviteeEmail}
                    </p>
                  )}
                </div>
                {Date.parse(invitation.expiresAt) < now && (
                  <Badge variant="outline">만료됨</Badge>
                )}
                <RoleChip role={invitation.role} />
                <p className="hidden w-[160px] shrink-0 text-right text-xs text-[var(--el-muted)] sm:block">
                  {invitation.inviterName} ·{" "}
                  {formatAppDate(invitation.createdAt, {
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={cancel.isPending}
                  onClick={() =>
                    cancel.mutate({
                      workspaceId,
                      invitationId: invitation.invitationId,
                    })
                  }
                >
                  취소
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
