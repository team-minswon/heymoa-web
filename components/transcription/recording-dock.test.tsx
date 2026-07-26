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

  describe("disabledReason", () => {
    const reason = "종료된 회의입니다.";

    it("시작 버튼 자리에 이유를 세운다", () => {
      recording.phase = "idle";

      render(<RecordingDock noteId="note-1" disabledReason={reason} />);

      // 잠긴 버튼 + title이 아니라 본문이어야 터치·키보드에서도 이유가 보인다.
      expect(screen.getByText(reason)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "기록 시작" })).toBeNull();
    });

    it("녹음 중이면 이유가 정지 버튼을 밀어내지 않는다", () => {
      // 내가 녹음하는 도중 다른 멤버가 회의를 끝내면 종료 사유가 들어온다. 이때
      // 이유를 대신 세우면 내 녹음을 멈출 방법이 사라진다.
      recording.phase = "recording";

      render(<RecordingDock noteId="note-1" disabledReason={reason} />);

      expect(
        screen.getByRole("button", { name: "녹음 종료" })
      ).toBeInTheDocument();
      expect(screen.queryByText(reason)).toBeNull();
    });
  });
});
