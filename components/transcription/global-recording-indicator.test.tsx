import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GlobalRecordingIndicator } from "@/components/transcription/global-recording-indicator";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
const recording = vi.hoisted(() => ({
  commit: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  useGetWorkspaces: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          workspaces: [{ workspaceId: "01K0000000000", isDefault: true }],
        },
      },
    },
  }),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({
    session: { noteId: "01K0000000002", status: "ACTIVE" },
    phase: "recording",
    elapsedMs: 1200,
    level: 0.42,
    levelHistory: [0.1, 0.25, 0.7, 0.4],
    commit: recording.commit,
    stop: recording.stop,
  }),
}));

describe("GlobalRecordingIndicator", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders input level as an accessible meter", () => {
    render(<GlobalRecordingIndicator />);
    expect(screen.getByRole("meter", { name: "마이크 입력" })).toHaveAttribute(
      "aria-valuenow",
      "42"
    );
    expect(screen.getByText("녹음 중")).toBeInTheDocument();
    expect(screen.getByTestId("global-wave-bar-2")).toHaveStyle({
      transform: "scaleY(0.7)",
    });
  });

  it("offers only stop while automatic finalization is active", () => {
    render(<GlobalRecordingIndicator />);

    expect(
      screen.queryByRole("button", { name: "구간 확정" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "녹음 종료" }));
    expect(recording.stop).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: /일시 정지|재개/ })
    ).not.toBeInTheDocument();
  });
});
