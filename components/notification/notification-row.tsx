"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatAppDate } from "@/lib/format/date";
import type { NotificationItem } from "@/lib/notification/notification-list";
import { cn } from "@/lib/utils";

/** 점 칸의 폭 — 점 7px + 내용과의 간격 10px. 읽음 전환에서 점과 내용이 이만큼 왼쪽으로 움직인다. */
const DOT_SLOT_PX = 17;
const READ_TRANSITION_MS = 180;

const INVITATION_RESULT: Record<string, string> = {
  ACCEPTED: "수락함",
  DECLINED: "거절함",
  CANCELED: "취소됨",
  EXPIRED: "만료됨",
};

type Phase = "unread" | "leaving" | "read" | "entering";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * 읽음 전환(FLIP). 읽으면 점 칸은 그대로 둔 채 점과 내용을 점 칸만큼 왼쪽으로 밀고(점은 흐려진다), 끝나는 프레임에
 * 점 칸을 빼고 이동을 0으로 되돌린다 — 행 높이와 오른쪽 열은 움직이지 않는다. 다시 안 읽음이 되면 거꾸로 점이 왼쪽에서
 * 들어온다. 움직임 줄이기 설정이면 바로 바뀐다. `transform`·`opacity` 만 움직인다.
 */
function useReadPhase(unread: boolean): Phase {
  const [phase, setPhase] = useState<Phase>(unread ? "unread" : "read");
  const [previous, setPrevious] = useState(unread);
  if (unread !== previous) {
    setPrevious(unread);
    if (prefersReducedMotion()) setPhase(unread ? "unread" : "read");
    else setPhase(unread ? "entering" : "leaving");
  }
  useEffect(() => {
    if (phase === "leaving") {
      const timer = setTimeout(() => setPhase("read"), READ_TRANSITION_MS);
      return () => clearTimeout(timer);
    }
    if (phase === "entering") {
      // 밀려난 자리에서 한 프레임 그린 뒤 제자리로 — 그래야 전환이 돈다.
      const frame = requestAnimationFrame(() => setPhase("unread"));
      return () => cancelAnimationFrame(frame);
    }
  }, [phase]);
  return phase;
}

export type NotificationRowView = {
  /** 첫 줄. 이름·제목은 굵게 */
  title: React.ReactNode;
  /** 보조 줄(자동 종료 사유, 원본 없음 등) */
  detail?: React.ReactNode;
  workspaceName: string | null;
  /** 오른쪽 칸. 폭이 고정이라 행마다 글 폭이 같다 */
  aside?: React.ReactNode;
  /** 원본이 없거나 권한이 없어 흐리게 그린다 */
  gone?: boolean;
  /** 행 전체를 누르면 할 일. 없으면 누르면 읽음만 한다 */
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
  /** 날짜로 묶은 목록에서는 시각만, 아니면 날짜와 시각 */
  timeLabel: string;
  /** 마지막으로 누른 행 — 모달을 다시 열었을 때 어디까지 봤는지 보인다 */
  highlighted: boolean;
  onRead: () => void;
}) {
  const unread = notification.readAt === null;
  const phase = useReadPhase(unread);
  const moved = phase === "leaving" || phase === "entering";
  const animated = phase === "leaving" || phase === "unread";
  const shift = moved ? `translateX(-${DOT_SLOT_PX}px)` : undefined;
  const transition = animated
    ? "transition-[transform,opacity] duration-[180ms] ease-out motion-reduce:transition-none"
    : "";

  const activate = () => {
    if (view.onActivate) view.onActivate();
    else if (unread) onRead();
  };

  return (
    <li
      data-notification-id={notification.notificationId}
      data-read-phase={phase}
      className={cn(
        "group/row flex cursor-pointer gap-[10px] rounded-[10px] px-2.5 py-2.5 hover:bg-[var(--el-canvas-soft)]",
        highlighted && "bg-[var(--el-canvas-soft)]"
      )}
      onClick={(event) => {
        // 수락·거절·점 버튼은 제 일을 한다.
        if ((event.target as HTMLElement).closest("button")) return;
        activate();
      }}
    >
      {phase !== "read" ? (
        <button
          type="button"
          aria-label="읽음으로 표시"
          disabled={!unread}
          onClick={onRead}
          className={cn(
            "-m-1 mt-[3px] h-fit shrink-0 rounded-full p-1",
            transition
          )}
          style={{ transform: shift, opacity: moved ? 0 : 1 }}
        >
          <span
            aria-hidden
            className="block size-[7px] rounded-full bg-[var(--el-primary)]"
          />
        </button>
      ) : null}
      <div
        className={cn("flex min-w-0 flex-1 flex-col gap-[3px]", transition)}
        style={{ transform: shift }}
      >
        {view.onActivate ? (
          // 키보드로도 닿게 첫 줄이 버튼이다. 행 어디를 눌러도 같은 일을 한다.
          <button
            type="button"
            onClick={view.onActivate}
            className={cn(
              "text-left text-[13.5px] leading-[21px] focus-visible:underline focus-visible:outline-none",
              unread ? "text-[var(--el-ink)]" : "text-[var(--el-body)]"
            )}
          >
            {view.title}
          </button>
        ) : (
          <p
            className={cn(
              "text-[13.5px] leading-[21px]",
              view.gone
                ? "text-[var(--el-muted)]"
                : unread
                  ? "text-[var(--el-ink)]"
                  : "text-[var(--el-body)]"
            )}
          >
            {view.title}
          </p>
        )}
        {view.detail ? (
          <p className="text-[12.5px] text-pretty text-[var(--el-body)]">
            {view.detail}
          </p>
        ) : null}
        <p className="text-[11.5px] text-[var(--el-muted)]">
          {view.workspaceName ? `${view.workspaceName} · ` : null}
          <span className="whitespace-nowrap">{timeLabel}</span>
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
          <b className="font-medium">{notification.payload.workspaceName}</b>{" "}
          워크스페이스 초대
        </>
      ) : (
        "워크스페이스 초대"
      ),
      detail: "취소되었거나 더 이상 볼 수 없는 초대입니다",
      workspaceName: notification.payload?.workspaceName ?? null,
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
        <b className="font-medium">{invitation.workspaceName}</b> 워크스페이스에
        초대했습니다
      </>
    ),
    workspaceName: invitation.workspaceName,
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
        <span className="text-xs whitespace-nowrap text-[var(--el-muted)]">
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
