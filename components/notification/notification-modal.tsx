"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { BellOff } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { INQUIRY_PARAM } from "@/components/workspace/feedback-dialog";
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
import { useDisplayLocale } from "@/lib/i18n/use-display-locale";

function scrollListTo(node: HTMLElement | null, top: number) {
  if (node) node.scrollTop = top;
}

const TAB_ITEM =
  "-mx-1.5 h-7 flex-none px-1.5 text-[13px] group-data-horizontal/tabs:after:inset-x-1.5 group-data-horizontal/tabs:after:bottom-[-7px] focus-visible:border-transparent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none";

const ACTION =
  "h-7 px-2 text-xs font-normal text-[var(--el-body)] hover:text-[var(--el-ink)]";

const TABS: readonly NotificationFilter[] = ["ALL", "UNREAD", "ACTION_REQUIRED"];

const LIST_GC_MS = 30 * 60_000;

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
  filter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
  onClose: (then?: () => void) => void;
  workspaceId: string;
  unreadCount: number | undefined;
  onOpenSettings: (section: SettingsSection) => void;
  onNavigate: (href: string) => void;
}) {
  const t = useTranslations("notification.modal");
  const tRow = useTranslations("notification.row");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const setFilter = (next: NotificationFilter) => {
    if (next !== filter) onFilterChange(next);
  };
  const shownFilterRef = useRef(filter);
  useEffect(() => {
    if (shownFilterRef.current === filter) return;
    shownFilterRef.current = filter;
    rememberNotificationModal({ scrollTop: 0 });
    scrollListTo(viewportRef.current, 0);
  }, [filter]);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const attachViewport = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    if (node) node.scrollTop = notificationModalMemory.scrollTop;
  }, []);

  const list = useInfiniteQuery({
    queryKey: notificationListKey(filter),
    queryFn: async ({ pageParam, signal }) => {
      const page = await fetchNotificationPage(filter, pageParam, signal);
      if (!pageParam.afterNotificationId)
        queryClient.setQueryData(notificationHeadKey(filter), page);
      return page;
    },
    initialPageParam: {} as NotificationCursor,
    getNextPageParam: nextCursor,
    enabled: open,
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
  const workspacesQuery = useGetWorkspaces({ query: { enabled: open } });
  const myWorkspaceIds =
    workspacesQuery.data?.status === 200 && workspacesQuery.data.data.success
      ? new Set(
          workspacesQuery.data.data.data.workspaces.map(
            (workspace) => workspace.workspaceId
          )
        )
      : null;

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
      close(() =>
        onNavigate(
          `/w/${targetWorkspaceId}/notes/${noteId}?view=full&tab=summary&source=notification`
        )
      );
    },
    openInquiry: (target, feedbackId) => {
      if (target.readAt === null) readNotification(target.notificationId);
      close(() =>
        onNavigate(
          `/w/${workspaceId}?${INQUIRY_PARAM}=${encodeURIComponent(feedbackId)}`
        )
      );
    },
    openBilling: (target, targetWorkspaceId, section = "billing") => {
      if (target.readAt === null) readNotification(target.notificationId);
      close(() => onNavigate(`/w/${targetWorkspaceId}?settings=${section}`));
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
            void queryClient.invalidateQueries({
              queryKey: getGetWorkspacesQueryKey(),
            });
          },
          onError: onInvitationError,
        }
      ),
    decline: (target) => setDeclineTarget(target),
  };

  const showNew = () => {
    scrollListTo(viewportRef.current, 0);
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
    if (viewportRef.current)
      rememberNotificationModal({ scrollTop: viewportRef.current.scrollTop });
    onOpenSettings("notifications");
  };

  const rowsFor = (item: NotificationItem) => {
    const view = describeNotification(item, invitationActions, tRow);
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
        <DialogContent
          ref={popupRef}
          initialFocus={popupRef}
          className="flex h-[min(600px,calc(100dvh-4rem))] flex-col gap-0 overflow-hidden bg-[var(--el-canvas)] p-0 outline-none sm:max-w-[540px] [&>[data-slot=dialog-close]]:top-5 [&>[data-slot=dialog-close]]:right-[18px]"
        >
          <div className="bg-[var(--el-surface-card)]">
            <DialogHeader className="gap-1 px-6 pt-5 pb-1">
              <DialogTitle className="leading-7">{t("title")}</DialogTitle>
              <DialogDescription className="text-xs leading-[18px]">
                {t("description")}
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
                    <TabsTrigger key={tab} value={tab} className={TAB_ITEM}>
                      {t(`tabs.${tab}`)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <span className="flex-1" />
              <div className="-mr-2 flex h-10 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className={ACTION}
                  disabled={!firstPage?.serverTime || !unreadCount}
                  loading={markAll.isPending}
                  onClick={readAll}
                >
                  {t("markAllRead")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={ACTION}
                  onClick={openSettings}
                >
                  {t("settings")}
                </Button>
              </div>
            </div>
          </div>

          <div
            ref={attachViewport}
            data-slot="notification-list"
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
          >
            <div className="flex min-h-full flex-col">
              {newCount > 0 ? (
                <div className="sticky top-0 z-20 flex justify-center pt-2 pb-0.5">
                  <button
                    type="button"
                    onClick={showNew}
                    className="rounded-full bg-[var(--el-ink)] px-2.5 py-[3px] text-xs text-white shadow-e2"
                  >
                    {t("newCount", { count: newCount })}
                  </button>
                </div>
              ) : null}
              {webMuted ? (
                <div className="mx-6 mt-4 flex items-center gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)] py-2 pr-2 pl-[27px] text-[13px] text-[var(--el-body)]">
                  <BellOff
                    aria-hidden
                    className="size-4 text-[var(--el-muted)]"
                  />
                  {t("muted")}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto h-[26px]"
                    onClick={openSettings}
                  >
                    {t("openSettings")}
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
                  label={t("loadMoreFailed")}
                  className="justify-center px-4 py-3"
                  onRetry={() => void list.fetchNextPage()}
                />
              ) : list.hasNextPage ? (
                <div className="flex justify-center pt-2 pb-4">
                  <LoadMoreButton
                    loading={list.isFetchingNextPage}
                    loadingLabel={t("loadingMore")}
                    onClick={() => void list.fetchNextPage()}
                  >
                    {t("loadMore")}
                  </LoadMoreButton>
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={declineTarget !== null}
        onOpenChange={(next) => !next && setDeclineTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("declineDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("declineDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={decline.isPending}>
              {tActions("cancel")}
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
              {tRow("invitation.decline")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const LIST = "flex flex-col px-6 pb-6";
const CARD =
  "divide-y divide-[var(--el-hairline)] overflow-hidden rounded-block border border-[var(--el-hairline)] bg-[var(--el-surface-card)]";
const DAY =
  "sticky top-0 z-10 -mx-6 bg-[var(--el-canvas)] px-6 pt-5 pb-2 text-xs leading-[18px] font-medium text-[var(--el-body)]";

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
  const t = useTranslations("notification.modal");
  const tDates = useTranslations("dates");
  const dateLocale = useDisplayLocale();
  if (isLoading) {
    return (
      <div aria-label={t("loading")} className={LIST}>
        {filter === "ALL" ? <div className={DAY}>&nbsp;</div> : null}
        <ul className={CARD}>
          {[0, 1, 2, 3, 4].map((index) => (
            <li key={index} className="flex gap-3 py-3.5 pr-[15px] pl-[27px]">
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
        <InlineRetry label={t("loadFailed")} onRetry={onRetry} />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-10 text-center">
        <p className="text-sm text-[var(--el-ink)]">{t(`empty.${filter}`)}</p>
        {filter === "ALL" ? (
          <p className="text-xs text-[var(--el-muted)]">{t("empty.allSub")}</p>
        ) : null}
        {filter === "UNREAD" ? (
          <Button variant="outline" size="sm" onClick={onShowAll}>
            {t("showAll")}
          </Button>
        ) : null}
      </div>
    );
  }
  const grouped = filter === "ALL";
  const groups: { day: string | null; items: NotificationItem[] }[] = [];
  for (const item of items) {
    const day = grouped ? dayLabel(item.createdAt, dateLocale, tDates) : null;
    const last = groups.at(-1);
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return (
    <div className={cn(LIST, !grouped && "pt-4")}>
      {groups.map((group, index) => (
        <section key={group.day ?? index} aria-label={group.day ?? undefined}>
          {group.day ? (
            <h3 aria-hidden className={DAY}>
              {group.day}
            </h3>
          ) : null}
          <ul className={CARD}>
            {group.items.map((item) => {
              const time = notificationTime(item.createdAt, dateLocale);
              return (
                <Fragment key={item.notificationId}>
                  {renderRow(
                    item,
                    grouped ? time : `${dayLabel(item.createdAt, dateLocale, tDates)} ${time}`
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
