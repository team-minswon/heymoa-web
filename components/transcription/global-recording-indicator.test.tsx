import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GLOBAL_RECORDING_EXIT_DURATION,
  GlobalRecordingIndicator,
} from "@/components/transcription/global-recording-indicator";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
const recording = vi.hoisted(() => ({
  stop: vi.fn(),
  session: { noteId: "01K0000000002", status: "ACTIVE" },
  phase: "recording",
  elapsedMs: 1200,
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
  useRecording: () => recording,
  useRecordingMeter: () => ({
    level: 0.42,
    levelHistory: [0.1, 0.25, 0.7, 0.4],
  }),
}));

describe("GlobalRecordingIndicator", () => {
  beforeEach(() => {
    recording.phase = "recording";
    recording.elapsedMs = 1200;
  });

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
    expect(screen.queryByText("녹음 중")).toBeNull();
    expect(screen.getByTestId("global-wave-bar-2")).toHaveStyle({
      transform: "scaleY(0.7)",
    });
  });

  it("uses a doubled exit duration without changing its entry duration", () => {
    expect(GLOBAL_RECORDING_EXIT_DURATION).toBe(0.3);
  });

  it("uses only the shared spinner for transitional states", () => {
    recording.phase = "connecting";

    render(<GlobalRecordingIndicator />);

    expect(
      screen.getByRole("status", { name: "녹음 처리 중" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("meter", { name: "마이크 입력" })).toBeNull();
    expect(screen.queryByText("연결 중")).toBeNull();
    expect(screen.queryByText("마무리 중")).toBeNull();
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
