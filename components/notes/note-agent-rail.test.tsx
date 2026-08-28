import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  NoteAgentRail,
  type RailTab,
} from "@/components/notes/note-agent-rail";

/**
 * **`role="tab"`을 손으로 붙였으면 키보드도 손으로 붙여야 한다.** 안 그러면 스크린리더가
 * 「탭 목록」이라고 알리는데 방향키가 안 먹어서, 사용자가 배운 규칙이 여기서만 깨진다.
 *
 * WAI-ARIA tabs 패턴이 요구하는 것 넷을 여기서 지킨다 — roving tabIndex, 방향키 이동,
 * Home/End, 그리고 tab↔panel의 id 연결.
 */

vi.mock("@/components/chat/personal-chat", () => ({
  usePersonalChat: () => ({ setRailSlot: vi.fn(), isTurnActive: false }),
}));
// 이 파일이 보는 것은 탭 계약이지 레일 내용이 아니다. 내용은 각자의 테스트가 지킨다.
vi.mock("@/components/notes/context-rail", () => ({
  ContextRail: () => <div data-testid="context-rail" />,
}));

function renderRail(tab: RailTab = "context") {
  const onTabChange = vi.fn();
  render(
    <NoteAgentRail
      tab={tab}
      onTabChange={onTabChange}
      foldedOnNarrow={false}
      onEvidenceSelect={vi.fn()}
    />
  );
  return { onTabChange };
}

afterEach(cleanup);

describe("NoteAgentRail 키보드 계약", () => {
  it("탭 목록은 정거장 하나다 — 고른 탭만 Tab 순서에 든다", () => {
    renderRail("context");
    const tabs = screen.getAllByRole("tab");

    expect(tabs).toHaveLength(2);
    // roving tabIndex. 셋 다 0이면 Tab 으로 셋을 다 지나야 한다.
    expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual(["0", "-1"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("ArrowRight 로 다음 탭으로 옮기고 선택도 따라간다", () => {
    const { onTabChange } = renderRail("context");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(onTabChange).toHaveBeenCalledWith("personal");
  });

  it("ArrowLeft 는 반대로 가고 양 끝에서 감긴다", () => {
    const first = renderRail("context");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    // 첫 탭에서 왼쪽이면 마지막으로 감긴다.
    expect(first.onTabChange).toHaveBeenCalledWith("personal");

    cleanup();
    const last = renderRail("personal");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(last.onTabChange).toHaveBeenCalledWith("context");
  });

  it("Home 과 End 가 양 끝으로 간다", () => {
    const { onTabChange } = renderRail("personal");
    const tablist = screen.getByRole("tablist");

    fireEvent.keyDown(tablist, { key: "Home" });
    expect(onTabChange).toHaveBeenCalledWith("context");

    fireEvent.keyDown(tablist, { key: "End" });
    expect(onTabChange).toHaveBeenCalledWith("personal");
  });

  it("다른 키는 가로채지 않는다", () => {
    const { onTabChange } = renderRail("context");
    for (const key of ["ArrowUp", "a", "Enter", "Tab"]) {
      fireEvent.keyDown(screen.getByRole("tablist"), { key });
    }
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it("탭과 패널이 id 로 이어진다", () => {
    renderRail("context");
    const tabs = screen.getAllByRole("tab");
    // 숨은 패널도 함께 본다 — 둘 다 마운트된 채 hidden 이다.
    const panels = screen.getAllByRole("tabpanel", { hidden: true });

    expect(panels).toHaveLength(2);
    for (const [index, tab] of tabs.entries()) {
      const controls = tab.getAttribute("aria-controls");
      expect(controls).toBeTruthy();
      expect(panels[index].id).toBe(controls);
      expect(panels[index].getAttribute("aria-labelledby")).toBe(tab.id);
    }
  });

  it("클릭도 그대로 동작한다 — 제품 동작은 안 바뀐다", () => {
    const { onTabChange } = renderRail("context");
    fireEvent.click(screen.getByRole("tab", { name: "내 에이전트" }));
    expect(onTabChange).toHaveBeenCalledWith("personal");
  });
});
