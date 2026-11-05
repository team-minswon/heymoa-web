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

/**
 * 워크스페이스 연동 설정. **연결·해제는 ADMIN 단독**이고 MEMBER는 상태만 본다 — 역할은
 * 멤버 목록에서 내 userId로 가른다. 역할을 모르는 동안(로딩)에는 버튼을 그리지 않는다
 * (낙관적으로 그리면 MEMBER에게 눌러 봤자 403인 버튼이 보인다).
 */
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
  // 역할 조회가 실패하면 관리 권한을 알 수 없다 — 조작을 숨기고 사유·재시도를 보인다.
  const roleError = membersQuery.isError;
  // 역할이 확정되기 전에는 조작을 열지 않는다.
  const isAdmin = myRole === "ADMIN";
  const roleKnown = Boolean(myRole) && !roleError;

  const connect = async (provider: Provider) => {
    if (connecting || disconnect.isPending) return;
    // MSW는 최상위 내비게이션을 못 가로채므로 목에서는 목 승인 화면으로 바로 보낸다(인증 불필요).
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
    // authorize는 302라 fetch로 부르면 안 되고 최상위 이동이다 — 그런데 그 이동은 proxy·
    // apiFetch의 401 갱신을 안 탄다. **공유 단일 비행(refreshAuthOnce)** 으로 먼저 갱신하고
    // (로테이팅 리프레시 토큰이 중복 갱신으로 무효화되지 않게), 실패면 사유로 가른다:
    //   만료(400/401) → 로그인으로 실제 이동(proxy가 미인증 처리)
    //   일시(네트워크·5xx) → 인증을 지우지 않고 재시도 안내
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
              // 해제가 도는 동안에는 **모든** 카드의 조작을 잠근다 — 두 번째 조작이 겹치면
              // 무효화가 어긋나 성공한 해제가 연결됨으로 남을 수 있다.
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
  // 카드 안의 카드에는 그림자를 주지 않는다 — hairline만. (ELEVATION SPEC)
  //
  // 색은 **상태에만** 준다. 연결됨은 success 틴트, 연결되지 않음은 무채색 — 색이 없는 것이
  // "아직 아무것도 아니다"를 그대로 말한다. 예전에는 둘 다 회색이라 칩을 읽어야만 구분됐다.
  // 아이콘도 같은 색을 따라가서, 칩까지 안 가도 카드 왼쪽에서 상태가 보인다.
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
          {/* 칩 글자와 같은 이유로 `*-strong`이다 — 아이콘도 상태 단서라 같은 10% 틴트 위에서
              비텍스트 대비 3:1을 넘어야 한다(`--el-success`를 그대로 쓰면 2.95:1). */}
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
          // 되돌릴 수 있는 제거라 솔리드 빨강이 아니라 destructive 틴트다 — 경고가 아니라
          // "무엇을 없애는 버튼인지"만 알려주면 된다.
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
/** 공급자는 web 이 이름을 아는 고정 목록이라 skeleton 도 그만큼 세운다. */
const SKELETON_INTEGRATIONS = Object.keys(PROVIDER_LABEL).length;

/** `IntegrationCard` 와 같은 틀에 이름·상태·보조 줄·버튼을 막대로 둔다. */
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
