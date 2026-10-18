import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { helpTopics } from "@/app/(static)/help/_content/topics";
import { HelpPalette } from "@/components/help/help-palette";
import { buildHelpIndex } from "@/lib/help/search-index";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("HelpPalette", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify(buildHelpIndex(helpTopics)))
      )
    );
    push.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("Ctrl+K 로 열고 ↓ Enter 로 고른 결과의 섹션으로 간다", async () => {
    render(<HelpPalette />);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const box = await screen.findByRole("combobox", {
      name: "사용 가이드 전체에서 찾기",
    });
    await act(async () => {});
    fireEvent.change(box, { target: { value: "녹음" } });
    const options = await screen.findAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute(
      "aria-selected",
      "true"
    );
    fireEvent.keyDown(box, { key: "Enter" });
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(/^\/help\/[a-z-]+\/[a-z-]+\?q=.+#.+/)
    );
  });

  it("한글 조합 중의 Enter 는 이동하지 않는다", async () => {
    render(<HelpPalette />);
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    const box = await screen.findByRole("combobox");
    await act(async () => {});
    fireEvent.change(box, { target: { value: "녹음" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(box, { key: "Enter", isComposing: true });
    expect(push).not.toHaveBeenCalled();
  });

  it("일치가 없으면 안내한다", async () => {
    render(<HelpPalette />);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const box = await screen.findByRole("combobox");
    await act(async () => {});
    fireEvent.change(box, { target: { value: "없는낱말zzz" } });
    expect(
      await screen.findByText(/다른 낱말로 찾아보세요/)
    ).toBeInTheDocument();
  });
});
