import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalRecordingIndicator } from "@/components/transcription/global-recording-indicator";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
const recording = vi.hoisted(() => ({
  stop: vi.fn(),
  session: { noteId: "01K0000000002", status: "ACTIVE" },
  phase: "recording",
  elapsedMs: 1200,
  buffer: null as { paused: boolean; limitMs: number } | null,
  connectionNotice: null as { cause: string; sinceMs: number } | null,
  microphone: "live",
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  useGetWorkspaces: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          workspaces: [{ workspaceId: "01K0000000000" }],
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
    recording.buffer = null;
    recording.connectionNotice = null;
    recording.microphone = "live";
    route.pathname = "/";
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // 한도에서는 마이크를 끄지 않고 조각만 안 받는다. 노트 패널을 떠나 있으면 그 안내가 안 보인다
  it("기기 저장 한도로 녹음을 멈췄으면 노트 밖에서도 알린다", () => {
    recording.buffer = { paused: true, limitMs: 3_600_000 };

    render(<GlobalRecordingIndicator />);

    expect(screen.getByRole("alert")).toHaveTextContent("녹음을 잠시 멈췄어요");
  });

  it("워크스페이스 안이라도 녹음 중인 노트를 보고 있지 않으면 멈춤을 알린다", () => {
    recording.buffer = { paused: true, limitMs: 3_600_000 };
    route.pathname = "/w/01K0000000000/notes";

    render(<GlobalRecordingIndicator />);

    expect(screen.getByRole("alert")).toHaveTextContent("녹음을 잠시 멈췄어요");
  });

  it("녹음 중인 노트를 보고 있으면 그 노트의 안내에 맡긴다", () => {
    recording.buffer = { paused: true, limitMs: 3_600_000 };
    route.pathname = "/w/01K0000000000/notes/01K0000000002";

    render(<GlobalRecordingIndicator />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("노트 밖 워크스페이스 화면에서도 연결 끊김 안내를 보인다", () => {
    recording.connectionNotice = { cause: "disconnected", sinceMs: 5_000 };
    route.pathname = "/w/01K0000000000/notes";

    render(<GlobalRecordingIndicator />);

    expect(screen.getByText(/연결이 끊겼어요/)).toBeInTheDocument();
  });

  it("노트 밖에서 마이크가 끊겨도 알린다", () => {
    recording.microphone = "muted";
    route.pathname = "/w/01K0000000000";

    render(<GlobalRecordingIndicator />);

    expect(screen.getByText(/마이크가 끊겼습니다/)).toBeInTheDocument();
  });

  it("녹음 중인 노트를 보고 있으면 연결 안내를 두 번 띄우지 않는다", () => {
    recording.connectionNotice = { cause: "disconnected", sinceMs: 5_000 };
    route.pathname = "/w/01K0000000000/notes/01K0000000002";

    render(<GlobalRecordingIndicator />);

    expect(screen.queryByText(/연결이 끊겼어요/)).toBeNull();
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

  it.each(["requesting-permission", "connecting"] as const)(
    "uses only the shared spinner and disables stop while %s",
    (phase) => {
      recording.phase = phase;

      render(<GlobalRecordingIndicator />);

      expect(
        screen.getByRole("status", { name: "녹음 처리 중" })
      ).toBeInTheDocument();
      expect(screen.queryByRole("meter", { name: "마이크 입력" })).toBeNull();
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
