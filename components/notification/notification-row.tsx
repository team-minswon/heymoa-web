"use client";

import { Button } from "@/components/ui/button";
import { formatAppDate } from "@/lib/format/date";
import type { NotificationItem } from "@/lib/notification/notification-list";
import { cn } from "@/lib/utils";

const INVITATION_RESULT: Record<string, string> = {
  ACCEPTED: "수락함",
  DECLINED: "거절함",
  CANCELED: "취소됨",
  EXPIRED: "만료됨",
};

/** 이름이 이미 「워크스페이스」로 끝나면 접미어를 붙이지 않는다(server APP-1330 과 같은 규칙). */
export function workspaceLabel(name: string) {
  return /워크스페이스$/.test(name.trim()) ? "" : " 워크스페이스";
}

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
 * 안 읽음은 옅은 회색 바탕 + 점이다. 점은 글 왼쪽 여백(15px)에 매달려(hanging) 있어서, 읽음·안 읽음과 상관없이 모든
 * 행의 글이 같은 왼쪽 기준선(날짜 머리글·모달 제목과 같은 선)에서 시작한다. 읽으면 점과 바탕만 흐려진다 — 글은 안 움직인다.
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
        "group/row relative flex cursor-pointer gap-3 py-3 pr-[15px] pl-[15px] transition-colors duration-150",
        unread
          ? "bg-[var(--el-surface-strong)]/80 hover:bg-[var(--el-surface-strong)]"
          : "hover:bg-[var(--el-surface-strong)]/50",
        // 마지막으로 누른 행 — 왼쪽 가장자리의 짧은 회색 띠. 바탕색은 안 읽음·hover 가 이미 쓴다.
        highlighted && "shadow-[inset_2px_0_0_var(--el-hairline-strong)]"
      )}
      onClick={(event) => {
        // 수락·거절·점 버튼은 제 일을 한다.
        if ((event.target as HTMLElement).closest("button")) return;
        activate();
      }}
    >
      {/* 점은 글 왼쪽 여백(15px)의 가운데에 매달린다. 읽으면 흐려지고, 다 흐려진 뒤 보이지 않게 된다(탭 순서에서도 빠진다). */}
      <button
        type="button"
        aria-label="읽음으로 표시"
        disabled={!unread}
        onClick={onRead}
        className={cn(
          "absolute top-3 left-0 flex h-[21px] w-[15px] items-center justify-center rounded-full transition-[opacity,visibility] duration-[180ms] ease-out motion-reduce:transition-none",
          unread ? "visible opacity-100" : "invisible opacity-0"
        )}
      >
        <span
          aria-hidden
          className="block size-[7px] rounded-full bg-[var(--el-primary)]"
        />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {view.onActivate ? (
          // 키보드로도 닿게 첫 줄이 버튼이다. 행 어디를 눌러도 같은 일을 한다.
          <button
            type="button"
            onClick={view.onActivate}
            className={cn(
              "rounded-[2px] text-left text-[13.5px] leading-[21px] outline-none focus-visible:underline focus-visible:underline-offset-2",
              tone
            )}
          >
            {view.title}
          </button>
        ) : (
          <p className={cn("text-[13.5px] leading-[21px]", tone)}>
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
  actions: RowActions
): NotificationRowView {
  if (notification.type === "WORKSPACE_INVITATION") {
    return describeInvitation(notification, actions);
  }
  if (notification.type === "ANALYSIS_READY") {
    return describeAnalysisReady(notification, actions);
  }
  return {
    title: "새 알림이 도착했습니다",
    workspaceName: notification.payload?.workspaceName ?? null,
  };
}

export type RowActions = {
  pending: boolean;
  /** 노트의 요약·검토 화면으로 간다(모달을 닫는다) */
  openNote: (workspaceId: string, noteId: string) => void;
  /** 내가 그 워크스페이스에 아직 있는가. 없으면 이동을 막는다 */
  canOpen: (workspaceId: string) => boolean;
  /** 만료 판정의 기준 시각. 렌더마다 `Date.now()` 를 읽지 않는다 */
  now: number;
  accept: (notification: NotificationItem) => void;
  decline: (notification: NotificationItem) => void;
};

function describeInvitation(
  notification: NotificationItem,
  actions: RowActions
): NotificationRowView {
  const invitation = notification.invitation;
  if (!invitation) {
    // 원본(초대)이 지워졌다. 표시용 값만 남아 있고 초대한 사람 이름은 싣지 않는다(계약).
    return {
      title: notification.payload?.workspaceName ? (
        <>
          <b className="font-medium">{notification.payload.workspaceName}</b>
          {workspaceLabel(notification.payload.workspaceName)} 초대
        </>
      ) : (
        "워크스페이스 초대"
      ),
      detail: "취소되었거나 더 이상 볼 수 없는 초대입니다",
      // 첫 줄이 이미 워크스페이스 이름이다
      workspaceName: null,
      gone: true,
    };
  }
  const expired =
    invitation.status === "PENDING" &&
    Date.parse(invitation.expiresAt) < actions.now;
  return {
    title: (
      <>
        <b className="font-medium">{invitation.inviterName}</b>님이{" "}
        <b className="font-medium">{invitation.workspaceName}</b>
        {workspaceLabel(invitation.workspaceName)}에 초대했습니다
      </>
    ),
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
            거절
          </Button>
          <Button
            size="sm"
            className="h-[26px] px-2.5"
            disabled={actions.pending}
            onClick={() => actions.accept(notification)}
          >
            수락
          </Button>
        </>
      ) : (
        // 처리 결과는 동작이 아니라 상태라 버튼과 다른 모양 — 작은 회색 칩이다.
        <span className="rounded-chip bg-[var(--el-surface-strong)] px-1.5 text-[11.5px] leading-5 whitespace-nowrap text-[var(--el-body)]">
          {expired
            ? "만료됨"
            : (INVITATION_RESULT[invitation.status] ?? invitation.status)}
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
  actions: RowActions
): NotificationRowView {
  const payload = notification.payload;
  const title = payload?.noteTitle ?? "회의";
  const target =
    payload?.workspaceId &&
    payload.noteId &&
    actions.canOpen(payload.workspaceId)
      ? { workspaceId: payload.workspaceId, noteId: payload.noteId }
      : null;
  const reason =
    payload?.autoEnded && payload.pausedBusinessDays
      ? `마지막 중지 후 ${payload.pausedBusinessDays}영업일이 지나 자동으로 종료했습니다.`
      : null;
  return {
    title: (
      <>
        {/* 제목은 따옴표 없이 굵게, 길면 한 줄로 자르고 전체는 툴팁으로 */}
        <b
          title={title}
          className="inline-block max-w-[16rem] truncate align-bottom font-medium"
        >
          {title}
        </b>
        의 검토할 결과가 준비되었습니다
      </>
    ),
    detail: target ? reason : "삭제되었거나 볼 권한이 없는 회의입니다",
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
        검토하기 →
      </span>
    ),
  };
}

/** 날짜로 묶은 목록은 시각만, 아니면 날짜 머리를 앞에 붙인다. */
export function notificationTime(createdAt: string) {
  return formatAppDate(createdAt, { hour: "numeric", minute: "2-digit" });
}
