"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertTriangle, Mail, UserPlus } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SettingsGap,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-chrome";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  getGetWorkspaceInvitationsQueryKey,
  useCancelWorkspaceInvitation,
  useCreateWorkspaceInvitation,
  useGetWorkspaceInvitations,
} from "@/lib/api/generated/workspace-invitations/workspace-invitations";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";
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
  const [inviting, setInviting] = useState(false);
  // 역할이 확정되기 전(로딩)이나 실패 시엔 관리 조작을 열지 않는다 — MEMBER에게 눌러 봤자
  // 403인 폼이 보이면 안 된다.
  const canManage = myRole === "ADMIN" && !membersQuery.isError;

  // 초대 목록은 ADMIN 전용 엔드포인트다 — 역할이 ADMIN으로 확정되기 전엔 부르지 않는다
  // (MEMBER가 열면 403 + 재시도만 쌓인다).
  const invitationsQuery = useGetWorkspaceInvitations(workspaceId, {
    query: { enabled: canManage },
  });

  return (
    <>
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
        <SettingsSection
          title="워크스페이스 멤버"
          count={`${members.length}명`}
          action={
            canManage ? (
              <Button
                type="button"
                variant="outline"
                className="h-8 px-2.5 text-[12px]"
                onClick={() => setInviting(true)}
              >
                <UserPlus className="size-3.5" />
                멤버 초대
              </Button>
            ) : undefined
          }
        >
          {members.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              isMe={member.userId === user?.userId}
            />
          ))}
        </SettingsSection>
      )}

      {canManage ? (
        <>
          <SettingsGap />
          <PendingInvitations
            workspaceId={workspaceId}
            isLoading={invitationsQuery.isLoading}
            isError={invitationsQuery.isError}
            invitations={pendingInvitationsOf(invitationsQuery.data)}
            onRetry={() => void invitationsQuery.refetch()}
          />
          {/* 초대 폼은 본문에 상주하지 않는다 — 늘 쓰는 것이 아니라 가끔 쓰는 명령이다.
              상주시키면 「멤버가 몇인지」를 보러 온 사람이 폼부터 읽는다(design.pen `u0Vrw4`). */}
          <Dialog
            open={inviting}
            onOpenChange={(open) => !open && setInviting(false)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>멤버 초대</DialogTitle>
              </DialogHeader>
              <InviteForm
                workspaceId={workspaceId}
                onDone={() => setInviting(false)}
              />
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </>
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

function MemberRow({
  member,
  isMe,
}: {
  member: WorkspaceMemberListResponseDataMembersItem;
  isMe: boolean;
}) {
  return (
    <SettingsRow
      label={isMe ? `${member.name} (나)` : member.name}
      description={member.email}
      icon={
        <span className="text-[11px] font-semibold text-[var(--el-body)]">
          {member.name.slice(0, 1)}
        </span>
      }
    >
      {/* 가입일은 뺐다 — 행에서 결정에 쓰이지 않는 유일한 값이었다(design.pen `u0Vrw4`). */}
      <RoleChip role={member.role} />
    </SettingsRow>
  );
}

function InviteForm({
  workspaceId,
  onDone,
}: {
  workspaceId: string;
  onDone: () => void;
}) {
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
      // 초대가 나갔으면 다이얼로그를 닫는다 — 결과는 「대기 중인 초대」 절이 말한다.
      onDone();
    } catch (error) {
      setInviteError(error);
    } finally {
      setIsSubmitting(false);
    }
  });

  // 서버가 이메일을 정규화하지 않아 가입자도 404가 될 수 있다 — 대소문자 힌트를 덧붙인다.
  const inviteMessage = inviteError
    ? errorCodeOf(inviteError) === "INVITEE_NOT_FOUND"
      ? `${errorMessageOf(inviteError, "초대할 사용자를 찾을 수 없습니다.")} 철자와 대소문자를 확인해 주세요.`
      : errorMessageOf(inviteError, "초대에 실패했습니다.")
    : null;

  const emailField = form.register("email");

  return (
    <>
      <p className="text-[12px] text-[var(--el-muted)]">
        가입한 사용자의 이메일로 초대합니다. 수락하면 워크스페이스에 합류합니다.
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
          <Button type="submit" loading={isSubmitting}>
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
    </>
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
  const cancel = useCancelWorkspaceInvitation({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getGetWorkspaceInvitationsQueryKey(workspaceId),
        }),
    },
  });

  return (
    <SettingsSection title="대기 중인 초대" note="수락 전에는 멤버가 아닙니다">
      <div>
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
          <SettingsRow label="대기 중인 초대가 없습니다" />
        ) : (
          <ul className="flex flex-col [&>*:last-child]:border-b-0">
            {invitations.map((invitation) => (
              <li
                key={invitation.invitationId}
                className="flex min-h-[58px] items-center gap-4 border-b border-[var(--el-hairline)]"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-control bg-[var(--el-surface-strong)]">
                  <Mail className="size-3.5 text-[var(--el-muted)]" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="truncate text-[13px] text-[var(--el-ink)]">
                    {invitation.inviteeEmail}
                  </span>
                  <span className="truncate text-[11px] text-[var(--el-muted)]">
                    {invitation.inviterName} ·{" "}
                    {formatAppDate(invitation.createdAt, {
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <RoleChip role={invitation.role} />
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
    </SettingsSection>
  );
}
