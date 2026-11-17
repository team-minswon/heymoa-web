"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { formatAppDate } from "@/lib/format/date";
import type { NotificationItem } from "@/lib/notification/notification-list";
import { cn } from "@/lib/utils";

const INVITATION_RESULTS = ["ACCEPTED", "DECLINED", "CANCELED", "EXPIRED"] as const;
type InvitationResult = (typeof INVITATION_RESULTS)[number];
const isInvitationResult = (status: string): status is InvitationResult =>
  (INVITATION_RESULTS as readonly string[]).includes(status);

export type RowTranslator = ReturnType<typeof useTranslations<"notification.row">>;

export function workspaceSuffix(name: string): "yes" | "no" {
  return /워크스페이스$/.test(name.trim()) ? "no" : "yes";
}

const bold = (chunks: React.ReactNode) => <b className="font-medium">{chunks}</b>;

export type NotificationRowView = {
  title: React.ReactNode;
  detail?: React.ReactNode;
  workspaceName: string | null;
  aside?: React.ReactNode;
  gone?: boolean;
  onActivate?: () => void;
};

export function NotificationRow({
  notification,
  view,
  timeLabel,
  highlighted,
  onRead,
}: {
  notification: NotificationItem;
  view: NotificationRowView;
  timeLabel: string;
  highlighted: boolean;
  onRead: () => void;
}) {
  const t = useTranslations("notification.row");
  const unread = notification.readAt === null;
  const tone = view.gone
    ? "text-[var(--el-muted)]"
    : unread
      ? "text-[var(--el-ink)]"
      : "text-[var(--el-body)]";

  const activate = () => {
    if (view.onActivate) view.onActivate();
    else if (unread) onRead();
  };

  return (
    <li
      data-notification-id={notification.notificationId}
      data-unread={unread || undefined}
      className={cn(
        "group/row relative flex cursor-pointer gap-3 py-3.5 pr-[15px] pl-[27px] transition-colors duration-150 hover:bg-[var(--el-surface-strong)]/60",
        highlighted && "shadow-[inset_2px_0_0_var(--el-hairline-strong)]"
      )}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        activate();
      }}
    >
      <button
        type="button"
        aria-label={t("markRead")}
        title={t("markRead")}
        disabled={!unread}
        onClick={onRead}
        className={cn(
          "group/dot absolute top-3.5 left-0 flex h-[21px] w-[27px] items-center justify-center outline-none transition-[opacity,visibility] duration-[180ms] ease-out motion-reduce:transition-none",
          unread ? "visible opacity-100" : "invisible opacity-0"
        )}
      >
        <span
          aria-hidden
          className="relative flex size-[18px] items-center justify-center rounded-full transition-colors duration-150 group-hover/dot:bg-[var(--el-hairline)] group-focus-visible/dot:bg-[var(--el-hairline)] group-focus-visible/dot:ring-2 group-focus-visible/dot:ring-[var(--el-ink)]/30"
        >
          <span className="size-1.5 rounded-full bg-[var(--el-ink)] transition-opacity duration-150 group-hover/dot:opacity-0 group-focus-visible/dot:opacity-0" />
          <Check
            strokeWidth={2.5}
            className="absolute size-3 text-[var(--el-ink)] opacity-0 transition-opacity duration-150 group-hover/dot:opacity-100 group-focus-visible/dot:opacity-100"
          />
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {unread ? <span className="sr-only">{t("unread")}</span> : null}
        {view.onActivate ? (
          <button
            type="button"
            onClick={view.onActivate}
            className={cn(
              "rounded-[2px] text-left text-[13.5px] leading-[21px] text-pretty transition-colors duration-[180ms] outline-none focus-visible:underline focus-visible:underline-offset-2",
              tone
            )}
          >
            {view.title}
          </button>
        ) : (
          <p
            className={cn(
              "text-[13.5px] leading-[21px] text-pretty transition-colors duration-[180ms]",
              tone
            )}
          >
            {view.title}
          </p>
        )}
        {view.detail ? (
          <p className="text-[12.5px] leading-[19px] text-pretty text-[var(--el-body)]">
            {view.detail}
          </p>
        ) : null}
        <p className="mt-0.5 truncate text-xs leading-[18px] text-[var(--el-muted)]">
          {view.workspaceName ? `${view.workspaceName} · ` : null}
          <span className="whitespace-nowrap tabular-nums">{timeLabel}</span>
        </p>
      </div>
      <div className="flex h-[21px] w-[104px] shrink-0 items-center justify-end gap-1.5">
        {view.aside}
      </div>
    </li>
  );
}

export function describeNotification(
  notification: NotificationItem,
  actions: RowActions,
  t: RowTranslator
): NotificationRowView {
  if (notification.type === "WORKSPACE_INVITATION") {
    return describeInvitation(notification, actions, t);
  }
  if (notification.type === "ANALYSIS_READY") {
    return describeAnalysisReady(notification, actions, t);
  }
  if (notification.type === "INQUIRY_ANSWERED") {
    return describeInquiryAnswered(notification, actions, t);
  }
  if (notification.type === "SUBSCRIPTION_ENDED_UNPAID") {
    return describeBilling(notification, actions, t, "subscriptionEnded");
  }
  if (notification.type === "SUBSCRIPTION_BILLING_STOPPED") {
    return describeBilling(notification, actions, t, "billingStopped");
  }
  if (notification.type === "SUBSCRIPTION_PAYMENT_DECLINED") {
    return describeBilling(notification, actions, t, "paymentDeclined");
  }
  return {
    title: t("generic"),
    workspaceName: notification.payload?.workspaceName ?? null,
  };
}

export type RowActions = {
  pending: boolean;
  openNote: (workspaceId: string, noteId: string) => void;
  openInquiry: (notification: NotificationItem, feedbackId: string) => void;
  openBilling: (
    notification: NotificationItem,
    workspaceId: string,
    section?: "billing" | "payment"
  ) => void;
  canOpen: (workspaceId: string) => boolean;
  now: number;
  accept: (notification: NotificationItem) => void;
  decline: (notification: NotificationItem) => void;
};

function describeInvitation(
  notification: NotificationItem,
  actions: RowActions,
  t: RowTranslator
): NotificationRowView {
  const invitation = notification.invitation;
  if (!invitation) {
    return {
      title: notification.payload?.workspaceName
        ? t.rich("invitation.goneTitle", {
            workspace: notification.payload.workspaceName,
            suffix: workspaceSuffix(notification.payload.workspaceName),
            b: bold,
          })
        : t("invitation.goneTitleUnnamed"),
      detail: t("invitation.goneDetail"),
      workspaceName: null,
      gone: true,
    };
  }
  const expired =
    invitation.status === "PENDING" &&
    Date.parse(invitation.expiresAt) < actions.now;
  return {
    title: t.rich("invitation.title", {
      inviter: invitation.inviterName,
      workspace: invitation.workspaceName,
      suffix: workspaceSuffix(invitation.workspaceName),
      b: bold,
    }),
    workspaceName: null,
    aside:
      invitation.status === "PENDING" && !expired ? (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-[26px] px-2.5"
            disabled={actions.pending}
            onClick={() => actions.decline(notification)}
          >
            {t("invitation.decline")}
          </Button>
          <Button
            size="sm"
            className="h-[26px] px-2.5"
            disabled={actions.pending}
            onClick={() => actions.accept(notification)}
          >
            {t("invitation.accept")}
          </Button>
        </>
      ) : (
        <span className="rounded-chip bg-[var(--el-surface-strong)] px-1.5 text-[11.5px] leading-5 whitespace-nowrap text-[var(--el-body)]">
          {expired
            ? t("invitation.result.EXPIRED")
            : isInvitationResult(invitation.status)
              ? t(`invitation.result.${invitation.status}`)
              : invitation.status}
        </span>
      ),
  };
}

function describeAnalysisReady(
  notification: NotificationItem,
  actions: RowActions,
  t: RowTranslator
): NotificationRowView {
  const payload = notification.payload;
  const title = payload?.noteTitle ?? t("analysis.untitled");
  const target =
    payload?.workspaceId &&
    payload.noteId &&
    actions.canOpen(payload.workspaceId)
      ? { workspaceId: payload.workspaceId, noteId: payload.noteId }
      : null;
  const reason =
    payload?.autoEnded && payload.pausedBusinessDays
      ? t("analysis.autoEnded", { days: payload.pausedBusinessDays })
      : null;
  return {
    title: t.rich("analysis.title", {
      title,
      b: (chunks) => (
        <b
          title={title}
          className="inline-block max-w-[16rem] truncate align-bottom font-medium"
        >
          {chunks}
        </b>
      ),
    }),
    detail: target ? reason : t("analysis.gone"),
    workspaceName: payload?.workspaceName ?? null,
    gone: !target,
    onActivate: target
      ? () => actions.openNote(target.workspaceId, target.noteId)
      : undefined,
    aside: (
      <span
        aria-hidden
        className={
          target
            ? "text-xs font-medium whitespace-nowrap text-[var(--el-ink)] group-hover/row:underline"
            : "text-xs whitespace-nowrap text-[var(--el-muted)]"
        }
      >
        {t("analysis.review")}
      </span>
    ),
  };
}

function describeInquiryAnswered(
  notification: NotificationItem,
  actions: RowActions,
  t: RowTranslator
): NotificationRowView {
  const feedbackId = notification.payload?.feedbackId;
  return {
    title: t("inquiry.title"),
    workspaceName: null,
    onActivate: feedbackId
      ? () => actions.openInquiry(notification, feedbackId)
      : undefined,
    aside: feedbackId ? (
      <span
        aria-hidden
        className="text-xs font-medium whitespace-nowrap text-[var(--el-ink)] group-hover/row:underline"
      >
        {t("inquiry.view")}
      </span>
    ) : undefined,
  };
}

function describeBilling(
  notification: NotificationItem,
  actions: RowActions,
  t: RowTranslator,
  kind: "subscriptionEnded" | "billingStopped" | "paymentDeclined"
): NotificationRowView {
  const payload = notification.payload;
  const workspaceId =
    payload?.workspaceId && actions.canOpen(payload.workspaceId)
      ? payload.workspaceId
      : null;
  return {
    title: payload?.workspaceName
      ? t.rich(`${kind}.title`, {
          workspace: payload.workspaceName,
          b: bold,
        })
      : t(`${kind}.titleUnnamed`),
    detail: t(`${kind}.detail`),
    workspaceName: null,
    onActivate: workspaceId
      ? () =>
          actions.openBilling(
            notification,
            workspaceId,
            kind === "billingStopped" ? "payment" : "billing"
          )
      : undefined,
    aside: workspaceId ? (
      <span
        aria-hidden
        className="text-xs font-medium whitespace-nowrap text-[var(--el-ink)] group-hover/row:underline"
      >
        {t(`${kind}.view`)}
      </span>
    ) : undefined,
  };
}

export function notificationTime(createdAt: string, locale?: string) {
  return formatAppDate(
    createdAt,
    { hour: "numeric", minute: "2-digit" },
    locale
  );
}
