import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { intlWrapper } from "@/components/help/test-intl";
import { CopyMarkdownButton } from "@/components/notes/copy-markdown-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { summaryToMarkdown } from "@/lib/notes/copy-markdown";

vi.unmock("@/lib/i18n/use-display-locale");

const copied = vi.hoisted(() => ({ text: "" }));
vi.mock("@/lib/ui/copy-text", () => ({
  copyText: async (text: string) => {
    copied.text = text;
  },
}));

describe("영어 화면의 복사본", () => {
  it("요약 복사본이 영어 머리말·섹션·날짜로 나온다", async () => {
    render(
      <TooltipProvider>
        <CopyMarkdownButton
          kind="summary"
          build={(doc) =>
            summaryToMarkdown({
              doc,
              note: {
                title: "Weekly sync",
                whenIso: "2026-10-15T05:00:00Z",
                participantCount: 3,
                durationMs: 1_820_000,
              },
              sections: [],
            })
          }
        />
      </TooltipProvider>,
      { wrapper: intlWrapper("en") }
    );

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => expect(copied.text).not.toBe(""));
    expect(copied.text).toContain("# Weekly sync — Summary");
    expect(copied.text).toContain(
      "October 15, 2026 at 2:00 PM · 3 attendees · 30 min recorded"
    );
    expect(copied.text).toContain("## Tasks\n\n_None_");
    expect(copied.text).not.toMatch(/[가-힣]/);
  });
});
