"use client";

import { useState } from "react";
import { Bot, ShieldAlert } from "lucide-react";

import { AgentAccessNotice } from "@/components/agent-connections/agent-access-notice";
import { AgentOAuthEndCard } from "@/components/agent-connections/agent-oauth-cards";
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

/** 계약이 정한 권한을 사람이 읽는 말로. 모르는 값은 이름 그대로 둔다. */
const SCOPE_LABELS: Record<string, string> = { "mcp:read": "읽기" };

/**
 * server 가 돌려준 돌아갈 주소로 간다. server 가 등록 때 주소를 검사하지만, `javascript:` 같은 다른 scheme 으로는
 * 이 화면이 직접 이동하지 않는다.
 */
export function isNavigableRedirect(uri: string) {
  try {
    const { protocol } = new URL(uri);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 외부 에이전트가 요청한 연결을 보고 워크스페이스를 골라 허락하거나 거절한다(APP-888).
 *
 * - 에이전트 이름은 에이전트가 스스로 등록한 값이라 사칭될 수 있다 — 「확인한 앱이 아닙니다」를 늘 붙이고,
 *   이름보다 믿을 수 있는 돌아갈 호스트를 함께 보인다
 * - 워크스페이스가 하나면 미리 고르고, 둘 이상이면 고르기 전에는 허락할 수 없다 — 맡길 범위는 사람이 고른다
 * - 요청이 없거나 이미 처리됐으면(`AGENT_OAUTH_REQUEST_NOT_FOUND`) server 문구로 끝낸다. 실패는 전역 토스트
 *   대신 이 화면이 그린다
 */
export function AgentOAuthConsent({ consentState }: { consentState: string }) {
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

  if (errorCodeOf(failure) === REQUEST_NOT_FOUND) {
    return (
      <AgentOAuthEndCard
        message={errorMessageOf(failure, "연결 요청을 찾을 수 없습니다.")}
      />
    );
  }
  if (consent.isError) {
    return (
      <CenteredCard icon={<Bot className="size-5" aria-hidden />}>
        <InlineRetry
          label="연결 요청을 불러오지 못했습니다"
          onRetry={() => void consent.refetch()}
        />
      </CenteredCard>
    );
  }

  const request =
    consent.data?.status === 200 && consent.data.data.success
      ? consent.data.data.data
      : null;

  const leave = (redirectUri: string) => {
    if (!isNavigableRedirect(redirectUri)) {
      setInvalidRedirect(true);
      return;
    }
    setLeaving(true);
    window.location.assign(redirectUri);
  };

  // 화면은 마지막 동작의 실패만 그린다 — 앞선 반대 동작의 실패가 남아 있으면 그것이 먼저 읽힌다
  const onApprove = async () => {
    if (!workspaceId) return;
    deny.reset();
    setInvalidRedirect(false);
    const response = await approve
      .mutateAsync({ data: { state: consentState, workspaceId } })
      .catch(() => null);
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
    workspaces.map((workspace) => [workspace.workspaceId, workspace.name])
  );

  return (
    <CenteredCard icon={<Bot className="size-5" aria-hidden />}>
      {request ? (
        <h1 className="font-serif text-xl font-light tracking-[-0.01em] break-words">
          {request.clientName}
        </h1>
      ) : (
        <Skeleton
          className="mx-auto h-7 w-40 rounded-control"
          aria-label="연결 요청을 불러오는 중"
        />
      )}
      <p className="mt-2 text-sm text-[var(--el-muted)]">
        이 에이전트가 HeyMoa 워크스페이스를 맡겨 달라고 요청합니다.
      </p>
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-chip bg-[var(--el-canvas-soft)] px-2.5 py-1 text-xs text-[var(--el-muted)]">
        <ShieldAlert className="size-3.5" aria-hidden />
        HeyMoa 가 확인한 앱이 아닙니다
      </p>

      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left text-sm">
        <dt className="text-[var(--el-muted)]">돌아갈 곳</dt>
        <dd className="min-w-0 break-all">
          {request ? (
            <>허락하면 {request.redirectHost} 로 돌아갑니다</>
          ) : (
            <Skeleton className="h-5 w-48 rounded-control" />
          )}
        </dd>
        <dt className="text-[var(--el-muted)]">권한</dt>
        <dd>
          {request ? (
            request.scopes
              .map((scope) => SCOPE_LABELS[String(scope)] ?? String(scope))
              .join(", ")
          ) : (
            <Skeleton className="h-5 w-12 rounded-control" />
          )}
        </dd>
      </dl>

      <div className="mt-5 grid gap-2 text-left">
        <Label htmlFor="agent-oauth-workspace">맡길 워크스페이스</Label>
        {workspacesQuery.isLoading ? (
          <Skeleton
            className="h-9 rounded-control"
            aria-label="워크스페이스를 불러오는 중"
          />
        ) : workspacesQuery.isError ? (
          <InlineRetry
            label="워크스페이스를 불러오지 못했습니다"
            onRetry={() => void workspacesQuery.refetch()}
          />
        ) : workspaces.length === 0 ? (
          <p className="text-sm text-[var(--el-muted)]">
            연결할 워크스페이스가 없습니다.
          </p>
        ) : (
          <Select
            items={items}
            value={workspaceId}
            onValueChange={(value) => value && setChosenWorkspaceId(value)}
          >
            <SelectTrigger
              id="agent-oauth-workspace"
              aria-label="맡길 워크스페이스"
              className="w-full"
            >
              <SelectValue placeholder="워크스페이스를 고르세요" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem
                  key={workspace.workspaceId}
                  value={workspace.workspaceId}
                >
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="mt-4">
        <AgentAccessNotice />
      </div>

      {(failure || invalidRedirect) && (
        <p role="alert" className="mt-4 text-sm text-[var(--el-error-strong)]">
          {invalidRedirect
            ? "에이전트로 돌아갈 주소가 올바르지 않습니다. 에이전트에서 다시 연결해 주세요."
            : errorMessageOf(failure, "요청을 처리하지 못했습니다.")}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          loading={deny.isPending}
          disabled={busy || !request}
          onClick={() => void onDeny()}
        >
          거절
        </Button>
        {workspaces.length > 0 && (
          <Button
            type="button"
            size="sm"
            className="h-8"
            loading={approve.isPending}
            disabled={busy || !request || !workspaceId}
            onClick={() => void onApprove()}
          >
            허락
          </Button>
        )}
      </div>
    </CenteredCard>
  );
}
