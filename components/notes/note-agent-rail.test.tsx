import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteAgentRail } from "@/components/notes/note-agent-rail";

const setRailSlot = vi.fn();
vi.mock("@/components/chat/personal-chat", () => ({
  usePersonalChat: () => ({ setRailSlot, isTurnActive: false }),
}));

afterEach(() => {
  cleanup();
  setRailSlot.mockClear();
});

describe("NoteAgentRail", () => {
  it("서 있는 동안 개인 챗봇에 자리를 넘기고, 사라지면 거둔다", () => {
    const { unmount } = render(
      <NoteAgentRail onCollapse={vi.fn()} collapseDisabled={false} />
    );
    // 레일이 곧 대화다 — 탭을 고를 필요 없이 서자마자 자리를 넘긴다.
    expect(setRailSlot).toHaveBeenLastCalledWith(expect.any(HTMLDivElement));

    unmount();
    expect(setRailSlot).toHaveBeenLastCalledWith(null);
  });

  it("접기 버튼이 레일을 접는다", () => {
    const onCollapse = vi.fn();
    render(<NoteAgentRail onCollapse={onCollapse} collapseDisabled={false} />);

    fireEvent.click(screen.getByRole("button", { name: "내 에이전트 접기" }));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("답이 흐르는 동안에는 접지 못하고 그 이유를 이름으로 말한다", () => {
    const onCollapse = vi.fn();
    render(<NoteAgentRail onCollapse={onCollapse} collapseDisabled />);

    const button = screen.getByRole("button", {
      name: "답변이 끝나면 접을 수 있습니다",
    });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onCollapse).not.toHaveBeenCalled();
  });

  it("탭이 없다 — 실시간 정리는 본문 타임라인으로 갔다", () => {
    render(<NoteAgentRail onCollapse={vi.fn()} collapseDisabled={false} />);
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByRole("heading", { name: "내 에이전트" })).toBeVisible();
  });
});
