import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  NotificationRow,
  workspaceLabel,
} from "@/components/notification/notification-row";
import type { NotificationItem } from "@/lib/notification/notification-list";

const base: NotificationItem = {
  notificationId: "N1",
  type: "WORKSPACE_INVITATION",
  readAt: null,
  createdAt: "2026-10-22T02:00:00Z",
  invitation: null,
  payload: null,
};

function row(readAt: string | null) {
  return (
    <ul>
      <NotificationRow
        notification={{ ...base, readAt }}
        view={{ title: "알림", workspaceName: "제품 팀" }}
        timeLabel="오전 11:00"
        highlighted={false}
        onRead={() => {}}
      />
    </ul>
  );
}

afterEach(cleanup);

describe("읽음 표시", () => {
  it("안 읽음 점은 누를 수 있고, 읽으면 같은 자리에서 보이지 않게 된다(글은 움직이지 않는다)", () => {
    const { rerender } = render(row(null));
    const dot = screen.getByRole("button", { name: "읽음으로 표시" });
    expect(dot).toBeEnabled();
    expect(dot.className).toContain("visible");
    rerender(row("2026-10-22T03:00:00Z"));
    // invisible 이라 접근성 트리·탭 순서에서 빠진다. 점 칸이 글 흐름 밖(absolute)이라 글의 왼쪽 기준선은 그대로다.
    const hidden = screen.getByRole("button", {
      name: "읽음으로 표시",
      hidden: true,
    });
    expect(hidden).toBeDisabled();
    expect(hidden.className).toContain("invisible");
    expect(hidden.className).toContain("absolute");
  });
});

describe("workspaceLabel", () => {
  it("이름이 「워크스페이스」로 끝나면 접미어를 붙이지 않는다", () => {
    expect(workspaceLabel("새로운 워크스페이스")).toBe("");
    expect(workspaceLabel("테스트 유저의 워크스페이스 ")).toBe("");
    expect(workspaceLabel("디자인 팀")).toBe(" 워크스페이스");
  });
});
