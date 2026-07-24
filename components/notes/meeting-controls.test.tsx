import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MeetingControls } from "@/components/notes/meeting-controls";
import type { NoteResponseData } from "@/lib/api/generated/models";

const state = vi.hoisted(() => ({
  userId: "user-12345",
  recordingNoteId: null as string | null,
  recordingPhase: "idle" as string,
  pauseMock: vi.fn(),
  resumeMock: vi.fn(),
  stopMock: vi.fn(),
  disconnectMock: vi.fn(),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { userId: state.userId, name: "테스트 유저" } }),
}));
vi.mock("@/components/transcription/recording-provider", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/transcription/recording-provider")
  >("@/components/transcription/recording-provider");
  return {
    isNoteRecordingActive: actual.isNoteRecordingActive,
    isRecordingStoppable: actual.isRecordingStoppable,
    useRecording: () => ({
      activeNoteId: state.recordingNoteId,
      phase: state.recordingPhase,
      stop: state.stopMock,
      disconnect: state.disconnectMock,
      session: state.recordingNoteId
        ? { sessionId: "sess1", noteId: state.recordingNoteId, status: "ACTIVE" }
        : null,
    }),
  };
});
vi.mock("@/components/notes/meeting-end-dialog", () => ({
  MeetingEndDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="end-dialog" /> : null,
}));
vi.mock("@/lib/api/generated/meeting/meeting", () => ({
  usePauseMeeting: () => ({ mutate: state.pauseMock, isPending: false }),
  useResumeMeeting: () => ({ mutate: state.resumeMock, isPending: false }),
}));

function note(overrides: Partial<NoteResponseData>): NoteResponseData {
  return {
    noteId: "01K0000000002",
    title: "주간 회의",
    projectId: "01K0000000001",
    createdAt: "2026-07-24T00:00:00Z",
    updatedAt: "2026-07-24T00:00:00Z",
    meetingStatus: "IN_PROGRESS",
    meetingStartedBy: { userId: "user-12345", name: "테스트 유저" },
    ...overrides,
  } as NoteResponseData;
}

function renderControls(n: NoteResponseData) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MeetingControls note={n} />
    </QueryClientProvider>
  );
}

describe("MeetingControls", () => {
  beforeEach(() => {
    state.userId = "user-12345";
    state.recordingNoteId = null;
    state.recordingPhase = "idle";
    state.pauseMock.mockReset();
    state.resumeMock.mockReset();
    state.stopMock.mockReset();
    state.disconnectMock.mockReset();
  });
  afterEach(cleanup);

  it("시작자 · 진행 중이면 중지·회의 종료 버튼을 보인다", () => {
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));
    expect(screen.getByRole("button", { name: /중지/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /회의 종료/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /중지/ }));
    expect(state.pauseMock).toHaveBeenCalledWith(
      { noteId: "01K0000000002" },
      expect.anything()
    );
  });

  it("녹음 중이면 회의 중지를 비활성화한다 — 녹음 중지는 레코더 독이 맡는다(drift #7)", () => {
    state.recordingNoteId = "01K0000000002";
    state.recordingPhase = "recording";
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));
    // 상단바 회의 조작은 recording.stop()을 부르지 않는다 — 녹음 중지 버튼이 없다.
    expect(screen.queryByRole("button", { name: "녹음 중지" })).toBeNull();
    const pauseBtn = screen.getByRole("button", { name: "중지" });
    expect(pauseBtn).toHaveProperty("disabled", true);
    fireEvent.click(pauseBtn);
    expect(state.pauseMock).not.toHaveBeenCalled();
    expect(state.stopMock).not.toHaveBeenCalled();
  });

  it("연결 중(세션 생성 전)이면 중지를 막는다 — stop이 고아 세션을 남기므로", () => {
    // requesting-permission/connecting은 stoppable이 아니다(취소 안전하지 않음). 차단만 한다.
    state.recordingNoteId = "01K0000000002";
    state.recordingPhase = "connecting";
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));
    expect(screen.queryByRole("button", { name: "녹음 중지" })).toBeNull();
    expect(screen.getByRole("button", { name: "중지" })).toHaveProperty(
      "disabled",
      true
    );
  });

  it("녹음이 실패했지만 세션이 열려 있으면 중지를 막는다(서버 정리 대기)", () => {
    // phase=failed면 stop()이 no-op이고 클라이언트가 서버 세션을 끝낼 수 없다 — pause는 계약상
    // 409다. 세션이 폴링으로 정리될 때까지 중지를 비활성으로 둔다(항상 실패하는 액션 금지).
    state.recordingNoteId = "01K0000000002";
    state.recordingPhase = "failed";
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));
    expect(screen.queryByRole("button", { name: "녹음 중지" })).toBeNull();
    const pauseBtn = screen.getByRole("button", { name: "중지" });
    expect(pauseBtn).toHaveProperty("disabled", true);
    fireEvent.click(pauseBtn);
    expect(state.pauseMock).not.toHaveBeenCalled();
    expect(state.stopMock).not.toHaveBeenCalled();
  });

  it("시작자 · 중지 중이면 재개·회의 종료 버튼을 보인다", () => {
    renderControls(note({ meetingStatus: "PAUSED" }));
    expect(screen.getByRole("button", { name: /재개/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /재개/ }));
    expect(state.resumeMock).toHaveBeenCalled();
  });

  it("뷰어(시작자 아님)는 버튼 없이 상태와 시작자를 보인다", () => {
    state.userId = "user-other";
    renderControls(
      note({ meetingStartedBy: { userId: "user-12345", name: "김민수" } })
    );
    expect(screen.getByText("김민수님이 시작한 회의")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /회의 종료/ })).toBeNull();
  });

  it("종료된 회의는 종료됨 배지만 보인다", () => {
    renderControls(note({ meetingStatus: "ENDED" }));
    expect(screen.getByText("회의 종료됨")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("아직 시작 전(startedBy null)이면 아무것도 그리지 않는다", () => {
    const { container } = renderControls(note({ meetingStartedBy: null }));
    expect(container.textContent).toBe("");
  });

  it("회의 종료를 누르면 확인 다이얼로그를 연다", () => {
    renderControls(note({ meetingStatus: "IN_PROGRESS" }));
    fireEvent.click(screen.getByRole("button", { name: /회의 종료/ }));
    expect(screen.getByTestId("end-dialog")).toBeTruthy();
  });
});
