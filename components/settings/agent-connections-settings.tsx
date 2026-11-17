"use client";

import { useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  AGENT_ACCESS_DISABLED,
  AgentAccessBlockedNotice,
  useWorkspaceOptionLabel,
} from "@/components/agent-connections/agent-access-blocked";
import { AgentAccessNotice } from "@/components/agent-connections/agent-access-notice";
import { TaskChangesToggle } from "@/components/agent-connections/task-changes-toggle";
import { AgentOAuthGuide } from "@/components/agent-connections/agent-oauth-guide";
import { CopyBlock } from "@/components/agent-connections/copy-block";

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
import { Collapse } from "@/components/heymoa/collapse";
import { Button } from "@/components/ui/button";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SETTINGS_CARD,
  SETTINGS_CARD_ICON,
  SettingsHeader,
  SkeletonCardIcon,
  SkeletonLine,
} from "@/components/settings/settings-layout";
import { errorCodeOf } from "@/lib/api/error-message";
import { buildUrl } from "@/lib/api/fetcher";
import {
  getAgentDelegationUsages,
  getGetAgentDelegationUsagesQueryKey,
  getGetAgentDelegationsQueryKey,
  useCreateAgentDelegation,
  useGetAgentDelegations,
  useRevokeAgentDelegation,
} from "@/lib/api/generated/agent-delegation/agent-delegation";
import type {
  AgentDelegationsResponseDataDelegationsItem,
  GetAgentDelegationUsagesParams,
} from "@/lib/api/generated/models";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { formatAppDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { HelpLink } from "@/components/heymoa/help-link";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";

type Delegation = AgentDelegationsResponseDataDelegationsItem;

const NAME_MAX_LENGTH = 50;

const DATE = { year: "numeric", month: "long", day: "numeric" } as const;
const DATE_TIME = {
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
} as const;

const TOOL_NAMES = [
  "get_connection",
  "list_projects",
  "list_project_items",
  "get_project_item",
  "expand_relations",
  "list_open_tasks",
  "list_meetings",
  "get_meeting",
  "get_meeting_record",
  "get_meeting_summary",
  "list_meeting_agendas",
  "list_meeting_links",
  "get_meeting_transcript",
  "search",
  "create_tasks",
  "update_tasks",
  "open_screen",
] as const;
const isKnownTool = (name: string): name is (typeof TOOL_NAMES)[number] =>
  (TOOL_NAMES as readonly string[]).includes(name);

const USAGE_STEP = 8;
export function AgentConnectionsSettings({
  workspaceId,
  onBusyChange,
}: {
  workspaceId: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useTranslations("settings.agentConnections");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const delegationsQuery = useGetAgentDelegations();
  // OAuth 연결은 에이전트가 연 다른 브라우저 창에서 허락하므로, 이 창으로 돌아오면 목록을 다시 읽는다.
  // TanStack 의 창 포커스 재조회는 visibilitychange 만 보고 staleTime(60초)도 따라, 두 창을 나란히 둔 채
  // 돌아오거나 곧바로 돌아온 사람에게 새 연결이 안 보인다 — 창 focus 에서 캐시와 상관없이 읽는다
  const { refetch: refetchDelegations } = delegationsQuery;
  useEffect(() => {
    const refresh = () => void refetchDelegations();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refetchDelegations]);
  const [mode, setMode] = useState<"guide" | "token" | null>(null);
  const [issued, setIssued] = useState<{ name: string; token: string } | null>(
    null
  );
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getGetAgentDelegationsQueryKey(),
    });

  const response = delegationsQuery.data;
  const delegations =
    response?.status === 200 && response.data.success
      ? (response.data.data?.delegations ?? [])
      : [];
  const active = delegations.filter(
    (delegation) => delegation.status === "ACTIVE"
  );
  const past = delegations.filter(
    (delegation) => delegation.status !== "ACTIVE"
  );

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <SettingsHeader
        title={t("title")}
        description={
          <>
            {t("description")} <HelpLink topic="agent-mcp" />
          </>
        }
        action={
          !mode && !issued ? (
            <Button
              size="sm"
              className="h-8 shrink-0"
              onClick={() => setMode("guide")}
            >
              {t("newConnection")}
            </Button>
          ) : null
        }
      />

      {issued ? (
        <IssuedToken
          name={issued.name}
          token={issued.token}
          onClose={() => setIssued(null)}
        />
      ) : mode === "guide" ? (
        <AgentOAuthGuide
          onPersonalToken={() => setMode("token")}
          onClose={() => {
            setMode(null);
            void invalidate();
          }}
        />
      ) : mode === "token" ? (
        <NewConnectionForm
          defaultWorkspaceId={workspaceId}
          onBusyChange={onBusyChange}
          onCancel={() => setMode(null)}
          onCreated={async (name, token) => {
            setMode(null);
            setIssued({ name, token });
            await invalidate();
          }}
        />
      ) : null}

      <section aria-label={t("list.label")} className="mt-6">
        {delegationsQuery.isLoading ? (
          <div aria-label={t("list.loading")}>
            <ul className="space-y-3">
              {Array.from({ length: SKELETON_DELEGATIONS }, (_, index) => (
                <DelegationRowSkeleton key={index} />
              ))}
            </ul>
            <Skeleton className="mt-6 h-8 w-24 rounded-control" />
          </div>
        ) : delegationsQuery.isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-[var(--el-ink)]">
              {t("list.loadFailed")}
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
        ) : (
          <>
            {active.length === 0 ? (
              <div className="rounded-panel border border-dashed border-[var(--el-hairline)] p-6 text-center">
                <p className="text-sm text-[var(--el-ink)]">
                  {past.length === 0
                    ? t("list.emptyNever")
                    : t("list.emptyNow")}
                </p>
                <p className="mt-1 text-xs text-[var(--el-muted)]">
                  {t("list.emptyHint")}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {active.map((delegation) => (
                  <DelegationRow
                    key={delegation.delegationId}
                    delegation={delegation}
                    onRevoked={invalidate}
                  />
                ))}
              </ul>
            )}
            {past.length > 0 ? (
              <PastConnections delegations={past} onRevoked={invalidate} />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function PastConnections({
  delegations,
  onRevoked,
}: {
  delegations: Delegation[];
  onRevoked: () => Promise<unknown>;
}) {
  const t = useTranslations("settings.agentConnections.past");
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 px-2 text-xs text-[var(--el-muted)]"
        aria-expanded={open}
        aria-controls="agent-past-connections"
        onClick={() => setOpen((value) => !value)}
      >
        {t("toggle", { count: delegations.length })}
        <ChevronDown
          className={`size-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </Button>
      <Collapse open={open} lazy>
        <ul
          id="agent-past-connections"
          aria-label={t("label")}
          className="mt-3 space-y-3"
        >
          {delegations.map((delegation) => (
            <DelegationRow
              key={delegation.delegationId}
              delegation={delegation}
              onRevoked={onRevoked}
            />
          ))}
        </ul>
      </Collapse>
    </div>
  );
}

function NewConnectionForm({
  defaultWorkspaceId,
  onBusyChange,
  onCancel,
  onCreated,
}: {
  defaultWorkspaceId: string;
  onBusyChange?: (busy: boolean) => void;
  onCancel: () => void;
  onCreated: (name: string, token: string) => Promise<void>;
}) {
  const t = useTranslations("settings.agentConnections.form");
  const tActions = useTranslations("common.actions");
  const optionLabel = useWorkspaceOptionLabel();
  const workspacesQuery = useGetWorkspaces();
  const workspaces =
    workspacesQuery.data?.status === 200 && workspacesQuery.data.data.success
      ? workspacesQuery.data.data.data.workspaces
      : [];
  const workspacesFailed =
    workspacesQuery.isError ||
    (workspacesQuery.data !== undefined && workspaces.length === 0);
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId);
  const [name, setName] = useState("");
  const [allowTaskChanges, setAllowTaskChanges] = useState(false);
  const create = useCreateAgentDelegation({
    mutation: {
      gcTime: 0,
      meta: { suppressErrorToast: [AGENT_ACCESS_DISABLED] },
    },
  });
  useEffect(() => {
    onBusyChange?.(create.isPending);
  }, [create.isPending, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const trimmed = name.trim();
  const items = Object.fromEntries(
    workspaces.map((workspace) => [
      workspace.workspaceId,
      optionLabel(workspace),
    ])
  );
  const selected = workspaces.find(
    (workspace) => workspace.workspaceId === workspaceId
  );
  const blocked = selected?.agentAccessAllowed === false;
  const recheck = {
    onRecheck: () => void workspacesQuery.refetch(),
    rechecking: workspacesQuery.isFetching,
  };
  const allBlocked = workspaces.every(
    (workspace) => workspace.agentAccessAllowed === false
  );

  const canSubmit = Boolean(trimmed) && selected !== undefined && !blocked;

  const submit = async () => {
    if (!canSubmit) return;
    const response = await create
      .mutateAsync({ data: { workspaceId, name: trimmed, allowTaskChanges } })
      .catch(async (error) => {
        if (errorCodeOf(error) === AGENT_ACCESS_DISABLED)
          await workspacesQuery.refetch();
        return null;
      });
    if (response?.status !== 201 || !response.data.success) return;
    const token = response.data.data.token;
    create.reset();
    await onCreated(trimmed, token);
  };

  return (
    <form
      className="space-y-5 rounded-panel border border-[var(--el-hairline)] bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="agent-connection-workspace">{t("workspace")}</Label>
        {workspacesQuery.isLoading ? (
          <Skeleton
            className="h-9 rounded-control"
            aria-label={t("workspacesLoading")}
          />
        ) : workspacesFailed ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-[var(--el-ink)]">
              {t("workspacesFailed")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-[30px]"
              onClick={() => void workspacesQuery.refetch()}
            >
              {tActions("retry")}
            </Button>
          </div>
        ) : allBlocked ? (
          <AgentAccessBlockedNotice {...recheck} />
        ) : (
          <>
            <Select
              items={items}
              value={workspaceId}
              onValueChange={(value) => value && setWorkspaceId(value)}
            >
              <SelectTrigger
                id="agent-connection-workspace"
                aria-label={t("workspace")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem
                    key={workspace.workspaceId}
                    value={workspace.workspaceId}
                    disabled={workspace.agentAccessAllowed === false}
                  >
                    {items[workspace.workspaceId]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {blocked ? <AgentAccessBlockedNotice {...recheck} /> : null}
          </>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="agent-connection-name">{t("name")}</Label>
        <Input
          id="agent-connection-name"
          value={name}
          maxLength={NAME_MAX_LENGTH}
          placeholder={t("namePlaceholder")}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <TaskChangesToggle
        checked={allowTaskChanges}
        disabled={create.isPending}
        onCheckedChange={setAllowTaskChanges}
      />
      <AgentAccessNotice allowTaskChanges={allowTaskChanges} />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          disabled={create.isPending}
          onClick={onCancel}
        >
          {tActions("cancel")}
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-8"
          loading={create.isPending}
          disabled={!canSubmit || create.isPending}
        >
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}

function IssuedToken({
  name,
  token,
  onClose,
}: {
  name: string;
  token: string;
  onClose: () => void;
}) {
  const t = useTranslations("settings.agentConnections.issued");
  const mcpUrl = buildUrl("/mcp");
  const claudeCode = `claude mcp add --transport http heymoa ${mcpUrl} --header "Authorization: Bearer ${token}"`;
  const codex = [
    'd="${CODEX_HOME:-$HOME/.codex}" && mkdir -p "$d" && f="$d/config.toml" && (umask 077; touch "$f") && \\',
    '{ codex mcp remove heymoa >/dev/null 2>&1 || { cp -p "$f" "$f.bak-heymoa" && t=$(awk \'/^[ \\t]*\\[[ \\t]*mcp_servers\\.heymoa[ \\t]*[].]/{s=1;next} /^[ \\t]*\\[/{s=0} !s\' "$f") && printf \'%s\\n\' "$t" > "$f"; }; } && \\',
    "cat >> \"$f\" <<'EOF'",
    "",
    "[mcp_servers.heymoa]",
    `url = "${mcpUrl}"`,
    `http_headers = { "Authorization" = "Bearer ${token}" }`,
    "EOF",
  ].join("\n");

  return (
    <section
      aria-label={t("label")}
      className="space-y-5 rounded-panel border border-[var(--el-hairline)] bg-white p-5"
    >
      <div>
        <p className="text-sm font-medium text-[var(--el-ink)]">
          {t("title", { name })}
        </p>
        <p className="mt-1 text-xs text-[var(--el-muted)]">{t("once")}</p>
      </div>
      <CopyBlock label={t("token")} value={token} />
      <CopyBlock label={t("claudeCode")} value={claudeCode} />
      <CopyBlock label={t("codex")} value={codex} />
      <p className="text-xs text-[var(--el-muted)]">
        {t.rich("scopeNote", { code: (chunks) => <code>{chunks}</code> })}
      </p>
      <div className="flex justify-end">
        <Button size="sm" className="h-8" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
    </section>
  );
}

function DelegationRow({
  delegation,
  onRevoked,
}: {
  delegation: Delegation;
  onRevoked: () => Promise<unknown>;
}) {
  const t = useTranslations("settings.agentConnections");
  const tActions = useTranslations("common.actions");
  const dateLocale = useDisplayLocale();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const revoke = useRevokeAgentDelegation();
  const active = delegation.status === "ACTIVE";
  const historyId = `agent-usage-${delegation.delegationId}`;

  return (
    <li className={SETTINGS_CARD}>
      <div className={CARD_ROW}>
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(SETTINGS_CARD_ICON, "bg-[var(--el-canvas-soft)]")}
          >
            <Bot className="size-4 text-[var(--el-muted)]" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium text-[var(--el-ink)]">
                {delegation.name}
              </p>
              <Badge variant={active ? "success" : "outline"}>
                {t(`status.${delegation.status}`)}
              </Badge>
              <Badge variant="outline">
                {t(`credential.${delegation.credentialKind}`)}
              </Badge>
              {delegation.allowTaskChanges ? (
                <Badge variant="outline">{t("taskChanges")}</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-[var(--el-muted)]">
              {delegation.workspaceName}
              {delegation.tokenHint ? (
                <>
                  {" · "}
                  <span className="font-mono">{delegation.tokenHint}…</span>
                </>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-[var(--el-muted)]">
              {t("row.meta", {
                connected: formatAppDate(delegation.createdAt, DATE, dateLocale),
                lastUsed: delegation.lastUsedAt
                  ? formatAppDate(delegation.lastUsedAt, DATE, dateLocale)
                  : t("row.neverUsed"),
              })}
              {active
                ? ` · ${t("row.expires", {
                    date: formatAppDate(delegation.expiresAt, DATE, dateLocale),
                  })}`
                : null}
            </p>
            {!active && delegation.revokeReason ? (
              <p
                className={`mt-0.5 text-xs ${
                  delegation.revokeReason === "REFRESH_TOKEN_REUSED"
                    ? "text-[var(--el-error-strong)]"
                    : "text-[var(--el-muted)]"
                }`}
              >
                {t(`revokeReason.${delegation.revokeReason}`)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs"
            aria-expanded={historyOpen}
            aria-controls={historyId}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            {t("usage.label")}
            <ChevronDown
              className={`size-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none ${historyOpen ? "rotate-180" : ""}`}
            />
          </Button>
          {active ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => setConfirmOpen(true)}
              >
                {t("row.revoke")}
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
                      {t("row.dialog.description")}
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
                            delegationId: delegation.delegationId,
                          })
                          .catch(() => null);
                        if (response?.status !== 204) return;
                        await onRevoked();
                        setConfirmOpen(false);
                      }}
                    >
                      {t("row.revoke")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : null}
        </div>
      </div>
      <Collapse open={historyOpen} lazy>
        <UsageHistory id={historyId} delegationId={delegation.delegationId} />
      </Collapse>
    </li>
  );
}

const CARD_ROW = "flex items-center justify-between gap-4";
const SKELETON_DELEGATIONS = 1;

function DelegationRowSkeleton() {
  return (
    <li className={SETTINGS_CARD}>
      <div className={CARD_ROW}>
        <div className="flex min-w-0 items-start gap-3">
          <SkeletonCardIcon />
          <div className="min-w-0">
            <SkeletonLine className="w-48" />
            <span className="mt-1 block">
              <SkeletonLine size="xs" className="w-40" />
            </span>
            <span className="mt-0.5 block">
              <SkeletonLine size="xs" className="w-80" />
              <SkeletonLine size="xs" className="w-28" />
            </span>
          </div>
        </div>
        <Skeleton className="h-8 w-[134px] shrink-0 rounded-control" />
      </div>
    </li>
  );
}

function UsageHistory({
  id,
  delegationId,
}: {
  id: string;
  delegationId: string;
}) {
  const t = useTranslations("settings.agentConnections.usage");
  const tActions = useTranslations("common.actions");
  const dateLocale = useDisplayLocale();
  const query = useInfiniteQuery({
    queryKey: [...getGetAgentDelegationUsagesQueryKey(delegationId), "pages"],
    queryFn: ({ pageParam, signal }) =>
      getAgentDelegationUsages(delegationId, pageParam, { signal }),
    initialPageParam: undefined as GetAgentDelegationUsagesParams | undefined,
    getNextPageParam: (last) => {
      const page = last.status === 200 ? last.data.data : null;
      return page?.hasMore && page.nextOccurredAt && page.nextUsageId
        ? {
            afterOccurredAt: page.nextOccurredAt,
            afterUsageId: page.nextUsageId,
          }
        : undefined;
    },
  });
  const usages =
    query.data?.pages.flatMap((page) =>
      page.status === 200 ? page.data.data.usages : []
    ) ?? [];
  const [visible, setVisible] = useState(USAGE_STEP);
  const showMore = () => {
    const next = visible > usages.length ? visible : visible + USAGE_STEP;
    setVisible(next);
    if (next > usages.length && query.hasNextPage) void query.fetchNextPage();
  };

  return (
    <section
      id={id}
      aria-label={t("label")}
      className="mt-4 border-t border-[var(--el-hairline)] pt-3"
    >
      {query.isLoading ? (
        <ul className="space-y-1" aria-label={t("loading")}>
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index} className="flex items-center gap-3 py-1">
              <SkeletonLine size="xs" className="w-28" />
              <SkeletonLine size="xs" className="w-24" />
            </li>
          ))}
        </ul>
      ) :
      query.isError && !query.data ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-xs text-[var(--el-ink)]">
            {t("loadFailed")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-[26px] text-xs"
            onClick={() => void query.refetch()}
          >
            {tActions("retry")}
          </Button>
        </div>
      ) : usages.length === 0 ? (
        <p className="text-xs text-[var(--el-muted)]">
          {t("empty")}
        </p>
      ) : (
        <>
          <ul className="space-y-1">
            {usages.slice(0, visible).map((usage) => (
              <li
                key={usage.usageId}
                className="flex items-center gap-3 py-1 text-xs"
              >
                <span className="w-28 shrink-0 text-[var(--el-muted)] tabular-nums">
                  {formatAppDate(usage.occurredAt, DATE_TIME, dateLocale)}
                </span>
                <span className="min-w-0 truncate text-[var(--el-ink)]">
                  {isKnownTool(usage.toolName)
                    ? t(`tools.${usage.toolName}`)
                    : usage.toolName}
                </span>
                {usage.outcome === "FAILED" ? (
                  <Badge variant="outline">{t("failed")}</Badge>
                ) : usage.resultCount !== null ? (
                  <span className="text-[var(--el-muted)] tabular-nums">
                    {t("resultCount", { count: usage.resultCount })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {query.isFetchNextPageError ? (
            <p role="alert" className="mt-2 text-xs text-[var(--el-ink)]">
              {t("nextFailed")}
            </p>
          ) : null}
          {usages.length > visible || query.hasNextPage ? (
            <LoadMoreButton
              variant="ghost"
              className="mt-2 h-7 rounded-control px-2 text-xs"
              loading={query.isFetchingNextPage}
              loadingLabel={t("loadingMore")}
              onClick={showMore}
            >
              {t("more")}
            </LoadMoreButton>
          ) : null}
        </>
      )}
    </section>
  );
}
