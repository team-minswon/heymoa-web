"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import {
  getGetNotificationsQueryKey,
  useGetNotifications,
  useMarkNotificationRead,
} from "@/lib/api/generated/notifications/notifications";
import {
  useAcceptWorkspaceInvitation,
  useDeclineWorkspaceInvitation,
} from "@/lib/api/generated/workspace-invitations/workspace-invitations";
import { getGetWorkspacesQueryKey } from "@/lib/api/generated/workspaces/workspaces";
import type { NotificationListResponseDataNotificationsItem } from "@/lib/api/generated/models";
import { formatAppDate } from "@/lib/format/date";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "수락함",
  DECLINED: "거절함",
  CANCELED: "취소됨",
};

/**
 * 알림 벨. 계약상 알림은 **초대(WORKSPACE_INVITATION) 하나**뿐이라 렌더 분기는
 * `invitation.status`가 전부다 — PENDING이면 수락/거절, 아니면 상태 라벨(항목은 남는다).
 * 벌크 읽음 엔드포인트가 없어 행을 클릭하면 읽음 처리한다.
 */
export function NotificationBell() {
  const queryClient = useQueryClient();
  const notificationsQuery = useGetNotifications();
  const markRead = useMarkNotificationRead();
  // 409는 인라인 Alert로 그린다 — 전역 토스트를 끄고 그 밖 실패만 아래서 직접 토스트한다.
  const acceptInvitation = useAcceptWorkspaceInvitation({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const declineInvitation = useDeclineWorkspaceInvitation({
    mutation: { meta: { suppressErrorToast: true } },
  });
  /** 렌더 뒤 처리된 초대에 수락/거절이 닿으면 409다 — 지속 안내로 상단에 띄운다. */
  const [staleInvitation, setStaleInvitation] = useState(false);

  const response = notificationsQuery.data;
  const data =
    response !== undefined && response.status === 200 && response.data.success
      ? response.data.data
      : null;
  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const invalidateNotifications = () =>
    queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });

  const onResolveError = (error: unknown) => {
    if (errorCodeOf(error) === "INVITATION_NOT_PENDING") {
      // 이미 처리된 초대다 — 목록을 새 상태로 갱신하면 그 항목이 라벨로 바뀐다.
      setStaleInvitation(true);
      void invalidateNotifications();
      return;
    }
    // 전역 토스트를 껐으니 그 밖 실패는 여기서 서버 문구로 띄운다.
    toast.error(errorMessageOf(error, "초대 처리에 실패했습니다."));
  };

  // 벌크 읽음 API가 없다 — 초대를 확정하면 그 알림도 읽는다(배지·dot이 줄어든다).
  const markReadIfUnread = (
    notification: NotificationListResponseDataNotificationsItem
  ) => {
    if (notification.readAt) return;
    markRead.mutate(
      { notificationId: notification.notificationId },
      { onSuccess: () => void invalidateNotifications() }
    );
  };

  const accept = (
    notification: NotificationListResponseDataNotificationsItem
  ) => {
    setStaleInvitation(false);
    markReadIfUnread(notification);
    acceptInvitation.mutate(
      { invitationId: notification.invitation!.invitationId },
      {
        onSuccess: () => {
          void invalidateNotifications();
          // 수락하면 워크스페이스에 합류한다 — 사이드바 목록도 갱신한다.
          void queryClient.invalidateQueries({
            queryKey: getGetWorkspacesQueryKey(),
          });
        },
        onError: onResolveError,
      }
    );
  };

  const decline = (
    notification: NotificationListResponseDataNotificationsItem
  ) => {
    setStaleInvitation(false);
    markReadIfUnread(notification);
    declineInvitation.mutate(
      { invitationId: notification.invitation!.invitationId },
      { onSuccess: () => void invalidateNotifications(), onError: onResolveError }
    );
  };

  const isResolving = acceptInvitation.isPending || declineInvitation.isPending;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) return;
        setStaleInvitation(false);
        // 폴링은 없다 — 워크스페이스 레이아웃이 계속 마운트돼 있으니 열 때마다 최신 초대를 가져온다.
        void notificationsQuery.refetch();
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative rounded-full"
            aria-label={unreadCount > 0 ? `알림 ${unreadCount}건 안 읽음` : "알림"}
          />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <Badge
            variant="destructive"
            className="absolute -top-0.5 -right-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
          >
            {unreadCount}
          </Badge>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[360px] max-w-[calc(100vw-1rem)] p-0"
      >
        <div className="border-b border-[var(--el-hairline)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--el-ink)]">알림</p>
        </div>

        {staleInvitation ? (
          <div
            role="alert"
            className="flex items-start gap-2 border-b border-[var(--el-error)]/20 bg-[var(--el-error)]/[0.06] px-4 py-2.5"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--el-error)]" />
            <p className="text-xs leading-relaxed text-[var(--el-body)]">
              이미 처리된 초대입니다.
            </p>
          </div>
        ) : null}

        <div className="max-h-[360px] overflow-y-auto">
          {notificationsQuery.isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : notificationsQuery.isError ? (
            <div role="alert" className="space-y-2 p-4">
              <p className="text-sm text-[var(--el-ink)]">
                알림을 불러오지 못했습니다.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-[30px]"
                onClick={() => void notificationsQuery.refetch()}
              >
                다시 시도
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[var(--el-ink)]">아직 알림이 없습니다.</p>
              <p className="mt-1 text-xs text-[var(--el-muted)]">
                읽은 알림도 사라지지 않습니다.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationRow
                key={notification.notificationId}
                notification={notification}
                isResolving={isResolving}
                onClick={() => markReadIfUnread(notification)}
                onAccept={() => accept(notification)}
                onDecline={() => decline(notification)}
              />
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({
  notification,
  isResolving,
  onClick,
  onAccept,
  onDecline,
}: {
  notification: NotificationListResponseDataNotificationsItem;
  isResolving: boolean;
  onClick: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const invitation = notification.invitation;
  const unread = notification.readAt === null;

  return (
    <div className="flex gap-3 border-b border-[var(--el-hairline)] px-4 py-3 last:border-b-0">
      {/* 벌크 읽음 API가 없어 미읽음 dot 자체가 "읽음 표시" 버튼이다 — PENDING·해결 행
          모두에서 동작하고, 수락/거절 버튼과 형제라 버튼 중첩이 없어 접근성이 유지된다. */}
      {unread ? (
        <button
          type="button"
          onClick={onClick}
          aria-label="읽음으로 표시"
          className="-m-1 mt-0.5 shrink-0 rounded-full p-1 hover:bg-[var(--el-canvas-soft)]"
        >
          <span
            aria-hidden
            className="block size-2 rounded-full bg-[var(--el-primary)]"
          />
        </button>
      ) : (
        <span
          aria-hidden
          className="mt-1.5 size-2 shrink-0 rounded-full bg-transparent"
        />
      )}
      <div className="min-w-0 flex-1">
        {invitation ? (
          <>
            <p className="text-sm leading-relaxed text-[var(--el-ink)]">
              <span className="font-medium">{invitation.inviterName}</span>님이{" "}
              <span className="font-medium">{invitation.workspaceName}</span>에
              초대했습니다.
            </p>
            <p className="mt-0.5 text-xs text-[var(--el-muted)]">
              {invitation.role === "ADMIN" ? "관리자" : "멤버"} 역할 ·{" "}
              {formatAppDate(notification.createdAt, {
                month: "long",
                day: "numeric",
              })}
            </p>
            {invitation.status === "PENDING" ? (
              <div className="mt-2.5 flex gap-2">
                <Button
                  size="sm"
                  className="h-[30px]"
                  disabled={isResolving}
                  onClick={onAccept}
                >
                  수락
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-[30px]"
                  disabled={isResolving}
                  onClick={onDecline}
                >
                  거절
                </Button>
              </div>
            ) : (
              <p className="mt-1.5 text-xs font-medium text-[var(--el-muted)]">
                {STATUS_LABEL[invitation.status] ?? invitation.status}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--el-muted)]">알 수 없는 알림</p>
        )}
      </div>
    </div>
  );
}
