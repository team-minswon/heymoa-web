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

/**
 * 워크스페이스 외부 에이전트 관리(APP-941). 팀이 바깥 에이전트의 연결을 받을지 정하고 열린 연결을 끊는다 —
 * 연결 자체는 팀원 본인이 「계정 › 외부 에이전트」에서 만든다.
 *
 * 항목은 모두에게 보이지만 **바꾸는 것은 ADMIN 뿐**이다. 역할은 연동 탭처럼 멤버 목록에서 가르고, 역할을 모르는
 * 동안 관리 UI 를 그리지 않는다(낙관적으로 그리면 MEMBER 에게 눌러 봤자 403 인 조작이 보인다). 관리자 목록도
 * ADMIN 전용이라 MEMBER 는 부르지 않는다.
 *
 * 끄기와 끊기는 되돌릴 수 없어 확인을 거친다. 켜기는 아무것도 되살리지 않으니 바로 켠다.
 */
export function WorkspaceAgentAccessSettings({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const t = useTranslations("settings.workspaceAgents");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // 허용 상태도 다른 관리자가 바꾼다 — 열 때마다 다시 읽는다(아래 목록과 같은 이유)
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
  // 다른 팀원·계정 탭·다른 창(OAuth 허락)에서 바뀌는 목록이라 열 때마다 다시 읽는다 — 전역 staleTime(60초)을
  // 따르면 방금 만든 연결이 안 보여 끊을 수 없다
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

  // 끄기·켜기·끊기 뒤에 다시 읽는다 — ADMIN 본인의 연결도 끊겼을 수 있어 「내 연결」까지
  const refresh = () =>
    Promise.all(
      [
        getGetWorkspaceQueryKey(workspaceId),
        getGetWorkspacesQueryKey(),
        getGetWorkspaceAgentDelegationsQueryKey(workspaceId),
        getGetAgentDelegationsQueryKey(),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
    );

  // 거절은 여기서 소비한다 — 토스트는 전역 `MutationCache.onError` 가 띄운다
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
      ) : // 다시 읽다 실패하면 캐시가 남아도 옛 값 대신 실패를 보인다 — 옛 「켜짐」을 보고 끄기를 누르게 된다
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
          ) : // 캐시가 남아도 실패를 「열린 연결이 없습니다」나 옛 목록으로 접지 않는다
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
            // 실패가 아니다 — 경고 색·아이콘을 쓰지 않는다
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
        // 역할을 모르는 동안은 관리자 자리를 잡아 둔다 — 멤버 탭과 같은 이유다(`members-settings`). 관리 UI 가 아니라
        // 자리일 뿐이라 보조기술에는 숨긴다.
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
  /** 허용을 바꾸는 중이다 — 끊기와 겹치지 않게 잠근다. */
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
            {/* OAuth 이름은 에이전트가 스스로 정해 사칭될 수 있다 — 무엇으로 붙었는지 함께 보인다 */}
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
                // 다이얼로그를 연 채 기다린다(본인 회수와 같다). 거절은 전역 토스트가 띄운다
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
/** skeleton 이 세우는 열린 연결 수 — 목 시드의 흔한 워크스페이스(2개)다. */
const SKELETON_DELEGATIONS = 2;

function AllowTitle() {
  const t = useTranslations("settings.workspaceAgents.allow");
  return (
    <p className="text-sm font-medium text-[var(--el-ink)]">{t("title")}</p>
  );
}

/** 「열린 연결」 머리글과 본문 자리. 실제와 skeleton 이 같이 쓴다. */
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

/** `WorkspaceDelegationRow` 와 같은 틀(이름 줄·팀원 줄·날짜 줄·끊기)에 값만 막대로 둔다. */
function DelegationRowsSkeleton() {
  const t = useTranslations("settings.workspaceAgents.open");
  return (
    // 목록(`ul`)으로 세우지 않는다 — 도착 전의 자리가 연결 목록으로 읽히면 안 된다.
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
