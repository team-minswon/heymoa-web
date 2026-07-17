import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecordingDock } from "@/components/transcription/recording-dock";

const recording = vi.hoisted(() => ({
  activeNoteId: "note-1",
  elapsedMs: 0,
  phase: "connecting",
  session: { noteId: "note-1" },
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
  useRecordingMeter: () => ({
    level: 0,
    levelHistory: [0, 0, 0, 0, 0],
  }),
}));

describe("RecordingDock", () => {
  afterEach(cleanup);

  it.each(["requesting-permission", "connecting", "stopping"])(
    "uses one spinner-only pending state for %s",
    (phase) => {
      recording.phase = phase;

      render(<RecordingDock noteId="note-1" />);

      expect(
        screen.getByRole("status", { name: "녹음 처리 중" })
      ).toBeInTheDocument();
      expect(screen.queryByText("마이크 확인 중")).toBeNull();
      expect(screen.queryByText("연결 중")).toBeNull();
      expect(screen.queryByText("마무리 중")).toBeNull();
    }
  );
});
