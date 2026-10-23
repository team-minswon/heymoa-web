"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { AlertTriangle, Info, MoreHorizontal } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RenamePersonDialog,
  SoftName,
} from "@/components/settings/rename-person-dialog";
import {
  memberNameOf,
  useRenameMember,
} from "@/lib/workspace/use-rename-member";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SETTINGS_LIST,
  SETTINGS_LIST_ROW,
  SettingsHeader,
  SkeletonLine,
} from "@/components/settings/settings-layout";
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
  getLeaveWorkspaceMutationKey,
  leaveWorkspace,
  useGetWorkspaceMembers,
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
import { confirmationMatches } from "@/lib/account/deletion-api";
import { ConfirmPhraseField } from "@/components/settings/confirm-phrase-field";

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
  /**
   * **이름 변경 대화상자는 목록 밖에서 연다.** 행 안에 두면 저장 중 재조회가 그 멤버를 목록에서 지우는 순간(남이 내보냈다)
   * 대화상자까지 함께 사라져 결과를 말할 자리가 없다. 연 순간의 멤버를 객체째 든다(임시 참여자와 같은 규칙).
   */
  const [renaming, setRenaming] =
    useState<WorkspaceMemberListResponseDataMembersItem | null>(null);

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <SettingsHeader
        title="멤버"
        description="이 워크스페이스의 멤버와 대기 중인 초대를 관리합니다."
      />

      {membersQuery.isLoading ? (
        <ul className={SETTINGS_LIST} aria-label="멤버 불러오는 중">
          {Array.from({ length: SKELETON_MEMBER_ROWS }, (_, index) => (
            <MemberRowSkeleton key={index} />
          ))}
        </ul>
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
        <ul className={SETTINGS_LIST}>
          {orderedMembers.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              isMe={member.userId === user?.userId}
              canManage={canManage}
              workspaceId={workspaceId}
              onRename={() => setRenaming(member)}
            />
          ))}
        </ul>
      )}

      {renaming ? (
        <RenameMemberDialog
          workspaceId={workspaceId}
          member={renaming}
          onClose={() => setRenaming(null)}
        />
      ) : null}

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
      ) : membersQuery.isLoading ? (
        // **역할을 모르는 동안은 관리자 자리를 잡아 둔다.** 설정을 여는 사람은 대개 워크스페이스를 만든 관리자라,
        // 비워 두면 초대 폼이 도착하며 아래 「나가기」를 250px 가까이 민다. MEMBER 에게는 이 자리가 걷힌다.
        <div className="mt-8 space-y-8" aria-hidden>
          <InviteFormSkeleton />
          <PendingInvitationsFrame>
            <PendingInvitationsSkeleton />
          </PendingInvitationsFrame>
        </div>
      ) : null}

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
  onRename,
}: {
  member: WorkspaceMemberListResponseDataMembersItem;
  isMe: boolean;
  canManage: boolean;
  workspaceId: string;
  onRename: () => void;
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
  const names = memberNameOf(member);
  // 본인은 자기 이름을, ADMIN 은 누구의 이름이든 고친다(서버가 최종 판정한다).
  const canRename = isMe || canManage;
  const canRemove = canManage && !isMe;

  return (
    <li className={SETTINGS_LIST_ROW}>
      {/* **임시 참여자 목록과 같은 얼굴이다.** 한쪽에만 구슬이 있으면 같은 설정 화면에서
          사람이 두 가지로 그려진다. 색은 `userId` 가 정한다 — 이름은 겹치고(김민수가 둘)
          개명하면 튄다. */}
      <PersonAvatar name={member.userId} image={member.image} size={28} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--el-ink)]">
          <SoftName name={member.name} className="truncate" />
          {isMe ? (
            <span className="shrink-0 text-xs font-normal text-[var(--el-muted)]">
              (나)
            </span>
          ) : null}
        </p>
        {/* **고친 이름이면 계정 이름을 보조 줄에 함께 둔다.** 누가 누구인지(구글 계정의 그 사람)를 잃지 않게 — 한 줄이라 행
            높이는 그대로다. 이메일이 길면 뒤가 잘리므로 계정 이름을 앞에 둔다. */}
        <p className="truncate text-xs text-[var(--el-muted)]">
          {names.displayName !== null &&
          names.displayName !== names.accountName ? (
            <>계정 이름 {names.accountName} · </>
          ) : null}
          {member.email}
        </p>
      </div>

      {/* **역할 자리 폭을 고정한다.** 「관리자」와 「멤버」는 글자 수가 다르고, 고칠 수
          있는 행은 select·없는 행은 칩이라 폭이 또 달라진다 — 그대로 두면 행마다 날짜가
          시작하는 자리가 어긋난다. */}
      <div className="flex w-[104px] shrink-0 justify-end">
        {canManage ? (
          <Select
            // **값이 아니라 라벨을 그린다.** 안 주면 트리거에 `ADMIN`·`MEMBER` 가 그대로
            // 서서 목록의 「관리자」·「멤버」와 두 말이 섞인다.
            items={ROLE_LABEL}
            value={member.role}
            onValueChange={(role) =>
              changeRole.mutate({
                workspaceId,
                userId: member.userId,
                data: { role: role as "ADMIN" | "MEMBER" },
              })
            }
            disabled={busy}
          >
            <SelectTrigger aria-label={`${memberLabel(member)} 역할`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEMBER">멤버</SelectItem>
              <SelectItem value="ADMIN">관리자</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <RoleChip role={member.role} />
        )}
      </div>

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

      {/* **관리 메뉴 자리는 버튼이 없어도 비워 둔다.** 내 행·MEMBER 의 남 행에는 고칠 것이 없거나 적은데, 자리까지 없애면
          그 행만 날짜가 오른쪽 끝까지 밀려 두 줄의 날짜가 서로 다른 자리에 선다. 이름 변경·내보내기를 한 메뉴로 모아 행에
          버튼이 늘어서지 않게 하고(좁은 폭에서 이름이 눌렸다), 되돌릴 수 없는 내보내기는 한 번 더 열어야 닿게 둔다. */}
      <div className="flex w-8 shrink-0 justify-end">
        {canRename ? (
          <DropdownMenu>
            {/* 보이는 것은 「⋯」 지만 접근성 이름에는 대상을 넣는다 — 행이 여럿이면 같은 이름의 버튼이 반복된다. */}
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${memberLabel(member)} 관리`}
                  className="rounded-full text-[var(--el-muted)] transition-colors hover:text-[var(--el-ink)]"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem onClick={onRename}>이름 변경</DropdownMenuItem>
              {canRemove ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setConfirmOpen(true)}
                  >
                    내보내기
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

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
            <AlertDialogTitle>{member.name}님을 내보낼까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {member.email} 계정이 이 워크스페이스의 멤버 목록과 접근 권한을
              잃습니다.
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
    </li>
  );
}

/**
 * 멤버 이름 변경 (APP-1206). 비우면 계정 이름으로 돌아간다는 것을 placeholder 와 안내 한 줄이 함께 말한다.
 * 낙관적 갱신·실패 되돌리기는 [useRenameMember] 가 한다.
 */
function RenameMemberDialog({
  workspaceId,
  member,
  onClose,
}: {
  workspaceId: string;
  member: WorkspaceMemberListResponseDataMembersItem;
  onClose: () => void;
}) {
  // 연 순간의 모습을 든다 — 저장 중 낙관적 이름이 목록에 먼저 써져도 대화상자의 「지금 이름」은 흔들리지 않는다.
  const [opened] = useState(() => memberNameOf(member));
  const { rename } = useRenameMember({ workspaceId, member: opened });
  return (
    <RenamePersonDialog
      avatarKey={member.userId}
      image={member.image}
      currentName={opened.name}
      secondary={member.email}
      label="이 워크스페이스에서 보일 이름"
      initialValue={opened.displayName ?? ""}
      placeholder={opened.accountName}
      hint={`비우면 계정 이름(${opened.accountName})으로 보입니다.`}
      allowEmpty
      onSubmit={rename}
      onClose={onClose}
    />
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
  /**
   * **워크스페이스 이름을 본문에 싣는다(PRO-69, APP-1383).** server 가 현재 이름과 정확히 같은지 다시 본다(APP-1381).
   * 생성 함수를 같은 mutationKey 로 감싼다 — 위 잠금(`useMemberMutationBusy`)이 그 키를 센다.
   */
  const leave = useMutation({
    mutationKey: getLeaveWorkspaceMutationKey(),
    meta: { suppressErrorToast: true },
    mutationFn: (variables: { workspaceId: string; workspaceName: string }) =>
      leaveWorkspace(variables.workspaceId, {
        workspaceName: variables.workspaceName,
      }),
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typedName, setTypedName] = useState("");
  const workspaceName = workspaceItems().find(
    (item) => item.workspaceId === workspaceId
  )?.name;
  const nameMatches =
    workspaceName !== undefined &&
    confirmationMatches(typedName, workspaceName);
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
          // 지난 실패 안내와 입력을 지우고 연다 — 상황이 바뀐 뒤에도 옛 문구가 붙어 있으면 안 된다.
          setLeaveError(null);
          setTypedName("");
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

          {workspaceName !== undefined ? (
            <ConfirmPhraseField
              phrase={workspaceName}
              value={typedName}
              onChange={setTypedName}
              disabled={leave.isPending}
            />
          ) : null}

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
              disabled={leave.isPending || !nameMatches}
              onClick={async () => {
                if (!workspaceName || !nameMatches) return;
                setLeaveError(null);
                const response = await leave
                  .mutateAsync({ workspaceId, workspaceName: typedName.trim() })
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
  function workspaceItems() {
    const response = workspacesQuery.data;
    return response !== undefined &&
      response.status === 200 &&
      response.data.success
      ? (response.data.data?.workspaces ?? [])
      : [];
  }

  function nextWorkspacePath() {
    const remaining = workspaceItems().filter(
      (item) => item.workspaceId !== workspaceId
    );
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
      <InviteHeading />
      <form onSubmit={submit} className={INVITE_FORM}>
        <div className={INVITE_ROW}>
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="invite-email" className="sr-only">
              초대할 이메일
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@gmail.com"
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
            {/* **`Controller` 로 잇는다.** `form.watch()` 는 매번 새 값을 돌려주는 API 라
                React Compiler 가 이 컴포넌트의 메모를 통째로 포기한다(컴파일 경고). */}
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select
                  items={ROLE_LABEL}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">멤버</SelectItem>
                    <SelectItem value="ADMIN">관리자</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
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
    <PendingInvitationsFrame>
      {isLoading ? (
        <PendingInvitationsSkeleton />
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
        <div className={PENDING_EMPTY}>
          <Info className="size-4 shrink-0 text-[var(--el-muted)]" />
          <p className="text-sm text-[var(--el-muted)]">
            대기 중인 초대가 없습니다.
          </p>
        </div>
      ) : (
        <ul className={SETTINGS_LIST}>
          {invitations.map((invitation) => (
            <li key={invitation.invitationId} className={SETTINGS_LIST_ROW}>
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
    </PendingInvitationsFrame>
  );
}

/** 「대기 중인 초대」 머리글과 본문 자리. 실제와 skeleton 이 같이 쓴다. */
function PendingInvitationsFrame({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-medium text-[var(--el-ink)]">
        대기 중인 초대
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function InviteHeading() {
  return (
    <>
      <h3 className="text-sm font-medium text-[var(--el-ink)]">멤버 초대</h3>
      <p className="mt-1 text-xs text-[var(--el-muted)]">
        이메일로 초대합니다. 미가입자도 초대 메일의 링크로 가입해 합류할 수
        있습니다.
      </p>
    </>
  );
}

const INVITE_FORM = "mt-3 space-y-3";
const INVITE_ROW = "flex flex-col gap-2 sm:flex-row sm:items-start";
/** 대기 중인 초대가 없을 때의 상자. 흔한 경우가 「없음」이라 skeleton 도 이 상자 모양으로 선다. */
const PENDING_EMPTY =
  "flex items-center gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-6";
/** skeleton 이 세우는 멤버 줄 수 — 목 시드의 흔한 워크스페이스(2명)다. */
const SKELETON_MEMBER_ROWS = 2;

/** `MemberRow` 와 같은 칸(아바타·이름 두 줄·역할 104·가입일 120·메뉴 32)에 값만 막대로 둔다. */
function MemberRowSkeleton() {
  return (
    <li className={SETTINGS_LIST_ROW}>
      <Skeleton className="size-7 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <SkeletonLine className="w-24" />
        <SkeletonLine size="xs" className="w-44" />
      </div>
      <div className="flex w-[104px] shrink-0 justify-end">
        <Skeleton className="h-8 w-[72px] rounded-control" />
      </div>
      <span className="hidden w-[120px] shrink-0 justify-end sm:flex">
        <SkeletonLine size="xs" className="w-20" />
      </span>
      <div className="w-8 shrink-0" />
    </li>
  );
}

/** 초대 폼 자리. 머리글·안내는 그대로, 입력 칸만 막대다. 역할 칸은 숨은 입력이 뒤에 붙어 4px 더 크다(`mb-1`). */
function InviteFormSkeleton() {
  return (
    <section>
      <InviteHeading />
      <div className={INVITE_FORM}>
        <div className={INVITE_ROW}>
          <Skeleton className="h-8 min-w-0 flex-1 rounded-control" />
          <Skeleton className="mb-1 h-8 w-[88px] rounded-control" />
          <Skeleton className="h-8 w-[60px] rounded-full" />
        </div>
      </div>
    </section>
  );
}

function PendingInvitationsSkeleton() {
  return (
    <div className={PENDING_EMPTY} aria-label="대기 중인 초대 불러오는 중">
      <SkeletonLine className="w-40" />
    </div>
  );
}
