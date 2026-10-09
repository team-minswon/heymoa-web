"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Info } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { CREDENTIAL_LABEL } from "@/components/settings/agent-connections-settings";
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
      <header className="mb-8">
        <h2 className="font-serif text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
          MCP 관리
        </h2>
        <p className="mt-2 text-sm text-[var(--el-muted)]">
          팀원이 Claude·ChatGPT 같은 AI 앱에 이 워크스페이스를 연결해도 되는지
          정합니다. 관리자는 연결된 앱을 보고 끊을 수 있습니다.
        </p>
      </header>

      {workspaceQuery.isLoading ? (
        <Skeleton
          className="h-[76px] rounded-panel"
          aria-label="MCP 설정 불러오는 중"
        />
      ) : // 다시 읽다 실패하면 캐시가 남아도 옛 값 대신 실패를 보인다 — 옛 「켜짐」을 보고 끄기를 누르게 된다
      workspaceQuery.isError || !workspace ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-[var(--el-ink)]">
            MCP 설정을 불러오지 못했습니다.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-[30px]"
            onClick={() => void workspaceQuery.refetch()}
          >
            다시 시도
          </Button>
        </div>
      ) : (
        <section
          aria-label="MCP 연결 허용"
          className="flex items-center justify-between gap-4 rounded-panel border border-[var(--el-hairline)] bg-white p-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--el-ink)]">
              MCP 연결 허용
            </p>
            <p className="mt-1 text-xs text-[var(--el-muted)]">
              {workspace.agentAccessAllowed
                ? "팀원이 이 워크스페이스를 Claude·ChatGPT 같은 AI 앱에 맡길 수 있습니다."
                : "꺼짐 — 새 연결을 만들 수 없습니다."}
            </p>
          </div>
          {isAdmin ? (
            <Switch
              aria-label="MCP 연결 허용"
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
              {workspace.agentAccessAllowed ? "켜짐" : "꺼짐"}
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
              권한을 확인하지 못해 MCP 설정을 바꿀 수 없습니다.
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
      ) : myRole === "MEMBER" ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
          <p className="text-xs leading-relaxed text-[var(--el-muted)]">
            MCP 연결은 관리자만 바꿀 수 있습니다.
          </p>
        </div>
      ) : null}

      {isAdmin ? (
        <section aria-label="열린 연결" className="mt-8">
          <h3 className="text-sm font-medium text-[var(--el-ink)]">
            열린 연결
          </h3>
          <div className="mt-3">
            {delegationsQuery.isLoading ? (
              <div className="space-y-3" aria-label="열린 연결 불러오는 중">
                <Skeleton className="h-[72px] rounded-panel" />
                <Skeleton className="h-[72px] rounded-panel" />
              </div>
            ) : // 캐시가 남아도 실패를 「열린 연결이 없습니다」나 옛 목록으로 접지 않는다
            delegationsQuery.isError || !delegations ? (
              <div role="alert" className="space-y-2">
                <p className="text-sm text-[var(--el-ink)]">
                  연결 목록을 불러오지 못했습니다.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-[30px]"
                  onClick={() => void delegationsQuery.refetch()}
                >
                  다시 시도
                </Button>
              </div>
            ) : delegations.length === 0 ? (
              // 실패가 아니다 — 경고 색·아이콘을 쓰지 않는다
              <div className="rounded-panel border border-dashed border-[var(--el-hairline)] p-6 text-center">
                <p className="text-sm text-[var(--el-ink)]">
                  열린 연결이 없습니다.
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
          </div>
        </section>
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
            <AlertDialogTitle>MCP 연결을 끌까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {delegations && !delegationsQuery.isError
                ? `지금 연결된 ${delegations.length}개가`
                : "지금 연결된 연결이"}{" "}
              모두 끊기고, 다시 켜도 되살아나지 않습니다. 끈 동안은 누구도 이
              워크스페이스로 연결할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={change.isPending}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={change.isPending}
              disabled={change.isPending}
              onClick={() => void setAllowed(false)}
            >
              끄기
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const revoke = useRevokeWorkspaceAgentDelegation();

  return (
    <li className="flex items-center justify-between gap-4 rounded-panel border border-[var(--el-hairline)] bg-white p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control bg-[var(--el-canvas-soft)]">
          <Bot className="size-4 text-[var(--el-muted)]" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-[var(--el-ink)]">
              {delegation.name}
            </p>
            {/* OAuth 이름은 에이전트가 스스로 정해 사칭될 수 있다 — 무엇으로 붙었는지 함께 보인다 */}
            <Badge variant="outline">
              {CREDENTIAL_LABEL[delegation.credentialKind]}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-[var(--el-muted)]">
            {delegation.userName}
          </p>
          <p className="mt-0.5 text-xs text-[var(--el-muted)]">
            {formatAppDate(delegation.createdAt, DATE)} 연결 · 최근 사용{" "}
            {delegation.lastUsedAt
              ? formatAppDate(delegation.lastUsedAt, DATE)
              : "아직 안 씀"}
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
        끊기
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
              「{delegation.name}」 연결을 끊을까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {delegation.userName} 님이 맡긴 연결입니다. 이 연결을 쓰는
              에이전트는 다음 요청부터 막힙니다. 되돌릴 수 없고, 다시 쓰려면
              맡긴 사람이 새로 연결해야 합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoke.isPending}>
              취소
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
              끊기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
