"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertTriangle, Info, UsersRound } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-[var(--el-muted)] uppercase">
          <UsersRound className="size-3.5" />
          Members
        </p>
        <h2 className="mt-2 font-serif text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
          멤버
        </h2>
        <p className="mt-2 text-sm text-[var(--el-muted)]">
          이 워크스페이스의 멤버와 대기 중인 초대를 관리합니다.
        </p>
      </header>

      {membersQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-[52px] rounded-xl" />
          <Skeleton className="h-[52px] rounded-xl" />
          <Skeleton className="h-[52px] rounded-xl" />
        </div>
      ) : membersQuery.isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-[var(--el-ink)]">멤버를 불러오지 못했습니다.</p>
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
        <ul className="divide-y divide-[var(--el-hairline)] overflow-hidden rounded-2xl border border-[var(--el-hairline)] bg-white">
          {members.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              isMe={member.userId === user?.userId}
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

function MemberRow({
  member,
  isMe,
}: {
  member: WorkspaceMemberListResponseDataMembersItem;
  isMe: boolean;
}) {
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
        <p className="truncate text-xs text-[var(--el-muted)]">{member.email}</p>
      </div>
      <RoleChip role={member.role} />
      <p className="w-[120px] shrink-0 text-right text-xs text-[var(--el-muted)]">
        {formatAppDate(member.joinedAt, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>
    </li>
  );
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

  // 서버가 이메일을 정규화하지 않아 가입자도 404가 될 수 있다 — 대소문자 힌트를 덧붙인다.
  const inviteMessage = inviteError
    ? errorCodeOf(inviteError) === "INVITEE_NOT_FOUND"
      ? `${errorMessageOf(inviteError, "초대할 사용자를 찾을 수 없습니다.")} 철자와 대소문자를 확인해 주세요.`
      : errorMessageOf(inviteError, "초대에 실패했습니다.")
    : null;

  const emailField = form.register("email");

  return (
    <section>
      <h3 className="text-sm font-medium text-[var(--el-ink)]">멤버 초대</h3>
      <p className="mt-1 text-xs text-[var(--el-muted)]">
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
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
            className="flex items-start gap-2 rounded-xl border border-[var(--el-error)]/25 bg-[var(--el-error)]/[0.06] px-3 py-2.5"
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
  const cancel = useCancelWorkspaceInvitation({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getGetWorkspaceInvitationsQueryKey(workspaceId),
        }),
    },
  });

  return (
    <section>
      <h3 className="text-sm font-medium text-[var(--el-ink)]">대기 중인 초대</h3>
      <div className="mt-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-[52px] rounded-xl" />
            <Skeleton className="h-[52px] rounded-xl" />
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
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-6">
            <Info className="size-4 shrink-0 text-[var(--el-muted)]" />
            <p className="text-sm text-[var(--el-muted)]">
              대기 중인 초대가 없습니다.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--el-hairline)] overflow-hidden rounded-2xl border border-[var(--el-hairline)] bg-white">
            {invitations.map((invitation) => (
              <li
                key={invitation.invitationId}
                className="flex min-h-[52px] items-center gap-3 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--el-ink)]">
                    {invitation.inviteeName}
                  </p>
                  <p className="truncate text-xs text-[var(--el-muted)]">
                    {invitation.inviteeEmail}
                  </p>
                </div>
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
