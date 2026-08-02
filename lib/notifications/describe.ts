import type { NotificationListResponseDataNotificationsItem } from "@/lib/api/generated/models";

/**
 * 알림 한 줄이 무슨 말을 하고 어디로 가는지. 문구는 design.pen `IBjny` 의 것이다.
 *
 * 계약의 종류는 다섯인데 화면은 초대 하나만 그리고 있었다 — 나머지 넷은 「새 알림」으로
 * 뭉개졌다. 여기서 다섯을 다 편다.
 *
 * **ⓘ 계약 구멍**: 알림은 유저 전역인데 `note` 에 `noteId`·`title` 만 있고 `workspaceId`
 * 가 없다. 그래서 목적지를 **지금 보고 있는 워크스페이스**로 만든다 — 다른 워크스페이스의
 * 회의 알림이면 그 회의의 403/404 화면에 떨어진다. `workspaceId` 가 계약에 실리면 이 함수
 * 하나만 고치면 된다.
 */
export type NotificationView = {
  title: string;
  /** 초대는 수락·거절 버튼이 따로 붙는다 — 여기서는 null 이다. */
  action: { label: string; href: string } | null;
};

const NOTE_COPY: Record<
  string,
  { title: (t: string) => string; label: string; tab: string }
> = {
  MEETING_STARTED: {
    title: (t) => `「${t}」 기록이 시작됐습니다`,
    label: "회의 열기",
    tab: "transcript",
  },
  ANALYSIS_COMPLETED: {
    title: (t) => `「${t}」 회의록 정리가 끝났습니다`,
    label: "요약 보기",
    tab: "summary",
  },
  ANALYSIS_FAILED: {
    title: (t) => `「${t}」 분석에 실패했습니다 — 다시 시도할 수 있습니다`,
    label: "다시 분석",
    tab: "summary",
  },
  SHARED_CHAT_MESSAGE: {
    title: (t) => `「${t}」 공유 챗에 새 메시지가 있습니다`,
    label: "회의 열기",
    tab: "transcript",
  },
};

export function describeNotification(
  notification: NotificationListResponseDataNotificationsItem,
  workspaceId: string
): NotificationView {
  const { invitation, note, type } = notification;

  if (invitation) {
    return {
      title: `${invitation.inviterName}님이 「${invitation.workspaceName}」 에 초대했습니다`,
      action: null,
    };
  }

  const copy = NOTE_COPY[type];
  if (note && copy) {
    return {
      title: copy.title(note.title),
      action: {
        label: copy.label,
        href: `/w/${workspaceId}/meetings/${note.noteId}?view=full&tab=${copy.tab}`,
      },
    };
  }

  // 계약에 종류가 늘어도 화면이 빈칸이 되지 않게 한다.
  return { title: note ? `「${note.title}」 알림` : "새 알림", action: null };
}
