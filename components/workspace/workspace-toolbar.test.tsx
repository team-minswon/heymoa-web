import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { SidebarProvider } from "@/components/ui/sidebar";

const recording = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
  elapsedMs: 0,
  phase: "idle",
  error: null,
  start: vi.fn(),
  stop: vi.fn(),
}));
const recordingMeter = vi.hoisted(() => ({
  level: 0.42,
  levelHistory: [0.1, 0.25, 0.7, 0.4],
}));
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
  useRecordingMeter: () => recordingMeter,
}));
describe("WorkspaceToolbar", () => {
  afterEach(() => {
    cleanup();
    push.mockReset();
    recording.start.mockReset();
    recording.stop.mockReset();
  });
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("keeps meeting creation in the page instead of duplicating toolbar actions", () => {
    recording.session = null;
    recording.phase = "idle";
    recording.elapsedMs = 0;
    render(
      <SidebarProvider>
        <WorkspaceToolbar
          workspaceId="01K0000000000"
          currentLabel="모든 노트"
        />
      </SidebarProvider>
    );

    expect(screen.queryByRole("button", { name: "새 회의" })).toBeNull();
    expect(screen.queryByRole("button", { name: "새 노트" })).toBeNull();
  });

  it("shows automatic recording status with only a stop control", () => {
    recording.session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "ACTIVE",
    };
    recording.phase = "recording";
    recording.elapsedMs = 12_000;
    render(
      <SidebarProvider>
        <WorkspaceToolbar workspaceId="01K0000000000" currentLabel="주간" />
      </SidebarProvider>
    );

    expect(screen.queryByText("녹음 중")).toBeNull();
    expect(screen.getByRole("meter", { name: "마이크 입력" })).toHaveAttribute(
      "aria-valuenow",
      "42"
    );
    expect(screen.getByText("00:12")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "구간 확정" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "녹음 종료" }));
    expect(recording.stop).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: /일시 정지|재개/ })
    ).not.toBeInTheDocument();
  });

  it("replaces transitional status labels with the shared spinner", () => {
    recording.session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "ACTIVE",
    };
    recording.phase = "stopping";
    recording.elapsedMs = 12_000;

    render(
      <SidebarProvider>
        <WorkspaceToolbar workspaceId="01K0000000000" currentLabel="주간" />
      </SidebarProvider>
    );

    expect(
      screen.getByRole("status", { name: "녹음 처리 중" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("meter", { name: "마이크 입력" })).toBeNull();
    expect(screen.queryByText("연결 중")).toBeNull();
    expect(screen.queryByText("마무리 중")).toBeNull();
    expect(screen.getByRole("button", { name: "녹음 종료" })).toBeDisabled();
  });
});
