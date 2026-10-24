import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatStarter } from "@/components/chat/chat-starter";

const integrations = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock(
  "@/lib/api/generated/workspace-integration/workspace-integration",
  () => ({
    useGetWorkspaceIntegrations: () => ({ data: integrations.data }),
  })
);

const linear = (connected: boolean) => ({
  status: 200,
  data: {
    success: true,
    data: { integrations: [{ provider: "LINEAR", connected }] },
  },
});

function renderStarter(over: Partial<Parameters<typeof ChatStarter>[0]> = {}) {
  const onPick = vi.fn();
  render(
    <ChatStarter
      workspaceId="w"
      contextTitle={null}
      disabled={false}
      onPick={onPick}
      {...over}
    />
  );
  return onPick;
}

const examples = () =>
  within(screen.getByRole("list", { name: "예시 질문" }))
    .getAllByRole("button")
    .map((button) => button.textContent);

describe("ChatStarter", () => {
  beforeEach(() => {
    integrations.data = undefined;
  });
  afterEach(cleanup);

  it("큰 카드 대신 인사 한 줄 · 설명 한 문장 · 예시 서너 줄이다", () => {
    renderStarter();
    expect(
      screen.getByRole("heading", { name: "무엇을 도와드릴까요?" })
    ).toBeTruthy();
    expect(screen.getByText(/근거와 함께 답해요/)).toBeTruthy();
    expect(examples()).toEqual([
      "지난 회의에서 정한 것만 정리해줘",
      "남은 액션 아이템을 할 일로 만들어줘",
      "회의에서 언급된 도구의 최신 버전을 웹에서 찾아줘",
    ]);
  });

  it("예시를 누르면 그 예시를 넘긴다 — 보내는 것은 부르는 쪽이 아니라 사람이다", () => {
    const onPick = renderStarter();
    fireEvent.click(screen.getByRole("button", { name: /웹에서 찾아줘/ }));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "web",
        question: "회의에서 언급된 도구의 최신 버전을 웹에서 찾아줘",
      })
    );
  });

  it("답을 만드는 중이거나 승인을 기다리는 동안에는 예시를 누를 수 없다", () => {
    const onPick = renderStarter({ disabled: true });
    for (const card of screen.getAllByRole("button")) {
      expect((card as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(card);
    }
    expect(onPick).not.toHaveBeenCalled();
  });

  it("회의록에서 열었으면 그 회의 예시가 첫 줄이고 설명도 그 회의를 말한다", () => {
    renderStarter({ contextTitle: "주간 회의" });
    expect(examples()[0]).toBe("이 회의에서 정한 것과 남은 일을 정리해줘");
    expect(screen.getByText(/「주간 회의」 회의록을 보고 답해요/)).toBeTruthy();
  });

  it("★ 연동 안내 줄은 없다 — 연동이 없어도, 있어도(사용자 지시)", () => {
    for (const data of [linear(false), linear(true), undefined]) {
      cleanup();
      integrations.data = data;
      renderStarter();
      expect(screen.queryByText(/연동하면/)).toBeNull();
      expect(screen.queryByRole("button", { name: "연동하기" })).toBeNull();
    }
  });

  it("연동 전이면 연동 도구 예시를 권하지 않는다", () => {
    integrations.data = linear(false);
    renderStarter();
    expect(examples().some((text) => text?.includes("Linear"))).toBe(false);
  });

  it("연동돼 있으면 연동 도구 예시가 선다", () => {
    integrations.data = linear(true);
    renderStarter();
    expect(examples()).toContain("논의된 이슈를 Linear 이슈로 만들어줘");
  });

  it("상태를 모르면 연동 예시를 내지 않는다", () => {
    renderStarter();
    expect(examples().some((text) => text?.includes("Linear"))).toBe(false);
  });
});
