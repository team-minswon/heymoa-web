"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  AGENT_ACCESS_DISABLED,
  AgentAccessBlockedNotice,
  useWorkspaceOptionLabel,
} from "@/components/agent-connections/agent-access-blocked";
import { AgentAccessNotice } from "@/components/agent-connections/agent-access-notice";
import { TaskChangesToggle } from "@/components/agent-connections/task-changes-toggle";
import {
  AgentOAuthEndCard,
  HEYMOA_MARK,
} from "@/components/agent-connections/agent-oauth-cards";
import { CenteredCard } from "@/components/layout/centered-card";
import { Button } from "@/components/ui/button";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  useApproveAgentOAuthConsent,
  useDenyAgentOAuthConsent,
  useGetAgentOAuthConsent,
} from "@/lib/api/generated/agent-o-auth-consent/agent-o-auth-consent";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";

const REQUEST_NOT_FOUND = "AGENT_OAUTH_REQUEST_NOT_FOUND";

const SCOPE_KEYS: Record<string, "read" | "write"> = { "mcp:read": "read", "mcp:write": "write" };

export function isNavigableRedirect(uri: string) {
  try {
    const { protocol } = new URL(uri);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function AgentOAuthConsent({ consentState }: { consentState: string }) {
  const t = useTranslations("agents.consent");
  const optionLabel = useWorkspaceOptionLabel();
  const consent = useGetAgentOAuthConsent({ state: consentState });
  const workspacesQuery = useGetWorkspaces();
  const approve = useApproveAgentOAuthConsent({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const deny = useDenyAgentOAuthConsent({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [chosenWorkspaceId, setChosenWorkspaceId] = useState<string | null>(
    null
  );
  const [leaving, setLeaving] = useState(false);
  const [allowTaskChanges, setAllowTaskChanges] = useState(false);
  const [invalidRedirect, setInvalidRedirect] = useState(false);

  const workspaces =
    workspacesQuery.data?.status === 200 && workspacesQuery.data.data.success
      ? workspacesQuery.data.data.data.workspaces
      : [];
  const workspaceId =
    chosenWorkspaceId ??
    (workspaces.length === 1 ? workspaces[0].workspaceId : null);
  const busy = approve.isPending || deny.isPending || leaving;
  const failure = consent.error ?? approve.error ?? deny.error;
  const selected = workspaces.find(
    (workspace) => workspace.workspaceId === workspaceId
  );
  const blocked = selected?.agentAccessAllowed === false;
  const recheck = {
    onRecheck: () => void workspacesQuery.refetch(),
    rechecking: workspacesQuery.isFetching,
  };
  const allBlocked =
    workspaces.length > 0 &&
    workspaces.every((workspace) => workspace.agentAccessAllowed === false);

  if (errorCodeOf(failure) === REQUEST_NOT_FOUND) {
    return (
      <AgentOAuthEndCard
        message={errorMessageOf(failure, t("notFound"))}
      />
    );
  }
  if (consent.isError) {
    return (
      <CenteredCard icon={HEYMOA_MARK}>
        <InlineRetry
          label={t("loadFailed")}
          onRetry={() => void consent.refetch()}
        />
      </CenteredCard>
    );
  }

  const request =
    consent.data?.status === 200 && consent.data.data.success
      ? consent.data.data.data
      : null;
  const writeRequested =
    request?.scopes.some((scope) => String(scope) === "mcp:write") ?? false;

  const leave = (redirectUri: string) => {
    if (!isNavigableRedirect(redirectUri)) {
      setInvalidRedirect(true);
      return;
    }
    setLeaving(true);
    window.location.assign(redirectUri);
  };

  const onApprove = async () => {
    if (!workspaceId) return;
    deny.reset();
    setInvalidRedirect(false);
    const response = await approve
      .mutateAsync({
        data: {
          state: consentState,
          workspaceId,
          ...(writeRequested ? { allowTaskChanges } : {}),
        },
      })
      .catch(async (error) => {
        if (errorCodeOf(error) === AGENT_ACCESS_DISABLED)
          await workspacesQuery.refetch();
        return null;
      });
    if (response?.status === 200 && response.data.success) {
      leave(response.data.data.redirectUri);
    }
  };

  const onDeny = async () => {
    approve.reset();
    setInvalidRedirect(false);
    const response = await deny
      .mutateAsync({ data: { state: consentState } })
      .catch(() => null);
    if (response?.status === 200 && response.data.success) {
      leave(response.data.data.redirectUri);
    }
  };

  const items = Object.fromEntries(
    workspaces.map((workspace) => [workspace.workspaceId, optionLabel(workspace)])
  );

  return (
    <CenteredCard icon={HEYMOA_MARK}>
      {request ? (
        <h1 className="text-2xl font-light tracking-[-0.01em] break-words">
          {request.clientName}
        </h1>
      ) : (
        <Skeleton
          className="mx-auto h-8 w-44 rounded-control"
          aria-label={t("loading")}
        />
      )}
      <p className="mt-2 text-base text-[var(--el-muted)]">
        {t("intro")}
      </p>
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-chip bg-[var(--el-canvas-soft)] px-3 py-1 text-sm text-[var(--el-muted)]">
        <ShieldAlert className="size-4" aria-hidden />
        {t("unverified")}
      </p>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left text-base">
        <dt className="text-[var(--el-muted)]">{t("redirect")}</dt>
        <dd className="min-w-0 wrap-anywhere">
          {request ? (
            t("redirectTo", { host: request.redirectHost })
          ) : (
            <Skeleton className="h-6 w-48 rounded-control" />
          )}
        </dd>
        <dt className="text-[var(--el-muted)]">{t("scopes")}</dt>
        <dd>
          {request ? (
            request.scopes
              .map((scope) => {
                const key = SCOPE_KEYS[String(scope)];
                return key ? t(`scope.${key}`) : String(scope);
              })
              .join(", ")
          ) : (
            <Skeleton className="h-6 w-12 rounded-control" />
          )}
        </dd>
      </dl>

      <div className="mt-6 grid gap-2 text-left">
        <Label htmlFor="agent-oauth-workspace" className="text-base">{t("workspace")}</Label>
        {workspacesQuery.isLoading ? (
          <Skeleton
            className="h-11 rounded-control"
            aria-label={t("workspacesLoading")}
          />
        ) : workspacesQuery.isError ? (
          <InlineRetry
            label={t("workspacesFailed")}
            onRetry={() => void workspacesQuery.refetch()}
          />
        ) : workspaces.length === 0 ? (
          <p className="text-base text-[var(--el-muted)]">
            {t("noWorkspaces")}
          </p>
        ) : allBlocked ? (
          <AgentAccessBlockedNotice {...recheck} className="text-sm" />
        ) : (
          <Select
            items={items}
            value={workspaceId}
            disabled={busy}
            onValueChange={(value) => {
              if (!value) return;
              setChosenWorkspaceId(value);
              approve.reset();
            }}
          >
            <SelectTrigger
              id="agent-oauth-workspace"
              aria-label={t("workspace")}
              className="h-11 w-full text-base"
            >
              <SelectValue placeholder={t("workspacePlaceholder")} />
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
        )}
        {blocked && !allBlocked ? (
          <AgentAccessBlockedNotice {...recheck} className="text-sm" />
        ) : null}
      </div>

      {writeRequested ? (
        <TaskChangesToggle
          className="mt-4"
          checked={allowTaskChanges}
          disabled={busy}
          onCheckedChange={setAllowTaskChanges}
        />
      ) : null}

      <div className="mt-4">
        <AgentAccessNotice
          allowTaskChanges={writeRequested && allowTaskChanges}
          className="text-sm"
        />
      </div>

      {((failure && errorCodeOf(failure) !== AGENT_ACCESS_DISABLED) ||
        invalidRedirect) && (
        <p role="alert" className="mt-4 text-base text-[var(--el-error-strong)]">
          {invalidRedirect
            ? t("invalidRedirect")
            : errorMessageOf(failure, t("failed"))}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="xl"
          className="px-5 text-base"
          loading={deny.isPending}
          disabled={busy || !request}
          onClick={() => void onDeny()}
        >
          {t("deny")}
        </Button>
        {workspaces.length > 0 && (
          <Button
            type="button"
            size="xl"
            className="px-5 text-base"
            loading={approve.isPending}
            disabled={busy || !request || !workspaceId || blocked}
            onClick={() => void onApprove()}
          >
            {t("allow")}
          </Button>
        )}
      </div>
    </CenteredCard>
  );
}
