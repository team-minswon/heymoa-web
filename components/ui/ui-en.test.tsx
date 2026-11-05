import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { intlWrapper } from "@/components/help/test-intl";
import { HelpTip } from "@/components/ui/help-tip";
import { SidebarProvider, SidebarRail, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("공용 소품 영어 화면", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("도움말 단추와 사이드바 단추 이름이 영어다", () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <HelpTip label="Custom vocabulary">Words to recognize.</HelpTip>
          <SidebarTrigger />
          <SidebarRail />
        </SidebarProvider>
      </TooltipProvider>,
      { wrapper: intlWrapper("en") }
    );

    expect(
      screen.getByRole("button", { name: "Help: Custom vocabulary" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open sidebar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Toggle sidebar" })).toBeTruthy();
  });
});
