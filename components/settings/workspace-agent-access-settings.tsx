"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/auth/auth-provider";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  SETTINGS_CARD,
  SETTINGS_CARD_ICON,
  SettingsHeader,
  SkeletonCardIcon,
  SkeletonLine,
} from "@/components/settings/settings-layout";
import { Switch } from "@/components/ui/switch";
import {
  getGetAgentDelegationsQueryKey,
  getGetWorkspaceAgentDelegationsQueryKey,
  useChangeWorkspaceAgentAccess,
  useGetWorkspaceAgentDelegations,
  useRevokeWorkspaceAgentDelegation,
} from "@/lib/api/generated/agent-delegation/agent-delegation";
import type { WorkspaceAgentDelegationsResponseDataDelegationsItem } from "@/lib/api/generated/models";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";
import {
  getGetWorkspaceQueryKey,
  getGetWorkspacesQueryKey,
  useGetWorkspace,
} from "@/lib/api/generated/workspaces/workspaces";
import { formatAppDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";

type Delegation = WorkspaceAgentDelegationsResponseDataDelegationsItem;

const DATE = { year: "numeric", month: "long", day: "numeric" } as const;

export function WorkspaceAgentAccessSettings({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const t = useTranslations("settings.workspaceAgents");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const workspaceQuery = useGetWorkspace(workspaceId, {
    query: { staleTime: 0 },
  });
  const membersQuery = useGetWorkspaceMembers(workspaceId);
  const members =
    membersQuery.data?.status === 200 && membersQuery.data.data.success
      ? (membersQuery.data.data.data?.members ?? [])
      : [];
  const myRole = members.find((member) => member.userId === user?.userId)?.role;
  const roleError = membersQuery.isError;
  const isAdmin = myRole === "ADMIN" && !roleError;
  const delegationsQuery = useGetWorkspaceAgentDelegations(workspaceId, {
    query: { enabled: isAdmin, staleTime: 0 },
  });
  const change = useChangeWorkspaceAgentAccess();
  const [confirmOff, setConfirmOff] = useState(false);

  const workspace =
    workspaceQuery.data?.status === 200 && workspaceQuery.data.data.success
      ? workspaceQuery.data.data.data
      : null;
  const delegations =
    delegationsQuery.data?.status === 200 && delegationsQuery.data.data.success
      ? delegationsQuery.data.data.data.delegations
      : null;

  const refresh = () =>
    Promise.all(
      [
        getGetWorkspaceQueryKey(workspaceId),
        getGetWorkspacesQueryKey(),
        getGetWorkspaceAgentDelegationsQueryKey(workspaceId),
        getGetAgentDelegationsQueryKey(),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
    );

  const setAllowed = async (allowed: boolean) => {
    const response = await change
      .mutateAsync({ workspaceId, data: { allowed } })
      .catch(() => null);
    if (response?.status !== 204) return;
    await refresh();
    setConfirmOff(false);
  };

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <SettingsHeader
        title={t("title")}
        description={t("description")}
      />

      {workspaceQuery.isLoading ? (
        <section
          aria-label={t("loading")}
          className={cn(CARD_ROW, SETTINGS_CARD)}
        >
          <div className="min-w-0">
            <AllowTitle />
            <span className="mt-1 block">
              <SkeletonLine size="xs" className="w-72" />
            </span>
          </div>
          <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
        </section>
      ) :
      workspaceQuery.isError || !workspace ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-[var(--el-ink)]">
            {t("loadFailed")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-[30px]"
            onClick={() => void workspaceQuery.refetch()}
          >
            {tActions("retry")}
          </Button>
        </div>
      ) : (
        <section
          aria-label={t("allow.title")}
          className={cn(CARD_ROW, SETTINGS_CARD)}
        >
          <div className="min-w-0">
            <AllowTitle />
            <p className="mt-1 text-xs text-[var(--el-muted)]">
              {workspace.agentAccessAllowed
                ? t("allow.on")
                : t("allow.off")}
            </p>
          </div>
          {isAdmin ? (
            <Switch
              aria-label={t("allow.title")}
              checked={workspace.agentAccessAllowed}
              disabled={change.isPending}
              onCheckedChange={(checked) =>
                checked ? void setAllowed(true) : setConfirmOff(true)
              }
            />
          ) : (
            <Badge
              variant={workspace.agentAccessAllowed ? "success" : "outline"}
            >
              {workspace.agentAccessAllowed ? t("allow.onBadge") : t("allow.offBadge")}
            </Badge>
          )}
        </section>
      )}

      {roleError ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-relaxed text-[var(--el-muted)]">
              {t("roleFailed")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-[30px]"
              onClick={() => void membersQuery.refetch()}
            >
              {tActions("retry")}
            </Button>
          </div>
        </div>
      ) : myRole === "MEMBER" ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
          <p className="text-xs leading-relaxed text-[var(--el-muted)]">
            {t("adminOnly")}
          </p>
        </div>
      ) : null}

      {isAdmin ? (
        <OpenConnectionsFrame>
          {delegationsQuery.isLoading ? (
            <DelegationRowsSkeleton />
          ) :
          delegationsQuery.isError || !delegations ? (
            <div role="alert" className="space-y-2">
              <p className="text-sm text-[var(--el-ink)]">
                {t("open.loadFailed")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-[30px]"
                onClick={() => void delegationsQuery.refetch()}
              >
                {tActions("retry")}
              </Button>
            </div>
          ) : delegations.length === 0 ? (
            <div className="rounded-panel border border-dashed border-[var(--el-hairline)] p-6 text-center">
              <p className="text-sm text-[var(--el-ink)]">
                {t("open.empty")}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {delegations.map((delegation) => (
                <WorkspaceDelegationRow
                  key={delegation.delegationId}
                  workspaceId={workspaceId}
                  delegation={delegation}
                  busy={change.isPending}
                  onRevoked={refresh}
                />
              ))}
            </ul>
          )}
        </OpenConnectionsFrame>
      ) : membersQuery.isLoading ? (
        <OpenConnectionsFrame placeholder>
          <DelegationRowsSkeleton />
        </OpenConnectionsFrame>
      ) : null}

      <AlertDialog
        open={confirmOff}
        onOpenChange={(open) => {
          if (change.isPending) return;
          setConfirmOff(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("offDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {delegations && !delegationsQuery.isError
                ? t("offDialog.descriptionCount", {
                    count: delegations.length,
                  })
                : t("offDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={change.isPending}>
              {tActions("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={change.isPending}
              disabled={change.isPending}
              onClick={() => void setAllowed(false)}
            >
              {t("offDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WorkspaceDelegationRow({
  workspaceId,
  delegation,
  busy,
  onRevoked,
}: {
  workspaceId: string;
  delegation: Delegation;
  busy: boolean;
  onRevoked: () => Promise<unknown>;
}) {
  const t = useTranslations("settings.workspaceAgents");
  const tAgents = useTranslations("settings.agentConnections");
  const tActions = useTranslations("common.actions");
  const dateLocale = useDisplayLocale();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const revoke = useRevokeWorkspaceAgentDelegation();

  return (
    <li className={cn(CARD_ROW, SETTINGS_CARD)}>
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn(SETTINGS_CARD_ICON, "bg-[var(--el-canvas-soft)]")}>
          <Bot className="size-4 text-[var(--el-muted)]" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-[var(--el-ink)]">
              {delegation.name}
            </p>
            <Badge variant="outline">
              {tAgents(`credential.${delegation.credentialKind}`)}
            </Badge>
            {delegation.allowTaskChanges ? (
              <Badge variant="outline">{tAgents("taskChanges")}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[var(--el-muted)]">
            {delegation.userName}
          </p>
          <p className="mt-0.5 text-xs text-[var(--el-muted)]">
            {t("row.meta", {
              connected: formatAppDate(delegation.createdAt, DATE, dateLocale),
              lastUsed: delegation.lastUsedAt
                ? formatAppDate(delegation.lastUsedAt, DATE, dateLocale)
                : t("row.neverUsed"),
            })}
          </p>
        </div>
      </div>
      <Button
        variant="destructive"
        size="sm"
        className="h-8 shrink-0"
        disabled={busy}
        onClick={() => setConfirmOpen(true)}
      >
        {t("row.disconnect")}
      </Button>
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (revoke.isPending) return;
          setConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("row.dialog.title", { name: delegation.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("row.dialog.description", { user: delegation.userName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>
              {tActions("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={revoke.isPending}
              disabled={revoke.isPending}
              onClick={async () => {
                const response = await revoke
                  .mutateAsync({
                    workspaceId,
                    delegationId: delegation.delegationId,
                  })
                  .catch(() => null);
                if (response?.status !== 204) return;
                await onRevoked();
                setConfirmOpen(false);
              }}
            >
              {t("row.disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

const CARD_ROW = "flex items-center justify-between gap-4";
const SKELETON_DELEGATIONS = 2;

function AllowTitle() {
  const t = useTranslations("settings.workspaceAgents.allow");
  return (
    <p className="text-sm font-medium text-[var(--el-ink)]">{t("title")}</p>
  );
}

function OpenConnectionsFrame({
  placeholder = false,
  children,
}: {
  placeholder?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("settings.workspaceAgents.open");
  return (
    <section
      aria-label={t("title")}
      aria-hidden={placeholder || undefined}
      className="mt-8"
    >
      <h3 className="text-sm font-medium text-[var(--el-ink)]">{t("title")}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DelegationRowsSkeleton() {
  const t = useTranslations("settings.workspaceAgents.open");
  return (
    <div className="space-y-3" aria-label={t("loading")}>
      {Array.from({ length: SKELETON_DELEGATIONS }, (_, index) => (
        <div key={index} className={cn(CARD_ROW, SETTINGS_CARD)}>
          <div className="flex min-w-0 items-start gap-3">
            <SkeletonCardIcon />
            <div className="min-w-0">
              <SkeletonLine className="w-32" />
              <span className="mt-1 block">
                <SkeletonLine size="xs" className="w-14" />
              </span>
              <span className="mt-0.5 block">
                <SkeletonLine size="xs" className="w-56" />
              </span>
            </div>
          </div>
          <Skeleton className="h-8 w-11 shrink-0 rounded-control" />
        </div>
      ))}
    </div>
  );
}
