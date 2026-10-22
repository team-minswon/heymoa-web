"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
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
import { cn } from "@/lib/utils";

/** 목록 칸의 스크롤을 옮긴다. 렌더 밖(이벤트·ref 콜백)에서만 부른다. */
function scrollListTo(node: HTMLElement | null, top: number) {
  if (node) node.scrollTop = top;
}

/**
 * 노트 패널과 같은 밑줄 탭. 버튼은 글자 높이(28px)로 줄 가운데에 두고, 밑줄만 7px 내려 탭 줄의 hairline 위에 앉힌다.
 * 포커스는 키보드일 때만 글자를 감싸는 1px 링 — primitive 의 3px 링은 이 작은 글자 탭에 너무 두껍다.
 */
const TAB_ITEM =
  "-mx-1.5 h-7 flex-none px-1.5 text-[13px] group-data-horizontal/tabs:after:inset-x-1.5 group-data-horizontal/tabs:after:bottom-[-7px] focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none";

/** 탭 줄 오른쪽의 보조 동작. 둘 다 같은 옅은 글자색이고 hover 에서 먹색이 된다. */
const ACTION =
  "h-7 px-2 text-xs font-normal text-[var(--el-body)] hover:text-[var(--el-ink)]";

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
  filter,
  onFilterChange,
  onClose,
  workspaceId,
  unreadCount,
  onOpenSettings,
  onNavigate,
}: {
  open: boolean;
  /** 보이는 탭. 주소가 정한다(`notification-url`) */
  filter: NotificationFilter;
  /** 탭을 바꾼다 — 방문 기록을 한 칸 쌓는다 */
  onFilterChange: (filter: NotificationFilter) => void;
  /** 닫는다. 쌓은 기록을 걷은 뒤 `then` 을 한다(이동·설정 열기) */
  onClose: (then?: () => void) => void;
  workspaceId: string;
  unreadCount: number | undefined;
  onOpenSettings: (section: SettingsSection) => void;
  /** 다른 화면으로 간다(검토할 결과 준비 행) */
  onNavigate: (href: string) => void;
}) {
  const queryClient = useQueryClient();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const setFilter = (next: NotificationFilter) => {
    if (next !== filter) onFilterChange(next);
  };
  // 탭이 바뀌면(누르기·뒤로 가기 모두) 목록 맨 위에서 시작한다.
  const shownFilterRef = useRef(filter);
  useEffect(() => {
    if (shownFilterRef.current === filter) return;
    shownFilterRef.current = filter;
    rememberNotificationModal({ scrollTop: 0 });
    scrollListTo(viewportRef.current, 0);
  }, [filter]);
  const popupRef = useRef<HTMLDivElement | null>(null);
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

  const close = (then?: () => void) => {
    if (viewportRef.current)
      rememberNotificationModal({ scrollTop: viewportRef.current.scrollTop });
    onClose(then);
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
      // 모달 쿼리를 걷은 뒤에 간다 — 노트에서 뒤로 가기가 모달이 열린 칸으로 돌아오지 않게.
      close(() =>
        onNavigate(
          `/w/${targetWorkspaceId}/notes/${noteId}?view=full&tab=summary&source=notification`
        )
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
    track("settings_tab_opened", {
      workspace_id: workspaceId,
      section: "notifications",
      from: "modal",
    });
    close(() => onOpenSettings("notifications"));
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
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        {/*
          크기는 내용과 상관없이 고정이다 — 탭을 바꾸거나 로딩·빈 상태가 되어도 창이 줄었다 늘었다 하지 않고, 목록 칸만
          스크롤한다. 왼쪽 기준선은 24px 하나다(제목·탭·날짜 머리글·행의 글). 안 읽음 점은 그 바깥 여백에 매달린다.
          열 때 포커스는 창 자체에 둔다 — 첫 탭에 두면 열자마자 포커스 링이 뜬다. Tab 으로 탭부터 차례로 간다.
        */}
        <DialogContent
          ref={popupRef}
          initialFocus={popupRef}
          // 키보드로 닫았을 때만 「알림」으로 포커스를 돌려준다. 마우스로 닫고 남은 포커스가 링으로 보이지 않게.
          finalFocus={(closeType) => closeType === "keyboard"}
          className="flex h-[min(600px,calc(100dvh-4rem))] flex-col gap-0 overflow-hidden bg-[var(--el-canvas)] p-0 outline-none sm:max-w-[540px] [&>[data-slot=dialog-close]]:top-5 [&>[data-slot=dialog-close]]:right-[18px]"
        >
          {/* 머리(제목·탭·동작)는 흰 면, 목록은 회색 캔버스 위의 흰 카드 — 두 층이 한눈에 갈린다(APP-1361). */}
          <div className="bg-[var(--el-surface-card)]">
            <DialogHeader className="gap-1 px-6 pt-5 pb-1">
              <DialogTitle className="leading-7">알림</DialogTitle>
              <DialogDescription className="text-xs leading-[18px]">
                모든 워크스페이스
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-end gap-1 border-b border-[var(--el-hairline)] px-6">
              <Tabs
                value={filter}
                onValueChange={(value) =>
                  setFilter(value as NotificationFilter)
                }
              >
                <TabsList
                  variant="line"
                  className="gap-5 p-0 group-data-horizontal/tabs:h-10"
                >
                  {TABS.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={TAB_ITEM}
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <span className="flex-1" />
              {/* 같은 위계의 보조 동작 둘 — 같은 ghost 모양, 글 끝이 목록 오른쪽 열 끝(24px)과 맞게 마지막을 당긴다. */}
              <div className="-mr-2 flex h-10 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className={ACTION}
                  disabled={!firstPage?.serverTime || !unreadCount}
                  loading={markAll.isPending}
                  onClick={readAll}
                >
                  모두 읽음으로 표시
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={ACTION}
                  onClick={openSettings}
                >
                  알림 설정
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea
            className="min-h-0 flex-1"
            viewportRef={attachViewport}
            viewportClassName="overflow-x-hidden"
          >
            {/*
              칸 높이를 채워 빈 상태·오류를 가운데에 둔다. 창 높이가 고정이라 뷰포트 크기는 안 변한다 — 내용 크기를
              따로 지켜보는 Content 로 감싸야 탭을 바꿨을 때 스크롤 막대가 새 길이를 따라간다.
            */}
            <ScrollAreaPrimitive.Content className="flex min-h-full flex-col">
              {newCount > 0 ? (
                <div className="sticky top-0 z-20 flex justify-center pt-2 pb-0.5">
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
                <div className="mx-2 mt-3 flex items-center gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)] py-2 pr-2 pl-[15px] text-[13px] text-[var(--el-body)]">
                  <BellOff
                    aria-hidden
                    className="size-4 text-[var(--el-muted)]"
                  />
                  인앱 알림이 꺼져 있습니다
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
            </ScrollAreaPrimitive.Content>
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

/**
 * 목록 칸의 틀. 카드는 좌우 8px 안쪽, 카드 안 행의 글은 15px 안쪽 + 테두리 1px — 글이 모달 제목과 같은 24px 선에 선다.
 * 날짜 머리글은 스크롤해도 칸 위에 붙는 캔버스색 띠다(뒤로 지나가는 카드를 가린다).
 */
const LIST = "flex flex-col px-2 pb-4";
const CARD =
  "divide-y divide-[var(--el-hairline)] overflow-hidden rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)]";
const DAY =
  "sticky top-0 z-10 -mx-2 bg-[var(--el-canvas)] px-6 pt-3 pb-1.5 text-xs leading-[18px] font-medium text-[var(--el-body)]";

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
      <div aria-label="알림 불러오는 중" className={LIST}>
        {filter === "ALL" ? <div className={DAY}>&nbsp;</div> : null}
        <ul className={CARD}>
          {[0, 1, 2, 3, 4].map((index) => (
            <li key={index} className="flex gap-3 px-[15px] py-3">
              <div className="flex flex-1 flex-col gap-0.5">
                <Skeleton className="my-[5px] h-[11px] w-4/5 rounded-chip" />
                <Skeleton className="mt-1.5 mb-1 h-[10px] w-2/5 rounded-chip" />
              </div>
              <span className="w-[104px] shrink-0" />
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <InlineRetry label="알림을 불러오지 못했습니다" onRetry={onRetry} />
      </div>
    );
  }
  if (items.length === 0) {
    const empty = EMPTY[filter];
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-10 text-center">
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
  // 전체 탭은 날짜로 묶는다 — 묶음마다 흰 카드 하나, 머리글은 스크롤해도 위에 붙는다. 다른 탭은 카드 하나에 행마다 날짜를 붙인다.
  const grouped = filter === "ALL";
  const groups: { day: string | null; items: NotificationItem[] }[] = [];
  for (const item of items) {
    const day = grouped ? dayLabel(item.createdAt) : null;
    const last = groups.at(-1);
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return (
    <div className={cn(LIST, !grouped && "pt-3")}>
      {groups.map((group, index) => (
        <section key={group.day ?? index} aria-label={group.day ?? undefined}>
          {group.day ? (
            <h3 aria-hidden className={DAY}>
              {group.day}
            </h3>
          ) : null}
          <ul className={CARD}>
            {group.items.map((item) => {
              const time = notificationTime(item.createdAt);
              return (
                <Fragment key={item.notificationId}>
                  {renderRow(
                    item,
                    grouped ? time : `${dayLabel(item.createdAt)} ${time}`
                  )}
                </Fragment>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
