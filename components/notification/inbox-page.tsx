"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  getGetNotificationsQueryKey,
  useGetNotificationsSuspense,
  useMarkNotificationRead,
  useReadAllNotifications,
} from "@/lib/api/generated/notifications/notifications";
import {
  useAcceptWorkspaceInvitation,
  useDeclineWorkspaceInvitation,
} from "@/lib/api/generated/workspace-invitations/workspace-invitations";
import type { NotificationListResponseDataNotificationsItem } from "@/lib/api/generated/models";
import { formatAppDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";

function InboxList() {
  const client = useQueryClient();
  const query = useGetNotificationsSuspense();
  const data =
    query.data.status === 200 && query.data.data.success
      ? query.data.data.data
      : null;
  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const invalidate = () =>
    client.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });

  const markRead = useMarkNotificationRead({
    mutation: { onSuccess: () => void invalidate() },
  });
  const readAll = useReadAllNotifications({
    mutation: { onSuccess: () => void invalidate() },
  });
  const onResolveError = (error: unknown) => {
    if (errorCodeOf(error) === "INVITATION_NOT_PENDING") {
      toast.error("이미 처리된 초대입니다.");
      void invalidate();
      return;
    }
    toast.error(errorMessageOf(error, "초대 처리에 실패했습니다."));
  };
  const accept = useAcceptWorkspaceInvitation({
    mutation: { meta: { suppressErrorToast: true }, onError: onResolveError },
  });
  const decline = useDeclineWorkspaceInvitation({
    mutation: { meta: { suppressErrorToast: true }, onError: onResolveError },
  });

  const resolveInvitation = (
    notification: NotificationListResponseDataNotificationsItem,
    action: "accept" | "decline"
  ) => {
    const invitationId = notification.invitation?.invitationId;
    if (!invitationId) return;
    const run = action === "accept" ? accept : decline;
    run.mutate(
      { invitationId },
      {
        onSuccess: () => {
          // 초대를 확정하면 그 알림도 읽는다 — 배지가 안 줄면 처리한 줄 모른다.
          if (notification.readAt === null) {
            markRead.mutate({ notificationId: notification.notificationId });
          }
          void invalidate();
        },
      }
    );
  };

  if (!notifications.length) {
    return (
      <div className="rounded-panel border border-[var(--el-hairline)] bg-card px-8 py-16 text-center">
        <p className="text-[15px] font-medium">받은 알림이 없습니다</p>
        <p className="mt-2 text-[13px] text-[var(--el-muted)]">
          워크스페이스 초대와 회의 분석 결과가 여기에 쌓입니다.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between pb-3">
        <p className="text-[13px] text-[var(--el-muted)]">
          {unreadCount > 0 ? `읽지 않음 ${unreadCount}건` : "모두 읽었습니다"}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0}
          loading={readAll.isPending}
          onClick={() => readAll.mutate()}
        >
          전부 읽음
        </Button>
      </div>
      <ul className="overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-card">
        {notifications.map((notification) => {
          const unread = notification.readAt === null;
          const invitation = notification.invitation;
          const pending = invitation?.status === "PENDING";

          return (
            <li
              key={notification.notificationId}
              data-testid="inbox-row"
              data-unread={unread}
              className="flex gap-3 border-b border-[var(--el-hairline)] px-4 py-4 last:border-b-0"
            >
              <span
                aria-hidden
                className={cn(
                  "mt-2 size-1.5 shrink-0 rounded-full",
                  unread ? "bg-[var(--el-error)]" : "bg-transparent"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">
                  {invitation
                    ? `${invitation.inviterName}님이 「${invitation.workspaceName}」에 초대했습니다`
                    : "새 알림"}
                </p>
                <p className="mt-1 text-[12px] text-[var(--el-muted)]">
                  {formatAppDate(notification.createdAt, {
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {invitation && !pending
                    ? ` · ${invitation.status === "ACCEPTED" ? "수락함" : "거절함"}`
                    : ""}
                </p>
                {pending ? (
                  <div className="mt-2.5 flex gap-2">
                    <Button
                      size="sm"
                      loading={accept.isPending}
                      onClick={() => resolveInvitation(notification, "accept")}
                    >
                      수락
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={decline.isPending}
                      onClick={() => resolveInvitation(notification, "decline")}
                    >
                      거절
                    </Button>
                  </div>
                ) : null}
              </div>
              {unread ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    markRead.mutate({
                      notificationId: notification.notificationId,
                    })
                  }
                >
                  읽음
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function InboxSkeleton() {
  return (
    <div className="overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-card">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="border-b border-[var(--el-hairline)] px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-3 w-72" />
          <Skeleton className="mt-2.5 h-2.5 w-40" />
        </div>
      ))}
    </div>
  );
}

export function InboxPage() {
  return (
    <div className="mx-auto max-w-[660px] px-8 pb-10 pt-6">
      <header className="pb-4">
        <h1 className="text-note-title font-serif font-light">받은 알림</h1>
        <p className="mt-1 text-[13px] text-[var(--el-muted)]">
          초대와 분석 결과는 워크스페이스가 아니라 나에게 옵니다.
        </p>
      </header>
      <DataBoundary
        fallback={<InboxSkeleton />}
        errorLabel="알림을 불러오지 못했습니다"
      >
        <InboxList />
      </DataBoundary>
    </div>
  );
}
