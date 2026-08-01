"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleDashed,
  ListChecks,
  SearchX,
  UserRound,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { DataBoundary } from "@/components/ui/data-boundary";
import {
  ControlChip,
  EmptyState,
  FilterBar,
  PageBody,
  PageContent,
  PageHead,
  SearchField,
  Sheet,
} from "@/components/workspace/page-chrome";
import type { ActionItem } from "@/lib/api/generated/models";
import {
  getGetActionItemsQueryKey,
  useGetActionItemsSuspense,
  useUpdateActionItem,
} from "@/lib/api/generated/action-items/action-items";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";
import { formatDueDate } from "@/lib/format/date";
import { groupActionItemsByDue } from "@/lib/workspace/action-item-groups";
import { usePinnedNow } from "@/lib/workspace/use-pinned-now";
import { cn } from "@/lib/utils";

/** 담당자 필터의 특수 값 — 계약이 쓰는 이름 그대로다. */
const UNASSIGNED = "UNASSIGNED";

const COL = {
  check: "w-10",
  note: "w-60",
  assignee: "w-[150px]",
  due: "w-[130px]",
} as const;

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
      className="flex h-12 items-center gap-3 border-b border-[var(--el-hairline)] last:border-b-0"
    >
      <span className={cn("flex shrink-0 justify-start", COL.check)}>
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
      <span
        className={cn(
          "shrink-0 truncate text-[12px] text-[var(--el-muted)]",
          COL.note
        )}
      >
        {item.noteTitle}
      </span>
      <span
        className={cn("flex shrink-0 items-center gap-2 text-[12px]", COL.assignee)}
      >
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
          "shrink-0 text-[12px]",
          COL.due,
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

function ActionItemsTable({
  workspaceId,
  showDone,
  needle,
  assigneeId,
}: {
  workspaceId: string;
  showDone: boolean;
  needle: string;
  assigneeId: string | null;
}) {
  // 완료 포함 여부만 서버에 넘긴다 — 담당자·검색은 이미 받아 둔 목록 위에서 걸러야
  // 필터를 바꿀 때마다 화면이 비었다 채워지지 않는다.
  const response = useGetActionItemsSuspense(workspaceId, {
    status: showDone ? "ALL" : "OPEN",
  });
  const items = useMemo<ActionItem[]>(
    () =>
      response.data.status === 200 && response.data.data.success
        ? (response.data.data.data.actionItems ?? [])
        : [],
    [response.data]
  );
  const visible = useMemo(
    () =>
      items
        .filter((item) =>
          assigneeId === null
            ? true
            : assigneeId === UNASSIGNED
              ? item.assignee === null
              : item.assignee?.userId === assigneeId
        )
        .filter((item) =>
          needle ? item.text.toLowerCase().includes(needle) : true
        ),
    [items, assigneeId, needle]
  );
  // 그룹 경계는 시각이라 렌더 중에 읽으면 서버와 클라이언트가 갈려 hydration이 어긋난다.
  // 마운트 뒤에 한 번만 잡고, 그 뒤로는 고정한다 — 사용자가 보고 있는 동안 행이 묶음
  // 사이를 넘나들면 방금 읽은 자리를 잃는다.
  const now = usePinnedNow();
  const groups = useMemo(
    () => (now === null ? [] : groupActionItemsByDue(visible, now)),
    [visible, now]
  );

  if (now === null) return <TableSkeleton />;

  if (!visible.length) {
    // 걸러서 빈 것과 애초에 없는 것은 다른 말을 해야 한다 — 같은 문구면 필터를 못 푼다.
    const filtered = items.length > 0;
    return (
      <EmptyState
        icon={filtered ? SearchX : ListChecks}
        title={
          filtered ? "조건에 맞는 할 일이 없습니다" : "아직 모을 할 일이 없습니다"
        }
        description={
          filtered
            ? "담당자·검색어를 바꾸거나 완료한 항목도 켜 보세요."
            : "액션 아이템은 회의 분석에서 나옵니다. 회의를 끝내고 분석이 완료되면 여기에 담당자와 기한으로 묶여 쌓입니다."
        }
      />
    );
  }

  return (
    <Sheet className="px-5 py-2">
      <div className="flex h-10 items-center gap-3 border-b border-[var(--el-hairline)] text-[12px] font-semibold text-[var(--el-muted)]">
        <span className={cn("shrink-0", COL.check)} />
        <span className="min-w-0 flex-1">할 일</span>
        <span className={cn("shrink-0", COL.note)}>회의</span>
        <span className={cn("shrink-0", COL.assignee)}>담당자</span>
        <span className={cn("shrink-0", COL.due)}>기한</span>
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
    </Sheet>
  );
}

function TableSkeleton() {
  return (
    <Sheet className="px-5 py-2">
      <Skeleton className="my-3 h-4 w-24" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex h-12 items-center gap-3 border-b border-[var(--el-hairline)] last:border-b-0"
        >
          <Skeleton className="size-4 rounded-[4px]" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className={cn("h-2.5", COL.note)} />
          <Skeleton className={cn("h-2.5", COL.assignee)} />
          <Skeleton className={cn("h-2.5", COL.due)} />
        </div>
      ))}
    </Sheet>
  );
}

export function ActionItemsPage({ workspaceId }: { workspaceId: string }) {
  const [showDone, setShowDone] = useState(false);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const membersQuery = useGetWorkspaceMembers(workspaceId);
  const members =
    membersQuery.data?.status === 200 && membersQuery.data.data.success
      ? membersQuery.data.data.data.members
      : [];
  const assigneeLabel =
    assigneeId === null
      ? "담당자 전체"
      : assigneeId === UNASSIGNED
        ? "미지정"
        : (members.find((member) => member.userId === assigneeId)?.name ??
          "담당자");

  return (
    <PageBody>
      <PageHead
        title="액션 아이템"
        description="회의 분석에서 나온 할 일을 기한으로 묶습니다."
        actions={
          <SearchField
            label="할 일 찾기"
            placeholder="할 일 내용으로 찾기"
            value={search}
            onChange={setSearch}
          />
        }
      />
      <FilterBar>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <ControlChip
                icon={UserRound}
                label={assigneeLabel}
                active={assigneeId !== null}
              />
            }
          />
          <DropdownMenuContent align="start" className="w-56">
            {[
              { id: null, name: "담당자 전체" },
              { id: UNASSIGNED, name: "미지정" },
              ...members.map((member) => ({
                id: member.userId,
                name: member.name,
              })),
            ].map((option) => (
              <DropdownMenuItem
                key={option.id ?? "all"}
                onClick={() => setAssigneeId(option.id)}
                className="justify-between rounded-control py-2 text-sm"
              >
                <span className="truncate">{option.name}</span>
                {assigneeId === option.id ? (
                  <Check className="size-3.5 shrink-0" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <ControlChip
          icon={CircleDashed}
          label={showDone ? "완료 포함" : "미완료만"}
          active={showDone}
          aria-pressed={showDone}
          onClick={() => setShowDone((current) => !current)}
        />
      </FilterBar>
      <PageContent>
        <DataBoundary
          fallback={<TableSkeleton />}
          errorLabel="액션 아이템을 불러오지 못했습니다"
          resetKeys={[workspaceId, String(showDone)]}
        >
          <ActionItemsTable
            workspaceId={workspaceId}
            showDone={showDone}
            needle={search.trim().toLowerCase()}
            assigneeId={assigneeId}
          />
        </DataBoundary>
      </PageContent>
    </PageBody>
  );
}
