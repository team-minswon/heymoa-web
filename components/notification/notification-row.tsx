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

/** 행 문구를 고르는 번역 함수(`notification.row`). 종류별 렌더러가 React 밖 함수라 부르는 쪽이 넘긴다. */
export type RowTranslator = ReturnType<typeof useTranslations<"notification.row">>;

/**
 * 한국어 문장에서 이름 뒤에 「워크스페이스」를 붙이는가. 이름이 이미 「워크스페이스」로 끝나면 붙이지 않는다
 * (server APP-1330 과 같은 규칙). 언어 파일이 `{suffix, select, yes {…} other {}}` 로 받는다.
 */
export function workspaceSuffix(name: string): "yes" | "no" {
  return /워크스페이스$/.test(name.trim()) ? "no" : "yes";
}

const bold = (chunks: React.ReactNode) => <b className="font-medium">{chunks}</b>;

export type NotificationRowView = {
  /** 첫 줄. 이름·제목은 굵게 */
  title: React.ReactNode;
  /** 보조 줄(자동 종료 사유, 원본 없음 등) */
  detail?: React.ReactNode;
  /** 메타 줄의 워크스페이스 이름. 첫 줄에 이미 나오면 비운다 */
  workspaceName: string | null;
  /** 오른쪽 칸. 폭이 고정이라 행마다 글 폭이 같다 */
  aside?: React.ReactNode;
  /** 원본이 없거나 권한이 없어 흐리게 그린다 */
  gone?: boolean;
  /** 행 전체를 누르면 할 일. 없으면 누르면 읽음만 한다 */
  onActivate?: () => void;
};

/**
 * 알림 한 줄. 날짜 묶음의 흰 카드 안에 서고, 줄 사이 hairline 은 카드(`divide-y`)가 긋는다.
 *
 * 안 읽음은 **왼쪽 점 하나 + 진한 글**이다(GitHub·Gmail·Linear 인박스처럼 신호는 하나, 조용하게). 바탕은 칠하지 않는다 —
 * 회색 바탕은 hover·「마지막으로 누른 행」과 겹치고, 회색 캔버스 위 흰 카드를 얼룩지게 했다. 굵기도 바꾸지 않는다 —
 * 굵기가 바뀌면 글 폭이 달라져 읽는 순간 줄바꿈이 다시 일어난다(레이아웃 이동).
 *
 * 점은 행 왼쪽의 고정 칸(27px)에 매달려 있어서, 읽음·안 읽음과 상관없이 모든 행의 글이 같은 기준선에서 시작한다.
 * 읽으면 점이 흐려지고 글색이 한 단계 내려갈 뿐 — 아무것도 움직이지 않는다. 점 색은 사이드바 개수 배지와 같은 ink 다.
 */
export function NotificationRow({
  notification,
  view,
  timeLabel,
  highlighted,
  onRead,
}: {
  notification: NotificationItem;
  view: NotificationRowView;
  /** 날짜로 묶은 목록에서는 시각만, 아니면 날짜와 시각 */
  timeLabel: string;
  /** 마지막으로 누른 행 — 모달을 다시 열었을 때 어디까지 봤는지 보인다 */
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
        // 마지막으로 누른 행 — 왼쪽 가장자리의 짧은 회색 띠. 바탕색은 hover 가 쓴다.
        highlighted && "shadow-[inset_2px_0_0_var(--el-hairline-strong)]"
      )}
      onClick={(event) => {
        // 수락·거절·점 버튼은 제 일을 한다.
        if ((event.target as HTMLElement).closest("button")) return;
        activate();
      }}
    >
      {/*
        읽음 처리는 이동과 따로다 — 점 자리가 그 버튼이다(Gmail·GitHub 인박스처럼 이동 없이 읽음). 마우스를 올리거나
        Tab 으로 닿으면 점이 ✓ 로 바뀌어 누를 수 있음을 보인다. 터치에는 hover 가 없어 점 그대로 누른다(누름 칸은 첫 줄
        높이 × 27px). 읽으면 흐려지고, 다 흐려진 뒤 보이지 않게 된다(탭 순서에서도 빠진다). 서버에 「안 읽음으로」 API 가
        없어 되돌리기는 없다.
      */}
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
        {/* 점은 보이는 표시라 스크린리더에는 글로 말한다 — 행을 읽을 때 맨 앞에 「안 읽음」. */}
        {unread ? <span className="sr-only">{t("unread")}</span> : null}
        {view.onActivate ? (
          // 키보드로도 닿게 첫 줄이 버튼이다. 행 어디를 눌러도 같은 일을 한다.
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

/**
 * 종류별 렌더러. **모르는 종류는 일반 행으로 그린다** — 서버가 새 종류를 먼저 내도 목록이 깨지지 않는다.
 * 종류를 더할 때는 여기에 한 줄을 더한다(I23 `ANALYSIS_READY`).
 */
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
  return {
    title: t("generic"),
    workspaceName: notification.payload?.workspaceName ?? null,
  };
}

export type RowActions = {
  pending: boolean;
  /** 노트의 요약·검토 화면으로 간다(모달을 닫는다) */
  openNote: (workspaceId: string, noteId: string) => void;
  /** 「내 문의」 창을 그 문의가 보이게 연다(모달을 닫는다). 안 읽었으면 읽는다 */
  openInquiry: (notification: NotificationItem, feedbackId: string) => void;
  /** 그 워크스페이스 설정 창의 요금제 탭(기본)이나 결제 관리 탭을 연다(모달을 닫는다). 안 읽었으면 읽는다 */
  openBilling: (
    notification: NotificationItem,
    workspaceId: string,
    section?: "billing" | "payment"
  ) => void;
  /** 내가 그 워크스페이스에 아직 있는가. 없으면 이동을 막는다 */
  canOpen: (workspaceId: string) => boolean;
  /** 만료 판정의 기준 시각. 렌더마다 `Date.now()` 를 읽지 않는다 */
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
    // 원본(초대)이 지워졌다. 표시용 값만 남아 있고 초대한 사람 이름은 싣지 않는다(계약).
    return {
      title: notification.payload?.workspaceName
        ? t.rich("invitation.goneTitle", {
            workspace: notification.payload.workspaceName,
            suffix: workspaceSuffix(notification.payload.workspaceName),
            b: bold,
          })
        : t("invitation.goneTitleUnnamed"),
      detail: t("invitation.goneDetail"),
      // 첫 줄이 이미 워크스페이스 이름이다
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
    // 첫 줄이 이미 워크스페이스 이름이다
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
        // 처리 결과는 동작이 아니라 상태라 버튼과 다른 모양 — 작은 회색 칩이다.
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

/**
 * 검토할 결과 준비(PRO-67 I22·I23). 행 전체가 그 노트의 요약·검토 화면으로 가는 링크다. 읽음은 이동할 때가 아니라
 * 도착한 화면이 결과를 실제로 그렸을 때 한다(`useReadAnalysisReadyOnView`). 문구는 서버가 아니라 여기서 값으로 만든다.
 */
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
      // 제목은 따옴표 없이 굵게, 길면 한 줄로 자르고 전체는 툴팁으로
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

/** 문의 답변(APP-1399). 워크스페이스와 상관없는 계정 알림이라 메타 줄에 워크스페이스가 없다. */
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

/**
 * 결제 알림 — 갱신 결제 미승인으로 Pro 구독 종료(APP-1565)와 결제자가 빠져 자동 결제 중단(APP-1588). 둘 다 필수 알림이라
 * 설정에서 끌 수 없고, 누르면 그 워크스페이스의 요금제 탭으로 간다.
 */
function describeBilling(
  notification: NotificationItem,
  actions: RowActions,
  t: RowTranslator,
  kind: "subscriptionEnded" | "billingStopped"
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
    // 첫 줄이 이미 워크스페이스 이름이다
    workspaceName: null,
    onActivate: workspaceId
      ? () =>
          actions.openBilling(
            notification,
            workspaceId,
            // 멈춘 결제를 잇는 일(카드 등록·재개)은 결제 관리 탭에 있다
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

/** 날짜로 묶은 목록은 시각만, 아니면 날짜 머리를 앞에 붙인다. */
export function notificationTime(createdAt: string, locale?: string) {
  return formatAppDate(
    createdAt,
    { hour: "numeric", minute: "2-digit" },
    locale
  );
}
