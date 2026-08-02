import { describe, expect, it } from "vitest";

import { describeNotification } from "@/lib/notifications/describe";
import type { NotificationListResponseDataNotificationsItem } from "@/lib/api/generated/models";

const base = {
  notificationId: "01K0000000001",
  createdAt: "2026-08-02T09:02:00Z",
  readAt: null,
  invitation: null,
  note: null,
} as unknown as NotificationListResponseDataNotificationsItem;

const withNote = (type: string) =>
  ({
    ...base,
    type,
    note: { noteId: "01K0000000002", title: "주간 제품 회의" },
  }) as unknown as NotificationListResponseDataNotificationsItem;

describe("describeNotification", () => {
  it("names the inviter and the workspace for an invitation", () => {
    const view = describeNotification(
      {
        ...base,
        type: "WORKSPACE_INVITATION",
        invitation: {
          invitationId: "01K0000000003",
          inviterName: "김서연",
          workspaceName: "프로덕트 팀",
          status: "PENDING",
          role: "MEMBER",
        },
      } as unknown as NotificationListResponseDataNotificationsItem,
      "01K0000000000"
    );

    expect(view.title).toBe("김서연님이 「프로덕트 팀」 에 초대했습니다");
    // 수락·거절은 행이 따로 그린다 — 링크로 만들면 초대가 이동으로 읽힌다.
    expect(view.action).toBeNull();
  });

  // 계약의 다섯 종류 중 넷이 화면에서 「새 알림」으로 뭉개져 있었다.
  it.each([
    ["MEETING_STARTED", "「주간 제품 회의」 기록이 시작됐습니다", "전사"],
    [
      "ANALYSIS_COMPLETED",
      "「주간 제품 회의」 회의록 정리가 끝났습니다",
      "요약",
    ],
    [
      "ANALYSIS_FAILED",
      "「주간 제품 회의」 분석에 실패했습니다 — 다시 시도할 수 있습니다",
      "요약",
    ],
    [
      "SHARED_CHAT_MESSAGE",
      "「주간 제품 회의」 공유 챗에 새 메시지가 있습니다",
      "전사",
    ],
  ])("spells out %s", (type, title, tabLabel) => {
    const view = describeNotification(withNote(type), "01K0000000000");

    expect(view.title).toBe(title);
    expect(view.action?.href).toBe(
      `/w/01K0000000000/meetings/01K0000000002?view=full&tab=${
        tabLabel === "요약" ? "summary" : "transcript"
      }`
    );
  });

  it("keeps an unknown type readable instead of blank", () => {
    const view = describeNotification(withNote("SOMETHING_NEW"), "01K0");

    expect(view.title).toBe("「주간 제품 회의」 알림");
    expect(view.action).toBeNull();
  });
});
