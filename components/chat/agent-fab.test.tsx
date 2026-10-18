import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentFab } from "@/components/chat/agent-fab";
import { readUserFlag } from "@/lib/storage/user-flags";

function renderFab(over: Partial<Parameters<typeof AgentFab>[0]> = {}) {
  const onOpen = vi.fn();
  render(<AgentFab hidden={false} onOpen={onOpen} className="" {...over} />);
  return { onOpen };
}

vi.mock("@/components/auth/auth-provider", () => ({
  useAuthUserId: () => "u1",
}));

describe("AgentFab 시선 끌기", () => {
  beforeEach(() => {
    window.localStorage.setItem("heymoa:u:u1:agent-intro-dismissed", "1");
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("20초 뒤 파동 신호가 켜지고 2.4초 뒤 꺼진다. 말풍선은 자동으로 안 뜬다", () => {
    renderFab();
    const button = screen.getByRole("button", { name: "내 에이전트 열기" });
    expect(button.hasAttribute("data-nudge")).toBe(false);
    act(() => void vi.advanceTimersByTime(20_000));
    expect(button.hasAttribute("data-nudge")).toBe(true);
    expect(document.body.textContent).not.toContain("무엇이든 질문해보세요!");
    act(() => void vi.advanceTimersByTime(2_400));
    expect(button.hasAttribute("data-nudge")).toBe(false);
  });

  it("안내 카드를 닫은 시점부터 20초를 센다", () => {
    window.localStorage.clear();
    renderFab();
    act(() => void vi.advanceTimersByTime(60_000));
    const button = screen.getByRole("button", { name: "내 에이전트 열기" });
    expect(button.hasAttribute("data-nudge")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "다시 보지 않기" }));
    act(() => void vi.advanceTimersByTime(19_999));
    expect(button.hasAttribute("data-nudge")).toBe(false);
    act(() => void vi.advanceTimersByTime(1));
    expect(button.hasAttribute("data-nudge")).toBe(true);
  });

  it("안내 카드가 떠 있거나 패널이 열려 있으면 부르지 않는다", () => {
    window.localStorage.clear();
    renderFab();
    act(() => void vi.advanceTimersByTime(60_000));
    expect(vi.getTimerCount()).toBe(0);
    cleanup();
    window.localStorage.setItem("heymoa:u:u1:agent-intro-dismissed", "1");
    renderFab({ hidden: true });
    act(() => void vi.advanceTimersByTime(60_000));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("한 번 열어 본 뒤에는 부르지 않는다", () => {
    renderFab();
    fireEvent.click(screen.getByRole("button", { name: "내 에이전트 열기" }));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(
      screen
        .getByRole("button", { name: "내 에이전트 열기" })
        .hasAttribute("data-nudge")
    ).toBe(false);
  });
});

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
    expect(readUserFlag("u1", "agentIntroDismissed")).toBe("1");
    cleanup();
    renderFab();
    expect(screen.queryByTestId("agent-intro")).toBeNull();
  });

  it("Esc 로 닫는다", () => {
    renderFab();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("agent-intro")).toBeNull();
    expect(readUserFlag("u1", "agentIntroDismissed")).toBe("1");
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
    expect(readUserFlag("u1", "agentIntroDismissed")).toBe("1");
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
