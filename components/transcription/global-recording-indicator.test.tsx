import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalRecordingIndicator } from "@/components/transcription/global-recording-indicator";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push }),
}));
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

  // 필은 알림 표면이라 미터를 두지 않는다 — 미터는 노트 안 dock 의 것이다.
  // 밖에서 초 단위로 움직이는 것은 방해이고, 빨간 점 하나면 「돌고 있다」가 전달된다.
  it("shows elapsed time without a mic meter", () => {
    render(<GlobalRecordingIndicator />);
    expect(screen.queryByRole("meter", { name: "마이크 입력" })).toBeNull();
    expect(screen.getByText("기록 중인 회의")).toBeInTheDocument();
    expect(screen.queryByText("녹음 중")).toBeNull();
  });

  it.each(["requesting-permission", "connecting"] as const)(
    "uses only the shared spinner and disables stop while %s",
    (phase) => {
      recording.phase = phase;

      render(<GlobalRecordingIndicator />);

      expect(
        screen.getByRole("status", { name: "녹음 처리 중" })
      ).toBeInTheDocument();
      expect(screen.queryByText("연결 중")).toBeNull();
      expect(screen.queryByText("마무리 중")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "녹음 종료" }));
      expect(screen.getByRole("button", { name: "녹음 종료" })).toBeDisabled();
      expect(recording.stop).not.toHaveBeenCalled();
    }
  );

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
