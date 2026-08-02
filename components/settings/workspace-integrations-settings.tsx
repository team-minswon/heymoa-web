"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Info, Link2 } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  SettingsGap,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-chrome";
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
      buildUrl(
        `/v1/workspaces/${workspaceId}/integrations/${provider}/authorize`
      )
    );
  };

  return (
    <>
      {integrationsQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-panel" />
          <Skeleton className="h-24 rounded-panel" />
        </div>
      ) : integrationsQuery.isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-[var(--el-ink)]">
            연동 정보를 불러오지 못했습니다.
          </p>
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
        <SettingsSection title="연결된 도구" note="관리자만 바꿀 수 있습니다">
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
        </SettingsSection>
      )}

      {roleError ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5"
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
      ) : null}

      <SettingsGap />
      <AgentScopeSection />
    </>
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

  // 카드가 아니라 행이다 — 다이얼로그 안에서 판을 또 쌓으면 깊이가 거짓말을 한다.
  // 「연결됨」 배지도 걷었다: 오른쪽 버튼이 「연결 해제」면 이미 연결된 것이다.
  return (
    <SettingsRow
      label={PROVIDER_LABEL[provider]}
      description={
        integration.connected
          ? `${integration.connectedBy ?? "관리자"} · ${
              integration.connectedAt
                ? formatAppDate(integration.connectedAt, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "-"
            }`
          : "챗봇이 이 도구를 쓰려면 연결이 필요합니다"
      }
      icon={<Link2 className="size-3.5 text-[var(--el-ink)]" />}
    >
      {isAdmin ? (
        <Button
          variant={integration.connected ? "outline" : "default"}
          className="h-9 px-[13px] text-[13px]"
          disabled={isBusy}
          onClick={integration.connected ? onDisconnect : onConnect}
        >
          {integration.connected ? "연결 해제" : "연결"}
        </Button>
      ) : null}
    </SettingsRow>
  );
}

/**
 * 에이전트가 연동으로 무엇을 하는지. design.pen `IcABs` 의 둘째 절이다 —
 * 연결만 보여주고 「그래서 얘가 뭘 하나」를 안 적으면 연결 버튼이 백지수표로 읽힌다.
 */
function AgentScopeSection() {
  return (
    <SettingsSection title="에이전트가 하는 일" note="승인 없이 실행하지 않습니다">
      <SettingsRow
        label="읽기"
        description="이슈·PR 을 조회해 회의 맥락에 붙입니다"
      >
        <Info aria-hidden className="size-3.5 text-[var(--el-muted)]" />
      </SettingsRow>
      <SettingsRow
        label="쓰기"
        description="이슈 생성·수정은 카드로 먼저 물어봅니다"
      >
        <Info aria-hidden className="size-3.5 text-[var(--el-muted)]" />
      </SettingsRow>
    </SettingsSection>
  );
}
