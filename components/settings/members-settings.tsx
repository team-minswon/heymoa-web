"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
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
import {
  getGetWorkspaceQueryKey,
  useGetWorkspaces,
} from "@/lib/api/generated/workspaces/workspaces";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { forgetWorkspace } from "@/lib/workspace/cache";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";
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
    .min(1, "emailRequired")
    .email("emailInvalid"),
  role: z.enum(["MEMBER", "ADMIN"]),
});
type InviteValues = z.infer<typeof inviteSchema>;

function isEmailErrorKey(
  message: string
): message is "emailRequired" | "emailInvalid" {
  return message === "emailRequired" || message === "emailInvalid";
}

function useRoleLabels(): Record<string, string> {
  const t = useTranslations("settings.members.roles");
  return { ADMIN: t("ADMIN"), MEMBER: t("MEMBER") };
}

const MEMBER_MUTATION_KEYS = new Set([
  "changeWorkspaceMemberRole",
  "removeWorkspaceMember",
  "leaveWorkspace",
]);

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

function memberLabel(member: WorkspaceMemberListResponseDataMembersItem) {
  return `${member.name}(${member.email})`;
}

function RoleChip({ role }: { role: string }) {
  const roleLabels = useRoleLabels();
  return (
    <Badge variant={role === "ADMIN" ? "secondary" : "outline"}>
      {roleLabels[role] ?? role}
    </Badge>
  );
}

export function MembersSettings({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("settings.members");
  const tActions = useTranslations("common.actions");
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
  const myUserId = user?.userId;
  const orderedMembers = myUserId
    ? [...members].sort(
        (a, b) => Number(b.userId === myUserId) - Number(a.userId === myUserId)
      )
    : members;
  const canManage = myRole === "ADMIN" && !membersQuery.isError;

  const invitationsQuery = useGetWorkspaceInvitations(workspaceId, {
    query: { enabled: canManage },
  });
  const [renaming, setRenaming] =
    useState<WorkspaceMemberListResponseDataMembersItem | null>(null);

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <SettingsHeader
        title={t("title")}
        description={t("description")}
      />

      {membersQuery.isLoading ? (
        <ul className={SETTINGS_LIST} aria-label={t("loading")}>
          {Array.from({ length: SKELETON_MEMBER_ROWS }, (_, index) => (
            <MemberRowSkeleton key={index} />
          ))}
        </ul>
      ) : membersQuery.isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-[var(--el-ink)]">
            {t("loadFailed")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-[30px]"
            onClick={() => void membersQuery.refetch()}
          >
            {tActions("retry")}
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
  const t = useTranslations("settings.members");
  const tActions = useTranslations("common.actions");
  const roleLabels = useRoleLabels();
  const dateLocale = useDisplayLocale();
  const invalidateMembers = useInvalidateMembers(workspaceId);
  const changeRole = useChangeWorkspaceMemberRole({
    mutation: { onSettled: invalidateMembers },
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = useMemberMutationBusy(workspaceId);
  const names = memberNameOf(member);
  const canRename = isMe || canManage;
  const canRemove = canManage && !isMe;

  return (
    <li className={SETTINGS_LIST_ROW}>
      <PersonAvatar name={member.userId} image={member.image} size={28} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--el-ink)]">
          <SoftName name={member.name} className="truncate" />
          {isMe ? (
            <span className="shrink-0 text-xs font-normal text-[var(--el-muted)]">
              {t("me")}
            </span>
          ) : null}
        </p>
        <p className="truncate text-xs text-[var(--el-muted)]">
          {names.displayName !== null &&
          names.displayName !== names.accountName ? (
            <>{t("accountName", { name: names.accountName })} · </>
          ) : null}
          {member.email}
        </p>
      </div>

      <div className="flex w-[104px] shrink-0 justify-end">
        {canManage ? (
          <Select
            items={roleLabels}
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
            <SelectTrigger aria-label={t("roleLabel", { member: memberLabel(member) })}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MEMBER">{roleLabels.MEMBER}</SelectItem>
              <SelectItem value="ADMIN">{roleLabels.ADMIN}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <RoleChip role={member.role} />
        )}
      </div>

      <p className="hidden w-[120px] shrink-0 text-right text-xs text-[var(--el-muted)] sm:block">
        {formatAppDate(
          member.joinedAt,
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          },
          dateLocale
        )}
      </p>

      <div className="flex w-8 shrink-0 justify-end">
        {canRename ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("manageLabel", { member: memberLabel(member) })}
                  className="rounded-full text-[var(--el-muted)] transition-colors hover:text-[var(--el-ink)]"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem onClick={onRename}>
                {tActions("rename")}
              </DropdownMenuItem>
              {canRemove ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {t("remove")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <RemoveMemberDialog
        workspaceId={workspaceId}
        member={member}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      />
    </li>
  );
}

function useInvalidateMembers(workspaceId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: getGetWorkspaceMembersQueryKey(workspaceId),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetWorkspaceQueryKey(workspaceId),
      }),
      invalidateWorkspaceBilling(queryClient, workspaceId),
    ]);
}

function RemoveMemberDialog({
  workspaceId,
  member,
  open: confirmOpen,
  onOpenChange,
}: {
  workspaceId: string;
  member: WorkspaceMemberListResponseDataMembersItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("settings.members");
  const tActions = useTranslations("common.actions");
  const invalidateMembers = useInvalidateMembers(workspaceId);
  const remove = useRemoveWorkspaceMember({
    mutation: { onSettled: invalidateMembers },
  });

  return (
    <AlertDialog
      open={confirmOpen}
      onOpenChange={(open) => {
        if (remove.isPending) return;
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("removeDialog.title", { name: member.name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("removeDialog.description", { email: member.email })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            {tActions("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            loading={remove.isPending}
            disabled={remove.isPending}
            onClick={async () => {
              const response = await remove
                .mutateAsync({ workspaceId, userId: member.userId })
                .catch(() => null);
              if (response?.status !== 204) return;
              onOpenChange(false);
            }}
          >
            {t("remove")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RenameMemberDialog({
  workspaceId,
  member,
  onClose,
}: {
  workspaceId: string;
  member: WorkspaceMemberListResponseDataMembersItem;
  onClose: () => void;
}) {
  const t = useTranslations("settings.members.renameDialog");
  const [opened] = useState(() => memberNameOf(member));
  const { rename } = useRenameMember({ workspaceId, member: opened });
  return (
    <RenamePersonDialog
      avatarKey={member.userId}
      image={member.image}
      currentName={opened.name}
      secondary={member.email}
      label={t("label")}
      initialValue={opened.displayName ?? ""}
      placeholder={opened.accountName}
      hint={t("hint", { name: opened.accountName })}
      allowEmpty
      onSubmit={rename}
      onClose={onClose}
    />
  );
}

function LeaveWorkspaceSection({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("settings.members.leave");
  const tActions = useTranslations("common.actions");
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspacesQuery = useGetWorkspaces();
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
  const recordingHere = isWorkspaceRecordingActive(useRecording(), workspaceId);

  const leaveMessage = leaveError
    ? errorMessageOf(leaveError, t("failed"))
    : null;

  return (
    <section className="mt-8 border-t border-[var(--el-hairline)] pt-8">
      <h3 className="text-sm font-medium text-[var(--el-ink)]">
        {t("title")}
      </h3>
      <p className="mt-1 text-xs text-[var(--el-muted)]">
        {t("description")}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 h-[30px]"
        loading={leave.isPending}
        disabled={busy || recordingHere}
        onClick={() => {
          setLeaveError(null);
          setTypedName("");
          setConfirmOpen(true);
        }}
      >
        {t("title")}
      </Button>

      {recordingHere ? (
        <p role="status" className="mt-2 text-xs text-[var(--el-muted)]">
          {t("recordingBlocked")}
        </p>
      ) : null}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (leave.isPending) return;
          setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialog.description")}
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
              {tActions("cancel")}
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
                const destination = nextWorkspacePath();
                forgetWorkspace(queryClient, workspaceId);
                void queryClient.invalidateQueries();
                router.replace(destination);
              }}
            >
              {t("dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );

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
    return next ? `/w/${next}` : "/";
  }
}

function InviteForm({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("settings.members.invite");
  const roleLabels = useRoleLabels();
  const queryClient = useQueryClient();
  const create = useCreateWorkspaceInvitation({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [inviteError, setInviteError] = useState<unknown>(null);
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
    ? errorMessageOf(inviteError, t("failed"))
    : null;

  const emailField = form.register("email");
  const emailError = form.formState.errors.email?.message;

  return (
    <section>
      <InviteHeading />
      <form onSubmit={submit} className={INVITE_FORM}>
        <div className={INVITE_ROW}>
          <div className="min-w-0 flex-1 space-y-1">
            <Label htmlFor="invite-email" className="sr-only">
              {t("emailLabel")}
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
                if (inviteError) setInviteError(null);
                void emailField.onChange(event);
              }}
            />
            {emailError !== undefined ? (
              <p className="text-xs text-[var(--el-error)]">
                {isEmailErrorKey(emailError) ? t(emailError) : emailError}
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="invite-role" className="sr-only">
              {t("roleLabel")}
            </Label>
            {/* **`Controller` 로 잇는다.** `form.watch()` 는 매번 새 값을 돌려주는 API 라
                React Compiler 가 이 컴포넌트의 메모를 통째로 포기한다(컴파일 경고). */}
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select
                  items={roleLabels}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">{roleLabels.MEMBER}</SelectItem>
                    <SelectItem value="ADMIN">{roleLabels.ADMIN}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <Button type="submit" loading={isSubmitting} className="rounded-full">
            {t("submit")}
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
  const t = useTranslations("settings.members.pending");
  const tActions = useTranslations("common.actions");
  const dateLocale = useDisplayLocale();
  const queryClient = useQueryClient();
  // 만료 판정은 렌더 시점 1회 고정 — hydration 불일치 방지. 서버는 만료 PENDING을
  // 처리 시점에 EXPIRED로 밀므로 이 판정은 그 사이의 표시용이다.
  const [now] = useState(() => Date.now());
  const cancel = useCancelWorkspaceInvitation({
    mutation: {
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
            {t("loadFailed")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-[30px]"
            onClick={onRetry}
          >
            {tActions("retry")}
          </Button>
        </div>
      ) : invitations.length === 0 ? (
        <div className={PENDING_EMPTY}>
          <Info className="size-4 shrink-0 text-[var(--el-muted)]" />
          <p className="text-sm text-[var(--el-muted)]">
            {t("empty")}
          </p>
        </div>
      ) : (
        <ul className={SETTINGS_LIST}>
          {invitations.map((invitation) => (
            <li key={invitation.invitationId} className={SETTINGS_LIST_ROW}>
              <div className="min-w-0 flex-1">
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
                <Badge variant="outline">{t("expired")}</Badge>
              )}
              <RoleChip role={invitation.role} />
              <p className="hidden w-[160px] shrink-0 text-right text-xs text-[var(--el-muted)] sm:block">
                {invitation.inviterName} ·{" "}
                {formatAppDate(
                  invitation.createdAt,
                  {
                    month: "long",
                    day: "numeric",
                  },
                  dateLocale
                )}
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
                {tActions("cancel")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </PendingInvitationsFrame>
  );
}

function PendingInvitationsFrame({ children }: { children: React.ReactNode }) {
  const t = useTranslations("settings.members.pending");
  return (
    <section>
      <h3 className="text-sm font-medium text-[var(--el-ink)]">
        {t("title")}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function InviteHeading() {
  const t = useTranslations("settings.members.invite");
  return (
    <>
      <h3 className="text-sm font-medium text-[var(--el-ink)]">
        {t("title")}
      </h3>
      <p className="mt-1 text-xs text-[var(--el-muted)]">{t("description")}</p>
    </>
  );
}

const INVITE_FORM = "mt-3 space-y-3";
const INVITE_ROW = "flex flex-col gap-2 sm:flex-row sm:items-start";
const PENDING_EMPTY =
  "flex items-center gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-6";
const SKELETON_MEMBER_ROWS = 2;

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
  const t = useTranslations("settings.members.pending");
  return (
    <div className={PENDING_EMPTY} aria-label={t("loading")}>
      <SkeletonLine className="w-40" />
    </div>
  );
}
