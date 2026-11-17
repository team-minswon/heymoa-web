"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Info, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/auth/auth-provider";
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
import { toast } from "@/lib/ui/toast";
import { DESKTOP_RELEASES_URL } from "@/lib/desktop/downloads";

import { AuthRefreshError, buildUrl, refreshAuthOnce } from "@/lib/api/fetcher";
import {
  getGetWorkspaceIntegrationsQueryKey,
  useDisconnectWorkspaceIntegration,
  useGetWorkspaceIntegrations,
} from "@/lib/api/generated/workspace-integration/workspace-integration";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";
import type { ToolConnectionsResponseDataIntegrationsItem } from "@/lib/api/generated/models";
import { formatAppDate } from "@/lib/format/date";
import { shouldEnableMocking } from "@/lib/mocks/enable-mocking";
import { cn } from "@/lib/utils";
import { desktopAuthBridge } from "@/lib/desktop/auth";
import { HelpLink } from "@/components/heymoa/help-link";
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";

type Provider = "LINEAR" | "GITHUB";

const PROVIDER_LABEL: Record<Provider, string> = {
  LINEAR: "Linear",
  GITHUB: "GitHub",
};

export function WorkspaceIntegrationsSettings({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const t = useTranslations("settings.integrations");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const { user } = useAuth();
  const integrationsQuery = useGetWorkspaceIntegrations(workspaceId);
  const membersQuery = useGetWorkspaceMembers(workspaceId);
  // 무효화는 **훅 레벨 onSuccess**에 둔다 — 연달아 해제하면 per-call 콜백은 마지막 것만 도는
  // TanStack 특성 때문에, 앞이 성공하고 뒤가 실패하면 무효화가 아예 안 돈다.
  const disconnect = useDisconnectWorkspaceIntegration({
    mutation: {
      // 무효화 promise를 **돌려준다** — 그래야 TanStack이 새 상태가 올 때까지 mutation을
      // pending으로 유지해, 재조회가 느려도 버튼이 다시 열려 중복 해제가 나가지 않는다.
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: getGetWorkspaceIntegrationsQueryKey(workspaceId),
        }),
    },
  });

  const integrationsResponse = integrationsQuery.data;
  const integrations =
    integrationsResponse !== undefined &&
    integrationsResponse.status === 200 &&
    integrationsResponse.data.success
      ? (integrationsResponse.data.data?.integrations ?? [])
      : [];

  const membersResponse = membersQuery.data;
  const members =
    membersResponse !== undefined &&
    membersResponse.status === 200 &&
    membersResponse.data.success
      ? (membersResponse.data.data?.members ?? [])
      : [];
  const myRole = members.find((member) => member.userId === user?.userId)?.role;
  const roleError = membersQuery.isError;
  const isAdmin = myRole === "ADMIN";
  const roleKnown = Boolean(myRole) && !roleError;

  const connect = async (provider: Provider) => {
    if (connecting || disconnect.isPending) return;
    if (shouldEnableMocking()) {
      window.location.assign(
        `/mock-oauth?workspaceId=${workspaceId}&provider=${provider}`
      );
      return;
    }
    const desktop = desktopAuthBridge();
    if (desktop) {
      if (!desktop.beginConnection) {
        toast.error(t("toast.updateApp"), {
          action: {
            label: t("toast.viewRelease"),
            onClick: () =>
              window.open(
                DESKTOP_RELEASES_URL,
                "_blank",
                "noopener,noreferrer"
              ),
          },
        });
        return;
      }
      setConnecting(true);
      try {
        // Admission happens during this click. Native requests share the app's
        // cookies and refresh a stale access cookie before retrying the ticket.
        const outcome = await desktop.beginConnection({
          workspaceId,
          provider,
        });
        if (outcome.status === "success") {
          await queryClient.invalidateQueries({
            queryKey: getGetWorkspaceIntegrationsQueryKey(workspaceId),
          });
        } else if (outcome.status !== "cancelled") {
          toast.error(t("toast.connectFailed"));
        }
      } catch {
        toast.error(t("toast.startFailed"));
      } finally {
        setConnecting(false);
      }
      return;
    }
    try {
      await refreshAuthOnce();
    } catch (error) {
      if (error instanceof AuthRefreshError && error.expired) {
        window.location.assign("/");
        return;
      }
      toast.error(t("toast.startFailedLater"));
      return;
    }
    window.location.assign(
      buildUrl(
        `/v1/workspaces/${workspaceId}/integrations/${provider}/authorize`
      )
    );
  };

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <SettingsHeader
        title={t("title")}
        description={
          <>
            {t("description")} <HelpLink topic="integrations" />
          </>
        }
      />

      {integrationsQuery.isLoading ? (
        <div className="space-y-3" aria-label={t("loading")}>
          {Array.from({ length: SKELETON_INTEGRATIONS }, (_, index) => (
            <IntegrationCardSkeleton key={index} />
          ))}
        </div>
      ) : integrationsQuery.isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-[var(--el-ink)]">
            {t("loadFailed")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-[30px]"
            onClick={() => void integrationsQuery.refetch()}
          >
            {tActions("retry")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.provider}
              integration={integration}
              isAdmin={roleKnown && isAdmin}
              isBusy={disconnect.isPending || connecting}
              onConnect={() => void connect(integration.provider as Provider)}
              onDisconnect={() =>
                disconnect.mutate({
                  workspaceId,
                  provider: integration.provider as Provider,
                })
              }
            />
          ))}
        </div>
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
      ) : roleKnown && !isAdmin ? (
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
    </div>
  );
}

function IntegrationCard({
  integration,
  isAdmin,
  isBusy,
  onConnect,
  onDisconnect,
}: {
  integration: ToolConnectionsResponseDataIntegrationsItem;
  isAdmin: boolean;
  isBusy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const t = useTranslations("settings.integrations.card");
  const dateLocale = useDisplayLocale();
  const provider = integration.provider as Provider;
  return (
    <div className={cn(CARD_ROW, SETTINGS_CARD)}>
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            SETTINGS_CARD_ICON,
            integration.connected
              ? "bg-[var(--el-success)]/10"
              : "bg-[var(--el-canvas-soft)]"
          )}
        >
          <Link2
            className={cn(
              "size-4",
              integration.connected
                ? "text-[var(--el-success-strong)]"
                : "text-[var(--el-muted)]"
            )}
          />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[var(--el-ink)]">
              {PROVIDER_LABEL[provider]}
            </p>
            <Badge variant={integration.connected ? "success" : "outline"}>
              {integration.connected ? t("connected") : t("notConnected")}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-[var(--el-muted)]">
            {integration.connected
              ? `${integration.connectedBy ?? t("adminFallback")} · ${
                  integration.connectedAt
                    ? formatAppDate(
                        integration.connectedAt,
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                        dateLocale
                      )
                    : "-"
                }`
              : t("needsConnection")}
          </p>
        </div>
      </div>

      {isAdmin ? (
        integration.connected ? (
          <Button
            variant="destructive"
            size="sm"
            className="h-8 shrink-0"
            disabled={isBusy}
            onClick={onDisconnect}
          >
            {t("disconnect")}
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 shrink-0"
            disabled={isBusy}
            onClick={onConnect}
          >
            {t("connect")}
          </Button>
        )
      ) : null}
    </div>
  );
}

const CARD_ROW = "flex items-center justify-between gap-4";
const SKELETON_INTEGRATIONS = Object.keys(PROVIDER_LABEL).length;

function IntegrationCardSkeleton() {
  return (
    <div className={cn(CARD_ROW, SETTINGS_CARD)}>
      <div className="flex min-w-0 items-start gap-3">
        <SkeletonCardIcon />
        <div className="min-w-0">
          <SkeletonLine className="w-28" />
          <span className="mt-1 block">
            <SkeletonLine size="xs" className="w-52" />
          </span>
        </div>
      </div>
      <Skeleton className="h-8 w-11 shrink-0 rounded-control" />
    </div>
  );
}
