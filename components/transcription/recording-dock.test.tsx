import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecordingDock } from "@/components/transcription/recording-dock";

/** 독이 시작할 때 넘겨야 하는 워크스페이스. 계약이 노트에서 알려주지 않는다. */
const WORKSPACE_ID = "0HZX2K7M9Q4AW";

const recording = vi.hoisted(() => ({
  activeNoteId: "note-1",
  elapsedMs: 0,
  phase: "connecting",
  session: { noteId: "note-1", status: "ACTIVE" },
  error: null as string | null,
  start: vi.fn(),
  stop: vi.fn(),
  disconnect: vi.fn(),
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

      render(<RecordingDock noteId="note-1" workspaceId={WORKSPACE_ID} />);

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

      render(
        <RecordingDock
          noteId="note-1"
          workspaceId={WORKSPACE_ID}
          disabledReason={reason}
        />
      );

      // 잠긴 버튼 + title이 아니라 본문이어야 터치·키보드에서도 이유가 보인다.
      expect(screen.getByText(reason)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "기록 시작" })).toBeNull();
    });

    it("녹음 중이면 이유가 정지 버튼을 밀어내지 않는다", () => {
      // 내가 녹음하는 도중 다른 멤버가 회의를 끝내면 종료 사유가 들어온다. 이때
      // 이유를 대신 세우면 내 녹음을 멈출 방법이 사라진다.
      recording.phase = "recording";

      render(
        <RecordingDock
          noteId="note-1"
          workspaceId={WORKSPACE_ID}
          disabledReason={reason}
        />
      );

      expect(screen.getByRole("button", { name: "중지" })).toBeInTheDocument();
      expect(screen.queryByText(reason)).toBeNull();
    });
  });

  it.each(["회의 시작", "재개"] as const)(
    "%s 라벨로 같은 시작 경로를 쓰고 44px 터치 영역을 둔다",
    (startLabel) => {
      recording.phase = "idle";
      recording.start.mockReset();

      render(
        <RecordingDock
          noteId="note-1"
          workspaceId={WORKSPACE_ID}
          startLabel={startLabel}
        />
      );

      const button = screen.getByRole("button", { name: startLabel });
      expect(button).toHaveClass("size-9");
      fireEvent.click(button);
      // 워크스페이스를 같이 넘긴다 — 계약이 노트에서 안 알려주므로 여기서 안 넘기면
      // 프로바이더가 "어느 워크스페이스를 녹음 중인지"를 영영 모른다.
      expect(recording.start).toHaveBeenCalledWith("note-1", WORKSPACE_ID);
    }
  );

  it("로컬 녹음의 단일 중지 버튼도 시작 버튼과 같은 지름을 쓴다", () => {
    recording.phase = "recording";

    render(<RecordingDock noteId="note-1" workspaceId={WORKSPACE_ID} />);

    expect(screen.getByRole("button", { name: "중지" })).toHaveClass("size-9");
  });

  it("실패 후 다시 시도도 44px 터치 영역을 둔다", () => {
    recording.phase = "failed";

    render(<RecordingDock noteId="note-1" workspaceId={WORKSPACE_ID} />);

    expect(screen.getByRole("button", { name: "다시 시도" })).toHaveClass(
      "h-9"
    );
  });

  it("다른 노트의 failed ACTIVE 세션이 있으면 시작 버튼을 잠근다", () => {
    recording.phase = "failed";

    render(<RecordingDock noteId="note-2" workspaceId={WORKSPACE_ID} />);

    expect(
      screen.getByRole("button", { name: "다른 노트에서 녹음 중" })
    ).toBeDisabled();
  });

  describe("실패 사유", () => {
    const reason = "실시간 전사 처리에 실패했습니다.";

    afterEach(() => {
      recording.error = null;
      recording.session = { noteId: "note-1", status: "ACTIVE" };
    });

    // 사유는 `RecordingErrorToast`(app/providers.tsx)가 토스트로 띄운다. 독까지 같은 문장을
    // 두면 두 곳에 나고, 마이크 권한 안내처럼 긴 문장이 오면 독이 화면 폭만큼 늘어난다.
    it("사유를 독에 다시 적지 않고 되돌릴 수단만 남긴다", () => {
      recording.phase = "failed";
      recording.error = reason;

      render(<RecordingDock noteId="note-1" workspaceId={WORKSPACE_ID} />);

      expect(screen.queryByText(reason)).toBeNull();
      expect(
        screen.getByRole("button", { name: "다시 시도" })
      ).toBeInTheDocument();
    });

    it("서버 세션이 열려 있으면 닫기를 숨긴다", () => {
      // disconnect()는 로컬만 지운다 — 서버에 READY/ACTIVE 세션이 남으면 회의
      // 종료·재시작이 계속 거절되므로 버리는 길을 열지 않는다.
      recording.phase = "failed";
      recording.error = reason;
      recording.session = { noteId: "note-1", status: "ACTIVE" };

      render(<RecordingDock noteId="note-1" workspaceId={WORKSPACE_ID} />);

      expect(screen.queryByRole("button", { name: "닫기" })).toBeNull();
    });

    it("세션이 종결된 뒤에는 닫기가 disconnect로 실패 상태를 정리한다", () => {
      recording.phase = "failed";
      recording.error = reason;
      recording.session = { noteId: "note-1", status: "INTERRUPTED" };

      render(<RecordingDock noteId="note-1" workspaceId={WORKSPACE_ID} />);
      fireEvent.click(screen.getByRole("button", { name: "닫기" }));

      expect(recording.disconnect).toHaveBeenCalledOnce();
    });

    it("사유가 없으면 문구 없이 다시 시도만 남는다", () => {
      recording.phase = "failed";
      recording.error = null;

      render(<RecordingDock noteId="note-1" workspaceId={WORKSPACE_ID} />);

      expect(screen.queryByRole("alert")).toBeNull();
      expect(
        screen.getByRole("button", { name: "다시 시도" })
      ).toBeInTheDocument();
    });
  });
});
