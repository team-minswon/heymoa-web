"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { DataBoundary } from "@/components/ui/data-boundary";
import type { ActionItem } from "@/lib/api/generated/models";
import {
  getGetActionItemsQueryKey,
  useGetActionItemsSuspense,
  useUpdateActionItem,
} from "@/lib/api/generated/action-items/action-items";
import { useQueryClient } from "@tanstack/react-query";
import { groupActionItemsByDue } from "@/lib/workspace/action-item-groups";
import { formatDueDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";

/**
 * 묶음 경계로 쓸 「지금」. 렌더 중에 Date.now()를 부르면 서버와 클라이언트가 갈려
 * hydration이 어긋나므로 서버 스냅샷은 null이다 — 그동안은 스켈레톤을 보여준다.
 *
 * 클라이언트 값은 한 번 읽고 고정한다. 매번 새로 읽으면 useSyncExternalStore가
 * 스냅샷이 계속 바뀐다고 보고 무한 렌더에 빠지고, 그게 아니라도 사용자가 보고 있는
 * 동안 행이 묶음 사이를 넘나들어 방금 읽은 자리를 잃는다.
 */
let pinnedNow: number | null = null;
const NEVER_CHANGES = () => () => {};
const getClientNow = () => (pinnedNow ??= Date.now());
const getServerNow = () => null;

function Initial({ name }: { name: string }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-[var(--el-body)]">
      {name.slice(0, 1)}
    </span>
  );
}

function Row({
  item,
  overdue,
  workspaceId,
}: {
  item: ActionItem;
  overdue: boolean;
  workspaceId: string;
}) {
  const client = useQueryClient();
  const update = useUpdateActionItem({
    mutation: {
      onSuccess: () =>
        client.invalidateQueries({
          queryKey: getGetActionItemsQueryKey(workspaceId),
        }),
    },
  });
  const done = item.status === "DONE";

  return (
    <li
      data-testid="action-item-row"
      className="flex h-12 items-center gap-3 border-b border-[var(--el-hairline)]"
    >
      <span className="flex w-10 shrink-0 justify-start">
        <input
          type="checkbox"
          aria-label={`${item.text} 완료`}
          checked={done}
          disabled={update.isPending}
          onChange={() =>
            update.mutate({
              actionItemId: item.actionItemId,
              data: { status: done ? "OPEN" : "DONE" },
            })
          }
          className="size-4 rounded-[4px] border border-[var(--control-border)] accent-[var(--el-primary)]"
        />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] font-medium",
          done && "text-[var(--el-muted)] line-through"
        )}
      >
        {item.text}
      </span>
      <span className="w-60 shrink-0 truncate text-[12px] text-[var(--el-muted)]">
        {item.noteTitle}
      </span>
      <span className="flex w-[150px] shrink-0 items-center gap-2 text-[12px]">
        {item.assignee ? (
          <>
            <Initial name={item.assignee.name} />
            <span className="truncate text-[var(--el-body)]">
              {item.assignee.name}
            </span>
          </>
        ) : (
          <span className="text-[var(--el-muted)]">미지정</span>
        )}
      </span>
      <span
        className={cn(
          "w-[130px] shrink-0 text-[12px]",
          overdue
            ? "font-medium text-[var(--destructive)]"
            : item.dueAt
              ? "text-[var(--el-body)]"
              : "text-[var(--el-muted)]"
        )}
      >
        {item.dueAt ? formatDueDate(item.dueAt) : "—"}
      </span>
    </li>
  );
}

function ActionItemsTable({ workspaceId }: { workspaceId: string }) {
  const [showDone, setShowDone] = useState(false);
  const query = useGetActionItemsSuspense(workspaceId, {
    status: showDone ? "ALL" : "OPEN",
  });
  const items = useMemo<ActionItem[]>(
    () =>
      query.data.status === 200 && query.data.data.success
        ? (query.data.data.data.actionItems ?? [])
        : [],
    [query.data]
  );
  // 그룹 경계는 시각이라 렌더 중에 읽으면 서버와 클라이언트가 갈려 hydration이 어긋난다.
  // 마운트 뒤에 한 번만 잡고, 그 뒤로는 고정한다 — 사용자가 보고 있는 동안 행이 묶음
  // 사이를 넘나들면 방금 읽은 자리를 잃는다.
  const now = useSyncExternalStore(NEVER_CHANGES, getClientNow, getServerNow);
  const groups = useMemo(
    () => (now === null ? [] : groupActionItemsByDue(items, now)),
    [items, now]
  );

  if (now === null) return <TableSkeleton />;

  if (!items.length) {
    return (
      <div className="rounded-panel border border-[var(--el-hairline)] bg-card px-8 py-16 text-center">
        <p className="text-[15px] font-medium">아직 모을 할 일이 없습니다</p>
        <p className="mt-2 text-[13px] leading-6 text-[var(--el-muted)]">
          액션 아이템은 회의 분석에서 나옵니다. 회의를 끝내고 분석이 완료되면
          <br />
          여기에 담당자와 기한으로 묶여 쌓입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-panel border border-[var(--el-hairline)] bg-card px-5 py-2">
      <div className="flex h-10 items-center gap-3 border-b border-[var(--el-hairline)] text-[12px] font-semibold text-[var(--el-muted)]">
        <span className="w-10 shrink-0" />
        <span className="min-w-0 flex-1">할 일</span>
        <span className="w-60 shrink-0">회의</span>
        <span className="w-[150px] shrink-0">담당자</span>
        <span className="w-[130px] shrink-0">기한</span>
      </div>
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="flex h-[34px] items-center justify-between text-[12px] font-semibold">
            {group.label}
            <span className="font-normal text-[var(--el-muted)]">
              {group.items.length}건
            </span>
          </h3>
          <ul>
            {group.items.map((item) => (
              <Row
                key={item.actionItemId}
                item={item}
                overdue={group.key === "overdue"}
                workspaceId={workspaceId}
              />
            ))}
          </ul>
        </section>
      ))}
      <label className="flex h-11 items-center gap-2 text-[12px] text-[var(--el-muted)]">
        <input
          type="checkbox"
          checked={showDone}
          onChange={(event) => setShowDone(event.target.checked)}
          className="size-4 rounded-[4px] border border-[var(--control-border)]"
        />
        완료한 항목도 보기
      </label>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-panel border border-[var(--el-hairline)] bg-card px-5 py-2">
      <Skeleton className="my-3 h-4 w-24" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex h-12 items-center gap-3 border-b border-[var(--el-hairline)]"
        >
          <Skeleton className="size-4 rounded-[4px]" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-2.5 w-60" />
          <Skeleton className="h-2.5 w-[150px]" />
          <Skeleton className="h-2.5 w-[130px]" />
        </div>
      ))}
    </div>
  );
}

export function ActionItemsPage({ workspaceId }: { workspaceId: string }) {
  return (
    // 셸이 overflow-hidden 이라 페이지가 스스로 스크롤 경계를 만든다.
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-8 pb-7 pt-6">
      <header className="pb-4">
        <h1 className="text-note-title font-serif font-light">액션 아이템</h1>
        <p className="mt-1 text-[13px] text-[var(--el-muted)]">
          회의 분석에서 나온 할 일을 기한으로 묶습니다.
        </p>
      </header>
      <DataBoundary
        fallback={<TableSkeleton />}
        errorLabel="액션 아이템을 불러오지 못했습니다"
        resetKeys={[workspaceId]}
      >
        <ActionItemsTable workspaceId={workspaceId} />
      </DataBoundary>
      </div>
    </div>
  );
}
