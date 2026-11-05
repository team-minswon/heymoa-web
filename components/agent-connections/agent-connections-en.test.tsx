import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentAccessBlockedNotice } from "@/components/agent-connections/agent-access-blocked";
import { AgentAccessNotice } from "@/components/agent-connections/agent-access-notice";
import { AgentOAuthEndCard } from "@/components/agent-connections/agent-oauth-cards";
import { AgentOAuthGuide } from "@/components/agent-connections/agent-oauth-guide";
import { TaskChangesToggle } from "@/components/agent-connections/task-changes-toggle";
import { intlWrapper } from "@/components/help/test-intl";

const HANGUL = /[가-힣]/;

describe("에이전트 연결 영어 화면", () => {
  it("OAuth 안내가 영어로 그려지고 한글이 남지 않는다", () => {
    const { container } = render(
      <AgentOAuthGuide onPersonalToken={vi.fn()} onClose={vi.fn()} />,
      { wrapper: intlWrapper("en") }
    );

    expect(
      screen.getByRole("region", { name: "How to connect with OAuth" })
    ).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Claude app" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create personal access token" })
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Copy HeyMoa URL" }).length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(HANGUL);
    const labels = Array.from(container.querySelectorAll("[aria-label]")).map(
      (element) => element.getAttribute("aria-label") ?? ""
    );
    expect(labels.join(" ")).not.toMatch(HANGUL);
  });

  it("동의 화면의 알림·스위치·끝 카드도 영어다", () => {
    const { container } = render(
      <>
        <AgentAccessNotice allowTaskChanges />
        <TaskChangesToggle checked onCheckedChange={vi.fn()} />
        <AgentAccessBlockedNotice onRecheck={vi.fn()} rechecking={false} />
        <AgentOAuthEndCard />
      </>,
      { wrapper: intlWrapper("en") }
    );

    expect(screen.getByText("Allow task changes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
    expect(
      screen.getByText(
        "Couldn't find the connection request. Connect again from your agent."
      )
    ).toBeTruthy();
    expect(container.textContent).not.toMatch(HANGUL);
  });
});
