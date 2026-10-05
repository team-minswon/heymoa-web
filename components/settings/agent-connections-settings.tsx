"use client";

import { useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, ChevronDown, Copy, Info } from "lucide-react";

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
import { toast } from "@/lib/ui/toast";

type Delegation = AgentDelegationsResponseDataDelegationsItem;

/** 서버(APP-801)의 이름 상한과 같다. */
const NAME_MAX_LENGTH = 50;

const STATUS_LABEL: Record<Delegation["status"], string> = {
  ACTIVE: "연결됨",
  EXPIRED: "만료됨",
  REVOKED: "회수됨",
};

const DATE = { year: "numeric", month: "long", day: "numeric" } as const;
const DATE_TIME = {
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
} as const;

/**
 * MCP 도구 이름(server `agentdelegation/presentation/mcp/`)을 사람이 읽는 말로. 모르는 이름은 그대로
 * 보인다 — server 가 도구를 더해도 화면이 빈칸이 되지 않는다.
 */
const TOOL_LABEL: Record<string, string> = {
  get_connection: "연결 확인",
  list_projects: "프로젝트 목록",
  list_project_items: "프로젝트 항목 목록",
  get_project_item: "항목 상세",
  expand_relations: "관계 따라가기",
  list_open_tasks: "미완료 할 일",
  list_meetings: "회의 목록",
  get_meeting_transcript: "회의 전사",
  open_screen: "화면 열기",
};

/** 사용 내역을 한 번에 보이는 수. server 는 한 쪽에 20개를 주지만 화면은 8개씩 늘린다(APP-867). */
const USAGE_STEP = 8;
/**
 * 외부 에이전트 연결(APP-804). 팀원 본인이 워크스페이스를 맡기고 본인이 회수한다 — 그래서 계정 쪽
 * 설정이고, 목록은 워크스페이스와 상관없이 **내** 연결이다.
 *
 * 토큰 원문은 만든 응답에만 있다. 이 화면의 지역 상태로만 들고 있다가 창을 닫으면 버린다 — 캐시에도
 * 넣지 않으므로 다시 열어도 앞자리(`tokenHint`)만 보인다.
 */
export function AgentConnectionsSettings({
  workspaceId,
  onBusyChange,
}: {
  workspaceId: string;
  /** 토큰을 만드는 요청이 도는 동안 참이다. 설정 창이 이 동안 닫히거나 섹션이 바뀌지 않게 한다. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const delegationsQuery = useGetAgentDelegations();
  const [creating, setCreating] = useState(false);
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
  // 끊긴 연결도 사용 내역을 보려고 남는다(APP-825). 지우지 않으므로 살아 있는 것만 위에 두고 접는다.
  const active = delegations.filter(
    (delegation) => delegation.status === "ACTIVE"
  );
  const past = delegations.filter(
    (delegation) => delegation.status !== "ACTIVE"
  );

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
            외부 에이전트
          </h2>
          <p className="mt-2 text-sm text-[var(--el-muted)]">
            Claude Code·Codex CLI 같은 에이전트가 맡긴 워크스페이스의 프로젝트
            기억을 읽고 HeyMoa 화면을 열 수 있게 합니다.
          </p>
        </div>
        {!creating && !issued ? (
          <Button
            size="sm"
            className="h-8 shrink-0"
            onClick={() => setCreating(true)}
          >
            새 연결
          </Button>
        ) : null}
      </header>

      {issued ? (
        <IssuedToken
          name={issued.name}
          token={issued.token}
          onClose={() => setIssued(null)}
        />
      ) : creating ? (
        <NewConnectionForm
          defaultWorkspaceId={workspaceId}
          onBusyChange={onBusyChange}
          onCancel={() => setCreating(false)}
          onCreated={async (name, token) => {
            setCreating(false);
            setIssued({ name, token });
            await invalidate();
          }}
        />
      ) : null}

      <section aria-label="내 연결" className="mt-6">
        {delegationsQuery.isLoading ? (
          <div className="space-y-3" aria-label="연결 목록 불러오는 중">
            <Skeleton className="h-[88px] rounded-panel" />
            <Skeleton className="h-[88px] rounded-panel" />
          </div>
        ) : delegationsQuery.isError ? (
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
        ) : (
          <>
            {active.length === 0 ? (
              // 실패가 아니다 — 경고 색·아이콘을 쓰지 않는다.
              <div className="rounded-panel border border-dashed border-[var(--el-hairline)] p-6 text-center">
                <p className="text-sm text-[var(--el-ink)]">
                  {past.length === 0
                    ? "아직 연결한 에이전트가 없습니다."
                    : "지금 연결된 에이전트가 없습니다."}
                </p>
                <p className="mt-1 text-xs text-[var(--el-muted)]">
                  「새 연결」로 토큰을 받아 에이전트에 넣으면 여기에 보입니다.
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

/** 회수·만료된 연결. 기본은 접고, 펼치면 같은 행(사용 내역 포함)을 그린다. */
function PastConnections({
  delegations,
  onRevoked,
}: {
  delegations: Delegation[];
  onRevoked: () => Promise<unknown>;
}) {
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
        지난 연결 {delegations.length}개
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </Button>
      {open ? (
        <ul
          id="agent-past-connections"
          aria-label="지난 연결"
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
      ) : null}
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
  const workspacesQuery = useGetWorkspaces();
  const workspaces =
    workspacesQuery.data?.status === 200 && workspacesQuery.data.data.success
      ? workspacesQuery.data.data.data.workspaces
      : [];
  // 고를 수 있는 워크스페이스를 모르는 동안에는 만들지 않는다 — 실패를 빈 선택지로 삼키면
  // 보이지 않는 기본값으로 토큰이 나간다.
  const workspacesFailed =
    workspacesQuery.isError ||
    (workspacesQuery.data !== undefined && workspaces.length === 0);
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId);
  const [name, setName] = useState("");
  // 응답에 토큰 원문이 실린다. **mutation 캐시에도 남기지 않는다** — 읽자마자 `reset()` 하고,
  // 관찰자가 떠나는 즉시 지워지게 `gcTime: 0` 이다. 안 그러면 창을 닫아도 기본 보존 기간 동안
  // MutationCache 가 원문을 들고 있다.
  const create = useCreateAgentDelegation({ mutation: { gcTime: 0 } });
  // 응답 전에 창이 닫히면 발급된 토큰을 아무도 못 본다 — 요청이 도는 동안 설정 창을 잠근다
  useEffect(() => {
    onBusyChange?.(create.isPending);
  }, [create.isPending, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const trimmed = name.trim();
  const items = Object.fromEntries(
    workspaces.map((workspace) => [workspace.workspaceId, workspace.name])
  );

  const canSubmit =
    Boolean(trimmed) &&
    workspaces.some((workspace) => workspace.workspaceId === workspaceId);

  const submit = async () => {
    if (!canSubmit) return;
    // 거절은 여기서 소비한다 — 토스트는 전역 `MutationCache.onError` 가 띄운다.
    const response = await create
      .mutateAsync({ data: { workspaceId, name: trimmed } })
      .catch(() => null);
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
        <Label htmlFor="agent-connection-workspace">맡길 워크스페이스</Label>
        {workspacesQuery.isLoading ? (
          <Skeleton
            className="h-9 rounded-control"
            aria-label="워크스페이스 목록 불러오는 중"
          />
        ) : workspacesFailed ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-[var(--el-ink)]">
              워크스페이스 목록을 불러오지 못했습니다.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-[30px]"
              onClick={() => void workspacesQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        ) : (
          <Select
            items={items}
            value={workspaceId}
            onValueChange={(value) => value && setWorkspaceId(value)}
          >
            <SelectTrigger
              id="agent-connection-workspace"
              aria-label="맡길 워크스페이스"
            >
              <SelectValue />
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
      <div className="grid gap-2">
        <Label htmlFor="agent-connection-name">연결 이름</Label>
        <Input
          id="agent-connection-name"
          value={name}
          maxLength={NAME_MAX_LENGTH}
          placeholder="예: 노트북 Claude Code"
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      {/* PRD 「정한 것」 1·4·5 — 범위는 워크스페이스 전체이고, 회의 전사도 읽히며, 이 연결은 아무것도 바꾸지 않는다. */}
      <div className="flex items-start gap-2 rounded-block bg-[var(--el-canvas-soft)] p-3.5">
        <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
        <ul className="space-y-1 text-xs leading-relaxed text-[var(--el-muted)]">
          <li>
            이 워크스페이스의 프로젝트 전체가 열립니다. 연결한 뒤 생기는
            프로젝트도 포함됩니다.
          </li>
          {/* 게스트를 포함한 다른 참석자의 말이 내가 고른 외부 AI 로 간다 — 알고 맡기게 한다(APP-844) */}
          <li>회의 전사(참석자의 발화와 이름)도 에이전트가 읽습니다.</li>
          <li>
            에이전트는 읽기와 화면 열기만 하고 아무것도 바꾸지 않습니다. 내가 볼
            수 없는 것은 에이전트도 볼 수 없습니다.
          </li>
          <li>90일 동안 쓰지 않으면 저절로 만료됩니다.</li>
        </ul>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          disabled={create.isPending}
          onClick={onCancel}
        >
          취소
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-8"
          loading={create.isPending}
          disabled={!canSubmit || create.isPending}
        >
          토큰 만들기
        </Button>
      </div>
    </form>
  );
}

/**
 * 방금 만든 토큰. **이 화면을 떠나면 다시 볼 수 없다** — 서버도 원문을 저장하지 않는다. 그래서
 * 닫기 전에 복사하라고 분명히 말하고, 에이전트에 넣는 명령을 토큰째 보여 준다.
 */
function IssuedToken({
  name,
  token,
  onClose,
}: {
  name: string;
  token: string;
  onClose: () => void;
}) {
  const mcpUrl = buildUrl("/mcp");
  // 기본(local)은 명령을 실행한 폴더에서만 등록된다 — 폴더마다 따로 쓰는 사람이 있어 그대로 두고, 전역은 안내만 한다(APP-869)
  const claudeCode = `claude mcp add --transport http heymoa ${mcpUrl} --header "Authorization: Bearer ${token}"`;
  // Codex 는 config.toml 의 http_headers 로 토큰을 직접 싣는다 — 환경 변수를 거치면 두 단계가 된다(APP-869)
  const codex = [
    "cat >> ~/.codex/config.toml <<'EOF'",
    // 기존 파일이 줄바꿈 없이 끝나면 표 머리가 마지막 값에 붙어 TOML 이 깨진다 — 빈 줄로 띄운다
    "",
    "[mcp_servers.heymoa]",
    `url = "${mcpUrl}"`,
    `http_headers = { "Authorization" = "Bearer ${token}" }`,
    "EOF",
  ].join("\n");

  return (
    <section
      aria-label="새 토큰"
      className="space-y-5 rounded-panel border border-[var(--el-hairline)] bg-white p-5"
    >
      <div>
        <p className="text-sm font-medium text-[var(--el-ink)]">
          「{name}」 연결을 만들었습니다
        </p>
        <p className="mt-1 text-xs text-[var(--el-muted)]">
          이 토큰은 지금 한 번만 보입니다. 닫으면 다시 볼 수 없으니 복사해
          두세요.
        </p>
      </div>
      <CopyBlock label="토큰" value={token} />
      <CopyBlock label="Claude Code — 터미널에 붙여 넣기" value={claudeCode} />
      <CopyBlock label="Codex CLI — 터미널에 붙여 넣기" value={codex} />
      <p className="text-xs text-[var(--el-muted)]">
        Claude Code 는 명령을 실행한 폴더에서만 연결됩니다. 어느 폴더에서나
        쓰려면 <code>--scope user</code> 를 붙이세요. Codex 는 모든 폴더에서
        연결됩니다. 이미 heymoa 를 등록해
        두었다면 먼저 지우세요 — Claude Code 는{" "}
        <code>claude mcp remove heymoa</code>, Codex 는{" "}
        <code>~/.codex/config.toml</code> 의 <code>[mcp_servers.heymoa]</code>{" "}
        블록.
      </p>
      <div className="flex justify-end">
        <Button size="sm" className="h-8" onClick={onClose}>
          복사했습니다, 닫기
        </Button>
      </div>
    </section>
  );
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--el-muted)]">{label}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          aria-label={`${label} 복사`}
          onClick={() => {
            void navigator.clipboard
              ?.writeText(value)
              .then(() => toast.success(`${label}을(를) 복사했습니다.`))
              .catch(() =>
                toast.error("복사하지 못했습니다. 직접 선택해 복사해 주세요.")
              );
          }}
        >
          <Copy className="size-3.5" />
          복사
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-block bg-[var(--el-canvas-soft)] p-3 font-mono text-xs whitespace-pre-wrap break-all text-[var(--el-ink)]">
        {value}
      </pre>
    </div>
  );
}

function DelegationRow({
  delegation,
  onRevoked,
}: {
  delegation: Delegation;
  onRevoked: () => Promise<unknown>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const revoke = useRevokeAgentDelegation();
  const active = delegation.status === "ACTIVE";
  const historyId = `agent-usage-${delegation.delegationId}`;

  return (
    <li className="rounded-panel border border-[var(--el-hairline)] bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control bg-[var(--el-canvas-soft)]">
            <Bot className="size-4 text-[var(--el-muted)]" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium text-[var(--el-ink)]">
                {delegation.name}
              </p>
              <Badge variant={active ? "success" : "outline"}>
                {STATUS_LABEL[delegation.status]}
              </Badge>
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
              {formatAppDate(delegation.createdAt, DATE)} 연결 · 최근 사용{" "}
              {delegation.lastUsedAt
                ? formatAppDate(delegation.lastUsedAt, DATE)
                : "없음"}
              {active
                ? ` · ${formatAppDate(delegation.expiresAt, DATE)}까지 쓰지 않으면 만료`
                : null}
            </p>
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
            사용 내역
            <ChevronDown
              className={`size-3.5 transition-transform ${historyOpen ? "rotate-180" : ""}`}
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
                회수
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
                      「{delegation.name}」 연결을 회수할까요?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      이 토큰을 쓰는 에이전트는 다음 요청부터 막힙니다. 되돌릴
                      수 없고, 다시 쓰려면 새로 연결해야 합니다.
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
                        // 다이얼로그를 연 채 기다린다(`members-settings` 와 같은 패턴). 거절은
                        // 여기서 소비하고 토스트는 전역 `MutationCache.onError` 가 띄운다.
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
                      회수
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : null}
        </div>
      </div>
      {historyOpen ? (
        <UsageHistory id={historyId} delegationId={delegation.delegationId} />
      ) : null}
    </li>
  );
}

/**
 * 이 연결로 에이전트가 부른 도구(APP-826). 질문·답 본문은 server 가 남기지 않아 여기에도 없다 —
 * 언제 어느 도구로 몇 건을 받았는지만 보인다. 펼칠 때 읽고, 「더 보기」로 다음 쪽을 잇는다.
 */
function UsageHistory({
  id,
  delegationId,
}: {
  id: string;
  delegationId: string;
}) {
  const query = useInfiniteQuery({
    // 생성 훅의 단건 키와 모양이 달라 꼬리를 붙여 나눈다 — 같은 키를 두 모양이 쓰면 캐시가 섞인다.
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
  // 읽어 둔 것을 먼저 더 보이고, 모자라면 다음 쪽을 읽는다. 목표가 이미 읽어 둔 수를 넘었다면(다음 쪽을
  // 못 읽었거나 첫 쪽이 짧았다) 목표는 그대로 두고 읽기만 다시 한다 — 재시도가 8개를 더 펼치지 않게
  const showMore = () => {
    const next = visible > usages.length ? visible : visible + USAGE_STEP;
    setVisible(next);
    if (next > usages.length && query.hasNextPage) void query.fetchNextPage();
  };

  return (
    <section
      id={id}
      aria-label="사용 내역"
      className="mt-4 border-t border-[var(--el-hairline)] pt-3"
    >
      {query.isLoading ? (
        <ul className="space-y-2" aria-label="사용 내역 불러오는 중">
          {Array.from({ length: 3 }, (_, index) => (
            <li key={index} className="flex items-center gap-3 py-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </li>
          ))}
        </ul>
      ) : // 읽어 둔 쪽이 있으면 그 뒤의 실패(다음 쪽·다시 읽기)가 목록을 가리지 않는다
      query.isError && !query.data ? (
        <div role="alert" className="flex items-center gap-3">
          <p className="text-xs text-[var(--el-ink)]">
            사용 내역을 불러오지 못했습니다.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-[26px] text-xs"
            onClick={() => void query.refetch()}
          >
            다시 시도
          </Button>
        </div>
      ) : usages.length === 0 ? (
        // 아직 쓰지 않은 것뿐이다 — 실패처럼 보이지 않게 경고 색을 쓰지 않는다.
        <p className="text-xs text-[var(--el-muted)]">
          아직 이 연결로 에이전트가 부른 도구가 없습니다.
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
                  {formatAppDate(usage.occurredAt, DATE_TIME)}
                </span>
                <span className="min-w-0 truncate text-[var(--el-ink)]">
                  {TOOL_LABEL[usage.toolName] ?? usage.toolName}
                </span>
                {usage.outcome === "FAILED" ? (
                  <Badge variant="outline">실패</Badge>
                ) : usage.resultCount !== null ? (
                  <span className="text-[var(--el-muted)] tabular-nums">
                    {usage.resultCount}건
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {query.isFetchNextPageError ? (
            <p role="alert" className="mt-2 text-xs text-[var(--el-ink)]">
              다음 내역을 불러오지 못했습니다. 「더 보기」로 다시 시도해 주세요.
            </p>
          ) : null}
          {usages.length > visible || query.hasNextPage ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs"
              loading={query.isFetchingNextPage}
              disabled={query.isFetchingNextPage}
              onClick={showMore}
            >
              더 보기
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
