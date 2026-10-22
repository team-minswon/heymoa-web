"use client";

import { Fragment, useCallback, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { BellOff } from "lucide-react";

import {
  describeNotification,
  NotificationRow,
  notificationTime,
  type RowActions,
} from "@/components/notification/notification-row";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineRetry } from "@/components/ui/inline-retry";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { track } from "@/lib/analytics/track";
import { errorCodeOf } from "@/lib/api/error-message";
import { useGetNotificationSettings } from "@/lib/api/generated/notification-settings/notification-settings";
import {
  getGetNotificationsQueryKey,
  getGetUnreadNotificationCountQueryKey,
  useMarkAllNotificationsRead,
} from "@/lib/api/generated/notifications/notifications";
import {
  useAcceptWorkspaceInvitation,
  useDeclineWorkspaceInvitation,
} from "@/lib/api/generated/workspace-invitations/workspace-invitations";
import {
  getGetWorkspacesQueryKey,
  useGetWorkspaces,
} from "@/lib/api/generated/workspaces/workspaces";
import type { SettingsSection } from "@/lib/workspace/settings-url";
import {
  countNewer,
  dayLabel,
  fetchNotificationPage,
  markReadInCache,
  nextCursor,
  notificationHeadKey,
  notificationListKey,
  notificationModalMemory,
  rememberNotificationModal,
  UNREAD_COUNT_POLL_MS,
  updateNotificationsInCache,
  type NotificationCursor,
  type NotificationFilter,
  type NotificationItem,
} from "@/lib/notification/notification-list";
import { useReadNotification } from "@/lib/notification/use-notification-read";

/** 목록 칸의 스크롤을 옮긴다. 렌더 밖(이벤트·ref 콜백)에서만 부른다. */
function scrollListTo(node: HTMLElement | null, top: number) {
  if (node) node.scrollTop = top;
}

const TABS: { value: NotificationFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "UNREAD", label: "안 읽음" },
  { value: "ACTION_REQUIRED", label: "처리 필요" },
];

/** 무한 목록은 모달이 닫혀도 오래 남긴다 — 다시 열 때 불러온 쪽을 그대로 보여 준다. */
const LIST_GC_MS = 30 * 60_000;

/**
 * 알림 모달(PRO-67 I09). 모든 워크스페이스의 알림을 서버 필터 탭 셋으로 본다.
 *
 * - 목록은 **열려 있을 때만** 읽는다. 쪽은 커서 「더 보기」로 붙이고, 닫았다 열면 불러온 쪽·탭·스크롤을 그대로 둔다.
 * - 읽는 도중 도착한 알림은 끼워 넣지 않고 「새 알림 N개」로만 알린다(첫 쪽을 따로 다시 읽어 센다).
 * - 「모두 읽음」은 첫 쪽 응답의 서버 시각(`upTo`)까지만 읽는다 — 그 뒤 도착한 알림은 안 읽음으로 남는다.
 */
export function NotificationModal({
  open,
  onOpenChange,
  workspaceId,
  unreadCount,
  onOpenSettings,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  unreadCount: number | undefined;
  onOpenSettings: (section: SettingsSection) => void;
  /** 다른 화면으로 간다(검토할 결과 준비 행) */
  onNavigate: (href: string) => void;
}) {
  const queryClient = useQueryClient();
  const [filter, setFilterState] = useState<NotificationFilter>(
    notificationModalMemory.filter
  );
  const setFilter = (next: NotificationFilter) => {
    rememberNotificationModal({ filter: next });
    rememberNotificationModal({ scrollTop: 0 });
    setFilterState(next);
    scrollListTo(viewportRef.current, 0);
  };
  const viewportRef = useRef<HTMLDivElement | null>(null);
  /** 모달이 열려 목록 칸이 붙는 순간 마지막 스크롤 자리로 — 불러온 쪽은 캐시에 있어 이미 그려져 있다. */
  const attachViewport = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    if (node) node.scrollTop = notificationModalMemory.scrollTop;
  }, []);

  const list = useInfiniteQuery({
    queryKey: notificationListKey(filter),
    queryFn: async ({ pageParam, signal }) => {
      const page = await fetchNotificationPage(filter, pageParam, signal);
      // 첫 쪽은 「새 알림」 셈의 출발점이다 — 같은 응답으로 채워 두어 열자마자 같은 쪽을 두 번 읽지 않는다.
      if (!pageParam.afterNotificationId)
        queryClient.setQueryData(notificationHeadKey(filter), page);
      return page;
    },
    initialPageParam: {} as NotificationCursor,
    getNextPageParam: nextCursor,
    enabled: open,
    // 다시 열 때 불러온 쪽을 차례로 다시 읽지 않는다. 새 알림은 아래 첫 쪽 조회가 센다.
    staleTime: Infinity,
    gcTime: LIST_GC_MS,
  });
  const items = list.data?.pages.flatMap((page) => page.notifications) ?? [];
  const firstPage = list.data?.pages[0];

  const head = useQuery({
    queryKey: notificationHeadKey(filter),
    queryFn: ({ signal }) => fetchNotificationPage(filter, {}, signal),
    enabled: open && list.isSuccess,
    staleTime: UNREAD_COUNT_POLL_MS,
    refetchInterval: open ? UNREAD_COUNT_POLL_MS : false,
  });
  const newCount = head.data ? countNewer(head.data.notifications, items) : 0;

  const settings = useGetNotificationSettings({ query: { enabled: open } });
  const webMuted =
    settings.data?.status === 200 && settings.data.data.success
      ? settings.data.data.data.muteAll
      : false;

  const close = () => {
    if (viewportRef.current)
      rememberNotificationModal({ scrollTop: viewportRef.current.scrollTop });
    onOpenChange(false);
  };

  const readNotification = useReadNotification();
  const markAll = useMarkAllNotificationsRead();
  const refreshCount = () =>
    void queryClient.invalidateQueries({
      queryKey: getGetUnreadNotificationCountQueryKey(),
    });

  const readAll = () => {
    const upTo = firstPage?.serverTime;
    if (!upTo) return;
    track("notifications_all_read_clicked", {
      workspace_id: workspaceId,
      count: unreadCount ?? 0,
    });
    markAll.mutate(
      { data: { upTo } },
      {
        onSuccess: () => {
          // 보이는 행이 함께 읽음으로 바뀐다(점이 동시에 빠진다). 기준 시각 뒤에 온 것은 그대로 둔다.
          markReadInCache(
            queryClient,
            (item) => item.createdAt <= upTo,
            new Date().toISOString()
          );
          refreshCount();
        },
      }
    );
  };

  const accept = useAcceptWorkspaceInvitation();
  const decline = useDeclineWorkspaceInvitation();
  const [declineTarget, setDeclineTarget] = useState<NotificationItem | null>(
    null
  );
  const [now] = useState(() => Date.now());
  // 내 워크스페이스 목록 — 사이드바가 이미 읽어 캐시에 있다. 없는 워크스페이스의 알림은 이동을 막는다(권한 없음).
  const workspacesQuery = useGetWorkspaces({ query: { enabled: open } });
  const myWorkspaceIds =
    workspacesQuery.data?.status === 200 && workspacesQuery.data.data.success
      ? new Set(
          workspacesQuery.data.data.data.workspaces.map(
            (workspace) => workspace.workspaceId
          )
        )
      : null;

  /** 초대를 처리한 결과를 행에 바로 적는다. 목록을 다시 읽지 않는다. */
  const settleInvitation = (
    target: NotificationItem,
    status: "ACCEPTED" | "DECLINED"
  ) => {
    updateNotificationsInCache(queryClient, (item) =>
      item.notificationId === target.notificationId && item.invitation
        ? { ...item, invitation: { ...item.invitation, status } }
        : item
    );
    if (target.readAt === null) readNotification(target.notificationId);
  };
  /** 이미 처리됐거나 만료된 초대다(409) — 서버 문구는 전역 토스트가 띄우고, 목록을 새 상태로 다시 읽는다. */
  const onInvitationError = (error: unknown) => {
    const code = errorCodeOf(error);
    if (code === "INVITATION_NOT_PENDING" || code === "INVITATION_EXPIRED") {
      void queryClient.invalidateQueries({
        queryKey: getGetNotificationsQueryKey(),
      });
    }
  };
  const invitationActions: RowActions = {
    pending: accept.isPending || decline.isPending,
    openNote: (targetWorkspaceId, noteId) => {
      close();
      onNavigate(
        `/w/${targetWorkspaceId}/notes/${noteId}?view=full&tab=summary&source=notification`
      );
    },
    canOpen: (targetWorkspaceId) =>
      myWorkspaceIds === null || myWorkspaceIds.has(targetWorkspaceId),
    now,
    accept: (target) =>
      accept.mutate(
        { invitationId: target.invitation!.invitationId },
        {
          onSuccess: () => {
            settleInvitation(target, "ACCEPTED");
            // 합류한 워크스페이스가 사이드바 목록에 생긴다.
            void queryClient.invalidateQueries({
              queryKey: getGetWorkspacesQueryKey(),
            });
          },
          onError: onInvitationError,
        }
      ),
    // 거절은 되돌릴 수 없어 확인 창을 거친다.
    decline: (target) => setDeclineTarget(target),
  };

  const showNew = () => {
    scrollListTo(viewportRef.current, 0);
    // 첫 쪽부터 다시 — 불러온 쪽을 차례로 다시 읽지 않는다.
    void queryClient.resetQueries({
      queryKey: notificationListKey(filter),
      exact: true,
    });
  };

  const openSettings = () => {
    close();
    track("settings_tab_opened", {
      workspace_id: workspaceId,
      section: "notifications",
      from: "modal",
    });
    onOpenSettings("notifications");
  };

  const rowsFor = (item: NotificationItem) => {
    const view = describeNotification(item, invitationActions);
    const activate = view.onActivate;
    return {
      ...view,
      onActivate: activate
        ? () => {
            rememberNotificationModal({
              lastNotificationId: item.notificationId,
            });
            track("notification_clicked", {
              workspace_id: workspaceId,
              type: item.type,
              was_unread: item.readAt === null,
            });
            if (viewportRef.current)
              rememberNotificationModal({
                scrollTop: viewportRef.current.scrollTop,
              });
            activate();
          }
        : undefined,
    };
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      >
        <DialogContent className="flex max-h-[min(720px,calc(100dvh-4rem))] flex-col gap-0 overflow-hidden bg-[var(--el-surface-card)] p-0 sm:max-w-[540px]">
          <DialogHeader className="gap-0.5 px-[18px] pt-4 pb-2.5">
            <DialogTitle>알림</DialogTitle>
            <DialogDescription className="text-xs">
              모든 워크스페이스
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-1 border-b border-[var(--el-hairline)] pr-3 pl-[18px]">
            <Tabs
              value={filter}
              onValueChange={(value) => setFilter(value as NotificationFilter)}
            >
              <TabsList variant="line" className="gap-3">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <span className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!firstPage?.serverTime || !unreadCount}
              loading={markAll.isPending}
              onClick={readAll}
            >
              모두 읽음으로 표시
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={openSettings}
            >
              알림 설정
            </Button>
          </div>

          <ScrollArea
            className="min-h-0 flex-1"
            viewportRef={attachViewport}
            viewportClassName="max-h-[min(560px,calc(100dvh-14rem))] overflow-x-hidden"
          >
            {newCount > 0 ? (
              <div className="sticky top-0 z-10 flex justify-center pt-2 pb-0.5">
                <button
                  type="button"
                  onClick={showNew}
                  className="rounded-full bg-[var(--el-ink)] px-2.5 py-[3px] text-xs text-white shadow-e2"
                >
                  새 알림 {newCount}개
                </button>
              </div>
            ) : null}
            {webMuted ? (
              <div className="mx-2 mt-2 flex items-center gap-2 rounded-block bg-[var(--el-canvas-soft)] px-3 py-2 text-[13px] text-[var(--el-body)]">
                <BellOff
                  aria-hidden
                  className="size-4 text-[var(--el-muted)]"
                />
                웹 알림이 꺼져 있습니다
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto h-[26px]"
                  onClick={openSettings}
                >
                  설정 열기
                </Button>
              </div>
            ) : null}
            <NotificationListBody
              filter={filter}
              items={items}
              isLoading={list.isLoading}
              isError={list.isError && !list.data}
              onRetry={() => void list.refetch()}
              onShowAll={() => setFilter("ALL")}
              renderRow={(item, timeLabel) => (
                <NotificationRow
                  key={item.notificationId}
                  notification={item}
                  view={rowsFor(item)}
                  timeLabel={timeLabel}
                  highlighted={
                    item.notificationId ===
                    notificationModalMemory.lastNotificationId
                  }
                  onRead={() => readNotification(item.notificationId)}
                />
              )}
            />
            {list.isFetchNextPageError ? (
              <InlineRetry
                variant="line"
                label="알림을 더 불러오지 못했습니다"
                className="justify-center px-4 py-3"
                onRetry={() => void list.fetchNextPage()}
              />
            ) : list.hasNextPage ? (
              <div className="flex justify-center pt-2 pb-4">
                <LoadMoreButton
                  loading={list.isFetchingNextPage}
                  loadingLabel="알림 더 불러오는 중"
                  onClick={() => void list.fetchNextPage()}
                >
                  더 보기
                </LoadMoreButton>
              </div>
            ) : null}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={declineTarget !== null}
        onOpenChange={(next) => !next && setDeclineTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>초대를 거절할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              거절하면 다시 참여하려면 새 초대가 필요합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={decline.isPending}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              loading={decline.isPending}
              onClick={() => {
                const target = declineTarget;
                if (!target?.invitation) return;
                decline.mutate(
                  { invitationId: target.invitation.invitationId },
                  {
                    onSuccess: () => settleInvitation(target, "DECLINED"),
                    onError: onInvitationError,
                    onSettled: () => setDeclineTarget(null),
                  }
                );
              }}
            >
              거절
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const EMPTY: Record<NotificationFilter, { line: string; sub?: string }> = {
  ALL: {
    line: "초대와 검토할 결과 알림이 여기에 도착합니다.",
    sub: "읽은 알림도 사라지지 않습니다.",
  },
  UNREAD: { line: "안 읽은 알림이 없습니다." },
  ACTION_REQUIRED: { line: "응답할 초대나 검토할 결과가 없습니다." },
};

function NotificationListBody({
  filter,
  items,
  isLoading,
  isError,
  onRetry,
  onShowAll,
  renderRow,
}: {
  filter: NotificationFilter;
  items: NotificationItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onShowAll: () => void;
  renderRow: (item: NotificationItem, timeLabel: string) => React.ReactNode;
}) {
  if (isLoading) {
    return (
      <ul aria-label="알림 불러오는 중" className="px-2 py-1">
        {[0, 1, 2, 3].map((index) => (
          <li key={index} className="flex gap-[10px] px-2.5 py-2.5">
            <span className="w-[7px] shrink-0" />
            <div className="flex flex-1 flex-col gap-[3px]">
              <Skeleton className="my-[5px] h-[11px] w-4/5 rounded-chip" />
              <Skeleton className="my-[3px] h-[9px] w-2/5 rounded-chip" />
            </div>
            <span className="w-[104px] shrink-0" />
          </li>
        ))}
      </ul>
    );
  }
  if (isError) {
    return (
      <InlineRetry
        label="알림을 불러오지 못했습니다"
        className="m-4"
        onRetry={onRetry}
      />
    );
  }
  if (items.length === 0) {
    const empty = EMPTY[filter];
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <p className="text-sm text-[var(--el-ink)]">{empty.line}</p>
        {empty.sub ? (
          <p className="text-xs text-[var(--el-muted)]">{empty.sub}</p>
        ) : null}
        {filter === "UNREAD" ? (
          <Button variant="outline" size="sm" onClick={onShowAll}>
            전체 보기
          </Button>
        ) : null}
      </div>
    );
  }
  // 전체 탭은 날짜로 묶는다. 다른 탭은 행마다 날짜를 붙인다.
  const grouped = filter === "ALL";
  return (
    <ul className="px-2 pb-1">
      {items.map((item, index) => {
        const day = dayLabel(item.createdAt);
        const header =
          grouped &&
          (index === 0 || dayLabel(items[index - 1].createdAt) !== day)
            ? day
            : null;
        const time = notificationTime(item.createdAt);
        return (
          <Fragment key={item.notificationId}>
            {header ? (
              <li
                aria-hidden
                className="px-2.5 pt-3 pb-1 text-[11.5px] tracking-[0.02em] text-[var(--el-muted)]"
              >
                {header}
              </li>
            ) : null}
            {renderRow(item, grouped ? time : `${day} ${time}`)}
          </Fragment>
        );
      })}
    </ul>
  );
}
