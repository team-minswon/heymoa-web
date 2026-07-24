"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Info, Link2, Plug } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
  const queryClient = useQueryClient();
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
    // MSW는 최상위 내비게이션을 못 가로채므로 목에서는 목 승인 화면으로 바로 보낸다(인증 불필요).
    if (shouldEnableMocking()) {
      window.location.assign(
        `/mock-oauth?workspaceId=${workspaceId}&provider=${provider}`
      );
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
      toast.error("연결을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    window.location.assign(
      buildUrl(`/v1/workspaces/${workspaceId}/integrations/${provider}/authorize`)
    );
  };

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <header className="mb-8">
        <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-[var(--el-muted)] uppercase">
          <Plug className="size-3.5" />
          Integrations
        </p>
        <h2 className="mt-2 font-serif text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
          연동
        </h2>
        <p className="mt-2 text-sm text-[var(--el-muted)]">
          챗봇이 회의에서 이슈를 만들거나 조회할 때 이 워크스페이스의 연동을 씁니다.
        </p>
      </header>

      {integrationsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : integrationsQuery.isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-[var(--el-ink)]">연동 정보를 불러오지 못했습니다.</p>
          <Button
            variant="outline"
            size="sm"
            className="h-[30px]"
            onClick={() => void integrationsQuery.refetch()}
          >
            다시 시도
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
              isBusy={disconnect.isPending}
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
          className="mt-4 flex items-start gap-2 rounded-2xl border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-relaxed text-[var(--el-muted)]">
              권한을 확인하지 못해 연결·해제를 할 수 없습니다.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-[30px]"
              onClick={() => void membersQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        </div>
      ) : roleKnown && !isAdmin ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-2xl border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
          <p className="text-xs leading-relaxed text-[var(--el-muted)]">
            연동 연결·해제는 관리자만 할 수 있습니다. 새 연동이 필요하면 ADMIN에게 요청하세요.
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
  const provider = integration.provider as Provider;
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--el-hairline)] bg-white p-4 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--el-canvas-soft)]">
          <Link2 className="size-4 text-[var(--el-ink)]" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[var(--el-ink)]">
              {PROVIDER_LABEL[provider]}
            </p>
            <Badge variant={integration.connected ? "secondary" : "outline"}>
              {integration.connected ? "연결됨" : "연결되지 않음"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-[var(--el-muted)]">
            {integration.connected
              ? `${integration.connectedBy ?? "관리자"} · ${
                  integration.connectedAt
                    ? formatAppDate(integration.connectedAt, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "-"
                }`
              : "챗봇이 이 도구를 쓰려면 연결이 필요합니다."}
          </p>
        </div>
      </div>

      {isAdmin ? (
        integration.connected ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={isBusy}
            onClick={onDisconnect}
          >
            연결 해제
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 shrink-0"
            disabled={isBusy}
            onClick={onConnect}
          >
            연결
          </Button>
        )
      ) : null}
    </div>
  );
}
