import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatStarter } from "@/components/chat/chat-starter";

const integrations = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock(
  "@/lib/api/generated/workspace-integration/workspace-integration",
  () => ({
    useGetWorkspaceIntegrations: () => ({ data: integrations.data }),
  })
);

const shell = vi.hoisted(() => ({
  openSettings: null as null | ((section: string) => void),
}));
vi.mock("@/components/workspace/workspace-app-shell", () => ({
  useOpenSettings: () => shell.openSettings,
}));

const linear = (connected: boolean) => ({
  status: 200,
  data: {
    success: true,
    data: { integrations: [{ provider: "LINEAR", connected }] },
  },
});

function renderStarter(over: Partial<Parameters<typeof ChatStarter>[0]> = {}) {
  const onAsk = vi.fn();
  render(
    <ChatStarter
      workspaceId="w"
      scopeTitles={[]}
      disabled={false}
      onAsk={onAsk}
      {...over}
    />
  );
  return onAsk;
}

describe("ChatStarter", () => {
  beforeEach(() => {
    integrations.data = undefined;
    shell.openSettings = null;
  });
  afterEach(cleanup);

  it("에이전트가 하는 일 넷을 보여 주고 누르면 그 질문을 보낸다", () => {
    const onAsk = renderStarter();
    for (const title of [
      "회의록에서 찾기",
      "할 일 만들기",
      "외부 도구로 잇기",
      "웹에서 찾기",
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: /웹에서 찾기/ }));
    expect(onAsk).toHaveBeenCalledWith(
      "회의에서 언급된 도구의 최신 버전을 웹에서 찾아줘"
    );
  });

  it("답을 만드는 중이거나 승인을 기다리는 동안에는 카드를 누를 수 없다", () => {
    const onAsk = renderStarter({ disabled: true });
    for (const card of screen.getAllByRole("button")) {
      expect((card as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(card);
    }
    expect(onAsk).not.toHaveBeenCalled();
  });

  it("범위가 붙어 있으면 그 범위로 물어본다고 알린다", () => {
    renderStarter({ scopeTitles: ["주간 회의"] });
    expect(screen.getByText("주간 회의에 대해 물어봐요.")).toBeTruthy();
  });

  it("범위가 없으면 @ 로 고르는 법을 알린다", () => {
    renderStarter();
    expect(screen.getByText(/@로 프로젝트·회의록을 고르면/)).toBeTruthy();
  });

  it("Linear 연동이 없다고 확인되면 연동하기로 바뀌어 설정의 연동 섹션을 연다", () => {
    integrations.data = linear(false);
    const openSettings = vi.fn();
    shell.openSettings = openSettings;
    const onAsk = renderStarter();

    fireEvent.click(screen.getByRole("button", { name: /외부 도구로 잇기/ }));
    expect(openSettings).toHaveBeenCalledWith("integrations");
    expect(onAsk).not.toHaveBeenCalled();
    expect(screen.getByText("연동하기")).toBeTruthy();
  });

  it("연동돼 있거나 상태를 모르면 평소처럼 보낸다", () => {
    shell.openSettings = vi.fn();
    for (const data of [linear(true), undefined]) {
      cleanup();
      integrations.data = data;
      const onAsk = renderStarter();
      fireEvent.click(screen.getByRole("button", { name: /외부 도구로 잇기/ }));
      expect(onAsk).toHaveBeenCalledWith(
        "논의된 이슈를 Linear 이슈로 만들어줘"
      );
    }
  });
});
