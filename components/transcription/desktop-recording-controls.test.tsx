import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DesktopRecordingAction,
  RecordingSummary,
} from "@heymoa/desktop-contracts";
import { DesktopRecordingControls } from "./desktop-recording-controls";

const push = vi.hoisted(() => vi.fn());
const recording = vi.hoisted(() => ({
  phase: "recording",
  session: { startedAt: "2026-10-05T00:00:00Z" },
  activeNoteId: "note-A",
  activeWorkspaceId: "workspace-A",
  buffer: { pendingMs: 1250 },
  microphone: "live",
  systemAudio: "ended",
  stop: vi.fn(async () => true),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./recording-provider", () => ({ useRecording: () => recording }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  recording.phase = "recording";
});

function native() {
  let listener!: (action: DesktopRecordingAction) => void;
  const unsubscribe = vi.fn();
  const reportRecording = vi.fn<(summary: RecordingSummary) => Promise<void>>(
    async () => {}
  );
  Object.defineProperty(window, "heymoaDesktop", {
    configurable: true,
    value: {
      reportRecording,
      subscribeRecordingActions: (callback: typeof listener) => {
        listener = callback;
        return unsubscribe;
      },
    },
  });
  return {
    reportRecording,
    unsubscribe,
    action: (value: DesktopRecordingAction) => listener(value),
  };
}
afterEach(() => {
  Reflect.deleteProperty(window, "heymoaDesktop");
});

describe("desktop recording controls", () => {
  it("ignores delayed stop commands after recording moved into another phase", () => {
    const bridge = native();
    const view = render(<DesktopRecordingControls />);
    for (const phase of ["requesting-permission", "connecting", "stopping", "failed", "completed", "idle"]) {
      recording.phase = phase;
      view.rerender(<DesktopRecordingControls />);
      act(() => bridge.action("stop"));
    }
    expect(recording.stop).not.toHaveBeenCalled();
    recording.phase = "recording";
    view.rerender(<DesktopRecordingControls />);
    act(() => bridge.action("stop"));
    expect(recording.stop).toHaveBeenCalledOnce();
  });
  it("reports pending audio after failure and exposes no note, workspace, or session identifiers", () => {
    const bridge = native();
    const view = render(<DesktopRecordingControls />);
    expect(bridge.reportRecording).toHaveBeenLastCalledWith({
      phase: "recording",
      startedAt: Date.parse("2026-10-05T00:00:00Z"),
      pendingMs: 1250,
      microphone: "live",
      systemAudio: "ended",
    });
    recording.phase = "failed";
    view.rerender(<DesktopRecordingControls />);
    expect(bridge.reportRecording).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: "failed", pendingMs: 1250 })
    );
    expect(
      Object.keys(bridge.reportRecording.mock.calls.at(-1)![0]).sort()
    ).toEqual(["microphone", "pendingMs", "phase", "startedAt", "systemAudio"]);
  });

  it("opens the active workspace's note through client navigation and uses existing stop", () => {
    const bridge = native();
    const view = render(<DesktopRecordingControls />);
    act(() => {
      bridge.action("show-current");
      bridge.action("stop");
    });
    expect(push).toHaveBeenCalledWith(
      "/w/workspace-A/notes/note-A?view=full&tab=transcript"
    );
    expect(recording.stop).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(bridge.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
