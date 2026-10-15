import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewActions } from "@/components/notes/review/review-actions";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/track", () => ({ track }));

const toastInfo = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: toastInfo, dismiss: vi.fn() },
}));

const MARKDOWN = "# 회의\n\n## 결정\n\n- **요금**은 회의 시간 기준\n";

describe("ReviewActions", () => {
  const writeText = vi.fn();

  afterEach(cleanup);

  beforeEach(() => {
    track.mockReset();
    toastInfo.mockReset();
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  it("마크다운으로 복사하면 누른 순간 만든 문서를 그대로 넣고 형식만 이벤트에 싣는다", async () => {
    const build = vi.fn(() => MARKDOWN);
    render(<ReviewActions build={build} />);
    expect(build).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "요약 복사" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /마크다운/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(MARKDOWN));
    expect(track).toHaveBeenCalledWith("summary_copied", { format: "markdown" });
  });

  it("텍스트로 복사하면 마크다운 기호를 걷어 낸다", async () => {
    render(<ReviewActions build={() => MARKDOWN} />);

    fireEvent.click(screen.getByRole("button", { name: "요약 복사" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /텍스트로 복사/ }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("회의\n\n결정\n\n• 요금은 회의 시간 기준\n")
    );
    expect(track).toHaveBeenCalledWith("summary_copied", { format: "text" });
  });

  it("복사할 문서가 없으면 복사 버튼을 막는다", () => {
    render(<ReviewActions build={() => ""} disabled />);
    expect(screen.getByRole("button", { name: "요약 복사" })).toBeDisabled();
  });

  it("아직 없는 내보내기를 누르면 준비 중이라고 알리고 수요만 센다", async () => {
    render(<ReviewActions build={() => MARKDOWN} />);

    fireEvent.click(screen.getByRole("button", { name: "내보내기·공유" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /PDF/ }));

    expect(track).toHaveBeenCalledWith("export_requested", { target: "pdf" });
    expect(toastInfo).toHaveBeenCalledWith(expect.stringContaining("준비 중"), expect.anything());
    expect(writeText).not.toHaveBeenCalled();
  });
});
