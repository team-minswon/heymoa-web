"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowUpRight, Inbox, X } from "lucide-react";

import { EmptyState } from "@/components/workspace/page-chrome";
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
import { getGetWorkspacesQueryKey } from "@/lib/api/generated/workspaces/workspaces";
import type { NotificationListResponseDataNotificationsItem } from "@/lib/api/generated/models";
import { formatAppDate } from "@/lib/format/date";
import { describeNotification } from "@/lib/notifications/describe";
import { cn } from "@/lib/utils";

/** 계약의 종료 상태는 셋이다. 취소된 초대를 「거절함」으로 접으면 사용자가 자기가 거절한 줄 안다. */
const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "수락함",
  DECLINED: "거절함",
  CANCELED: "취소됨",
};

function InboxList({ workspaceId }: { workspaceId: string }) {
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
  // 수락하면 그 워크스페이스에 들어간 것이다 — 스위처가 안 따라오면 가입한 곳이 안 보인다.
  const invalidateWorkspaces = () =>
    client.invalidateQueries({ queryKey: getGetWorkspacesQueryKey() });

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
  // 한 초대에 수락과 거절이 함께 나가면 하나가 성공한 뒤 다른 하나가 409 를 띄운다.
  const isResolving = accept.isPending || decline.isPending;

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
          if (action === "accept") void invalidateWorkspaces();
        },
      }
    );
  };

  if (!notifications.length) {
    return (
      <>
        <InboxHead unreadCount={0} />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={Inbox}
            title="받은 알림이 없습니다"
            description="초대와 회의 알림이 여기에 쌓입니다."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <InboxHead
        unreadCount={unreadCount}
        onReadAll={() => readAll.mutate()}
        readAllPending={readAll.isPending}
      />
      {/* 행은 카드가 아니라 행이다 — 다이얼로그 안에서 판을 또 쌓으면 깊이가 거짓말을 한다. */}
      <ul className="min-h-0 flex-1 overflow-y-auto px-7 pt-[22px] pb-7">
        {notifications.map((notification) => {
          const unread = notification.readAt === null;
          const invitation = notification.invitation;
          const pending = invitation?.status === "PENDING";
          const view = describeNotification(notification, workspaceId);

          return (
            <li
              key={notification.notificationId}
              data-testid="inbox-row"
              data-unread={unread}
              className="flex min-h-[58px] items-center gap-3 border-b border-[var(--el-hairline)] py-3 last:border-b-0"
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 self-center rounded-full",
                  unread ? "bg-[var(--el-error)]" : "bg-transparent"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{view.title}</p>
                <p className="mt-1 text-[12px] text-[var(--el-muted)]">
                  {formatAppDate(notification.createdAt, {
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {invitation && !pending
                    ? ` · ${STATUS_LABEL[invitation.status] ?? invitation.status}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {pending ? (
                  <>
                    <Button
                      variant="outline"
                      className="h-9 px-[13px] text-[13px]"
                      loading={decline.isPending}
                      disabled={isResolving}
                      onClick={() => resolveInvitation(notification, "decline")}
                    >
                      거절
                    </Button>
                    <Button
                      className="h-9 px-[13px] text-[13px]"
                      loading={accept.isPending}
                      disabled={isResolving}
                      onClick={() => resolveInvitation(notification, "accept")}
                    >
                      참여
                    </Button>
                  </>
                ) : null}
                {view.action ? (
                  <Link
                    href={view.action.href}
                    // 알림을 눌러 회의로 가면 그 알림은 처리된 것이다 — 배지가 안 줄면 또 누른다.
                    onClick={() => {
                      if (unread)
                        markRead.mutate({
                          notificationId: notification.notificationId,
                        });
                    }}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--el-ink)] underline-offset-4 hover:underline"
                  >
                    {view.action.label}
                    <ArrowUpRight className="size-3.5 text-[var(--el-muted)]" />
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function InboxSkeleton() {
  return (
    <div>
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

export function InboxPage({ workspaceId }: { workspaceId: string }) {
  return (
    <DataBoundary
      fallback={
        <>
          <InboxHead />
          <div className="min-h-0 flex-1 overflow-y-auto px-7 pt-[22px] pb-7">
            <InboxSkeleton />
          </div>
        </>
      }
      errorLabel="알림을 불러오지 못했습니다"
    >
      <InboxList workspaceId={workspaceId} />
    </DataBoundary>
  );
}

/**
 * 다이얼로그 머리 — 제목 · 안 읽음 수 · 「전부 읽음」 · 닫기(design.pen `ZZDtz`).
 * 로딩 중에도 같은 머리가 서 있어야 판이 두 번 그려지지 않는다.
 */
function InboxHead({
  unreadCount,
  onReadAll,
  readAllPending,
}: {
  unreadCount?: number;
  onReadAll?: () => void;
  readAllPending?: boolean;
}) {
  const router = useRouter();
  const params = useParams<{ workspaceId: string }>();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--el-hairline)] pr-5 pl-7">
      <div className="flex items-center gap-2.5">
        <h2 className="text-[15px] font-semibold text-[var(--el-ink)]">
          받은 알림
        </h2>
        {unreadCount !== undefined ? (
          <span className="text-[11px] text-[var(--el-muted)]">
            {unreadCount > 0 ? `안 읽음 ${unreadCount}건` : "모두 읽었습니다"}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {onReadAll ? (
          <Button
            variant="outline"
            className="h-8 px-2.5 text-[12px]"
            disabled={!unreadCount}
            loading={readAllPending}
            onClick={onReadAll}
          >
            전부 읽음
          </Button>
        ) : null}
        <button
          type="button"
          aria-label="알림 닫기"
          onClick={() => router.push(`/w/${params.workspaceId}/meetings`)}
          className="flex size-[30px] items-center justify-center rounded-control text-[var(--el-muted)] hover:bg-[var(--el-surface-strong)]"
        >
          <X className="size-4" />
        </button>
      </div>
    </header>
  );
}
