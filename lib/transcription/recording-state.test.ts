import { describe, expect, it } from "vitest";

import {
  initialRecordingState,
  recordingReducer,
  type RecordingAction,
  type RecordingSession,
  type RecordingState,
} from "@/lib/transcription/recording-state";

const session: RecordingSession = {
  sessionId: "0HZX2K7M9Q4AG",
  noteId: "0HZX2K7M9Q4AF",
  status: "ACTIVE",
  readyExpiresAt: "2099-07-15T00:01:00Z",
  startedAt: "2099-07-15T00:00:00Z",
  endedAt: null,
  endReason: null,
};

const run = (...actions: RecordingAction[]) =>
  actions.reduce<RecordingState>(recordingReducer, initialRecordingState);

const recording = (): RecordingAction[] => [
  {
    type: "started",
    noteId: session.noteId,
    workspaceId: "ws",
    session: null,
  },
  { type: "session", session },
  { type: "phase", phase: "recording" },
];

describe("recordingReducer", () => {
  it("새 녹음은 지난 회의의 알림·남은 소리·오류를 들고 오지 않는다", () => {
    const state = run(
      ...recording(),
      { type: "notice", notice: { cause: "disconnected", sinceMs: 1 } },
      {
        type: "buffer",
        buffer: {
          pendingMs: 3_000,
          limitMs: 300_000,
          paused: false,
          upload: null,
        },
      },
      { type: "degraded", shown: true },
      { type: "microphone", microphone: "muted" },
      { type: "tick", ms: 1_000 },
      { type: "window-exhausted", message: "멈췄다", droppedMs: 3_000 },
      { type: "started", noteId: "other", workspaceId: "ws", session: null }
    );

    expect(state).toEqual({
      ...initialRecordingState,
      activeNoteId: "other",
      activeWorkspaceId: "ws",
      phase: "requesting-permission",
    });
  });

  it("재개 창이 끝나면 버린 세션을 INTERRUPTED 로 들고 회의 종료 감시를 켠다", () => {
    const state = run(...recording(), {
      type: "window-exhausted",
      message: "멈췄다",
      droppedMs: 12_300,
    });

    expect(state).toMatchObject({
      phase: "failed",
      error: "멈췄다",
      windowExhausted: true,
      droppedMs: 12_300,
      session: { status: "INTERRUPTED" },
    });
  });

  it("다른 문구로 바뀌면 회의 종료 감시를 끈다", () => {
    const exhausted = run(...recording(), {
      type: "window-exhausted",
      message: "멈췄다",
      droppedMs: 0,
    });

    expect(
      recordingReducer(exhausted, { type: "error", message: "회의가 끝났다" })
        .windowExhausted
    ).toBe(false);
    expect(
      recordingReducer(exhausted, { type: "failed", message: "다른 실패" })
        .windowExhausted
    ).toBe(false);
  });

  it("실패는 노랑 알림과 받아쓰기 멈춤 표시를 걷는다", () => {
    const state = run(
      ...recording(),
      { type: "notice", notice: { cause: "no_receipt", sinceMs: 1 } },
      { type: "degraded", shown: true },
      { type: "failed", message: "끊겼다" }
    );

    expect(state.connectionNotice).toBeNull();
    expect(state.transcriptionDegraded).toBe(false);
  });

  it("바뀐 값이 없으면 같은 상태를 돌려준다", () => {
    const state = run(...recording());

    expect(recordingReducer(state, { type: "phase", phase: "recording" })).toBe(
      state
    );
    expect(
      recordingReducer(initialRecordingState, { type: "disconnected" })
    ).toBe(initialRecordingState);
  });
});
