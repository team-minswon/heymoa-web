import { render, screen } from "@testing-library/react";
import { useTranslations } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { intlWrapper } from "@/components/help/test-intl";
import {
  describeNotification,
  NotificationRow,
  type RowActions,
} from "@/components/notification/notification-row";
import type { NotificationItem } from "@/lib/notification/notification-list";

const HANGUL = /[가-힣]/;

const payload = {
  workspaceId: "WS1",
  workspaceName: "Product team",
  invitationId: null,
  inviterUserId: null,
  noteId: "NOTE1",
  noteTitle: "Sprint retro",
  autoEnded: true,
  pausedBusinessDays: 3,
  feedbackId: null,
};

const items: NotificationItem[] = [
  {
    notificationId: "N1",
    type: "WORKSPACE_INVITATION",
    readAt: null,
    createdAt: "2026-10-22T02:00:00Z",
    invitation: {
      invitationId: "inv-1",
      status: "PENDING",
      role: "MEMBER",
      workspaceId: "WS2",
      workspaceName: "Design studio",
      inviterName: "Jane",
      expiresAt: "2099-01-01T00:00:00Z",
    },
    payload: { ...payload, noteId: null, noteTitle: null, autoEnded: null, pausedBusinessDays: null },
  },
  {
    notificationId: "N2",
    type: "ANALYSIS_READY",
    readAt: null,
    createdAt: "2026-10-22T03:00:00Z",
    invitation: null,
    payload,
  },
];

const actions: RowActions = {
  pending: false,
  openNote: vi.fn(),
  openInquiry: vi.fn(),
  openBilling: vi.fn(),
  canOpen: () => true,
  now: Date.parse("2026-10-22T04:00:00Z"),
  accept: vi.fn(),
  decline: vi.fn(),
};

function Rows() {
  const t = useTranslations("notification.row");
  return (
    <ul>
      {items.map((item) => (
        <NotificationRow
          key={item.notificationId}
          notification={item}
          view={describeNotification(item, actions, t)}
          timeLabel="11:00 AM"
          highlighted={false}
          onRead={() => {}}
        />
      ))}
    </ul>
  );
}

describe("알림 영어 화면", () => {
  it("초대와 검토할 결과 행이 영어로 서고 한글이 없다", () => {
    const { container } = render(<Rows />, { wrapper: intlWrapper("en") });
    expect(container).toHaveTextContent("Jane invited you to Design studio");
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(container).toHaveTextContent("Results from Sprint retro are ready to review");
    expect(container).toHaveTextContent(
      "The meeting ended automatically 3 business days after the last pause."
    );
    expect(screen.getAllByRole("button", { name: "Mark as read" })).toHaveLength(2);
    expect(container.textContent).not.toMatch(HANGUL);
  });

  it("한국어 초대 문장은 이름 뒤에 「워크스페이스」를 붙인다", () => {
    const { container } = render(<Rows />);
    expect(container).toHaveTextContent("Jane님이 Design studio 워크스페이스에 초대했습니다");
  });

  it("이름이 이미 「워크스페이스」로 끝나면 접미어를 겹쳐 붙이지 않는다", () => {
    const renderNamed = (name: string) => {
      function Row() {
        const tRow = useTranslations("notification.row");
        const item = { ...items[0], invitation: { ...items[0].invitation!, workspaceName: name } };
        return (
          <ul>
            <NotificationRow
              notification={item}
              view={describeNotification(item, actions, tRow)}
              timeLabel=""
              highlighted={false}
              onRead={() => {}}
            />
          </ul>
        );
      }
      return render(<Row />).container;
    };
    expect(renderNamed("테스트 유저의 워크스페이스")).toHaveTextContent(
      "Jane님이 테스트 유저의 워크스페이스에 초대했습니다"
    );
  });
});
