import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  helpGroupsFor,
  situationClustersFor,
} from "@/app/[lang]/help/_content/topics";
import { HelpBadge } from "@/components/help/help-badge";
import { HelpSidebar } from "@/components/help/help-sidebar";
import { intlWrapper } from "@/components/help/test-intl";

vi.mock("next/navigation", () => ({
  usePathname: () => "/help/situations/desktop-no-audio",
}));

describe("HelpBadge", () => {
  afterEach(cleanup);

  it("보이는 글은 짧게, 스크린리더에는 데스크톱 앱 전용이라고 읽어 준다", () => {
    render(<HelpBadge name="desktop" />, { wrapper: intlWrapper() });
    expect(screen.getByText("데스크톱")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("데스크톱 앱 전용")).toHaveClass("sr-only");
  });

  it("영어판은 영어로 보이고 읽힌다", () => {
    render(<HelpBadge name="desktop" />, { wrapper: intlWrapper("en") });
    expect(screen.getByText("Desktop")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Desktop app only")).toHaveClass("sr-only");
  });

  it("사이드바 항목 라벨 옆에 붙고, 선택된 항목에서는 흰 알약으로 바뀐다", () => {
    render(
      <HelpSidebar
        groups={helpGroupsFor("ko")}
        clusters={situationClustersFor("ko")}
        topics={[
          { slug: "desktop-no-audio", group: "situations", title: "녹음이 안 돼요", badge: "desktop" },
        ]}
      />,
      { wrapper: intlWrapper() }
    );
    const link = screen.getByRole("link", { name: /녹음이 안 돼요/ });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.className).toContain("group/item");
    expect(link.textContent).toContain("데스크톱");
    expect(link.querySelector("[data-slot='badge']")!.className).toContain(
      "group-aria-[current=page]/item:bg-white"
    );
  });
});
