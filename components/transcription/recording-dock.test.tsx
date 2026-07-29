import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecordingDock } from "@/components/transcription/recording-dock";

const recording = vi.hoisted(() => ({
  activeNoteId: "note-1",
  elapsedMs: 0,
  phase: "connecting",
  session: { noteId: "note-1", status: "ACTIVE" },
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@/components/transcription/recording-provider", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/transcription/recording-provider")
  >("@/components/transcription/recording-provider");
  return {
    ...actual,
    useRecording: () => recording,
    useRecordingMeter: () => ({
      level: 0,
      levelHistory: [0, 0, 0, 0, 0],
    }),
  };
});

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

      expect(screen.getByRole("button", { name: "중지" })).toBeInTheDocument();
      expect(screen.queryByText(reason)).toBeNull();
    });
  });

  it.each(["회의 시작", "재개"] as const)(
    "%s 라벨로 같은 시작 경로를 쓰고 44px 터치 영역을 둔다",
    (startLabel) => {
      recording.phase = "idle";
      recording.start.mockReset();

      render(<RecordingDock noteId="note-1" startLabel={startLabel} />);

      const button = screen.getByRole("button", { name: startLabel });
      expect(button).toHaveClass("size-11");
      fireEvent.click(button);
      expect(recording.start).toHaveBeenCalledWith("note-1");
    }
  );

  it("로컬 녹음의 단일 중지 버튼도 44px 터치 영역을 둔다", () => {
    recording.phase = "recording";

    render(<RecordingDock noteId="note-1" />);

    expect(screen.getByRole("button", { name: "중지" })).toHaveClass("size-11");
  });

  it("실패 후 다시 시도도 44px 터치 영역을 둔다", () => {
    recording.phase = "failed";

    render(<RecordingDock noteId="note-1" />);

    expect(screen.getByRole("button", { name: "다시 시도" })).toHaveClass(
      "h-11"
    );
  });

  it("다른 노트의 failed ACTIVE 세션이 있으면 시작 버튼을 잠근다", () => {
    recording.phase = "failed";

    render(<RecordingDock noteId="note-2" />);

    expect(
      screen.getByRole("button", { name: "다른 노트에서 녹음 중" })
    ).toBeDisabled();
  });
});
