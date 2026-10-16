import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AGENT_INTRO_KEY, AgentFab } from "@/components/chat/agent-fab";

function renderFab(over: Partial<Parameters<typeof AgentFab>[0]> = {}) {
  const onOpen = vi.fn();
  render(<AgentFab hidden={false} onOpen={onOpen} className="" {...over} />);
  return { onOpen };
}

describe("AgentFab", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("처음 온 브라우저에는 안내 카드가 뜨고 하는 일 넷을 적는다", () => {
    renderFab();
    const card = screen.getByTestId("agent-intro");
    expect(card.textContent).toContain("회의록에서 찾기");
    expect(card.textContent).toContain("웹에서 찾기");
  });

  it("다시 보지 않기를 누르면 닫히고 다음 방문에도 안 뜬다", () => {
    renderFab();
    fireEvent.click(screen.getByRole("button", { name: "다시 보지 않기" }));
    expect(screen.queryByTestId("agent-intro")).toBeNull();
    expect(window.localStorage.getItem(AGENT_INTRO_KEY)).toBe("1");
    cleanup();
    renderFab();
    expect(screen.queryByTestId("agent-intro")).toBeNull();
  });

  it("Esc 로 닫는다", () => {
    renderFab();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("agent-intro")).toBeNull();
    expect(window.localStorage.getItem(AGENT_INTRO_KEY)).toBe("1");
  });

  it("열어 보기와 버튼 자체는 안내를 닫고 에이전트를 연다", () => {
    const { onOpen } = renderFab();
    fireEvent.click(screen.getByRole("button", { name: "열어 보기" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("agent-intro")).toBeNull();

    cleanup();
    window.localStorage.clear();
    const second = renderFab();
    fireEvent.click(screen.getByRole("button", { name: "내 에이전트 열기" }));
    expect(second.onOpen).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(AGENT_INTRO_KEY)).toBe("1");
  });

  it("패널이 열려 숨는 동안은 카드도 보이지 않는다", () => {
    renderFab({ hidden: true });
    expect(screen.queryByTestId("agent-intro")).toBeNull();
  });

  it("저장소를 못 읽는 브라우저에서도 화면이 정상이고 안내는 안 뜬다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderFab();
    expect(screen.queryByTestId("agent-intro")).toBeNull();
    expect(
      screen.getByRole("button", { name: "내 에이전트 열기" })
    ).toBeTruthy();
  });

  it("저장소에 못 써도 이번 방문에서는 닫힌다", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderFab();
    fireEvent.click(screen.getByRole("button", { name: "다시 보지 않기" }));
    expect(screen.queryByTestId("agent-intro")).toBeNull();
  });
});
