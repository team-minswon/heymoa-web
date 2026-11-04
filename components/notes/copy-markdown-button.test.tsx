import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { intlWrapper } from "@/components/help/test-intl";
import { CopyMarkdownButton } from "@/components/notes/copy-markdown-button";

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/toast", () => ({ toast: { success: toastSuccess } }));
vi.mock("@/lib/ui/copy-text", () => ({ copyText: vi.fn(async () => {}) }));

describe("CopyMarkdownButton", () => {
  it("무엇을 복사하는지 노트 탭 이름으로 말한다", async () => {
    render(<CopyMarkdownButton kind="timeline" iconOnly build={() => "#"} />);
    fireEvent.click(screen.getByRole("button", { name: "타임라인 복사" }));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "타임라인 내용을 클립보드에 복사했습니다.",
        { id: "copy-timeline" }
      )
    );
  });

  it("영어 화면에서는 영어 탭 이름을 쓴다", async () => {
    render(<CopyMarkdownButton kind="transcript" build={() => "#"} />, {
      wrapper: intlWrapper("en"),
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        "Transcript copied to clipboard.",
        { id: "copy-transcript" }
      )
    );
  });
});
