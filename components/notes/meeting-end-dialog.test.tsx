import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MeetingEndDialog } from "@/components/notes/meeting-end-dialog";

const state = vi.hoisted(() => ({
  activeNoteId: null as string | null,
  phase: "idle" as string,
  endMock: vi.fn(),
  stopMock: vi.fn(),
  disconnectMock: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: state.toastError } }));

vi.mock("@/components/transcription/recording-provider", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/transcription/recording-provider")
  >("@/components/transcription/recording-provider");
  return {
    isNoteRecordingActive: actual.isNoteRecordingActive,
    isRecordingStoppable: actual.isRecordingStoppable,
    isRecordingStarting: actual.isRecordingStarting,
    useRecording: () => ({
      activeNoteId: state.activeNoteId,
      phase: state.phase,
      stop: state.stopMock,
      disconnect: state.disconnectMock,
      session: state.activeNoteId
        ? { sessionId: "sess1", noteId: state.activeNoteId, status: "ACTIVE" }
        : null,
    }),
  };
});
vi.mock("@/lib/api/generated/analysis/analysis", () => ({
  useEndMeeting: () => ({ mutate: state.endMock, isPending: false }),
  getGetLatestAnalysisQueryKey: (noteId: string) => ["analysis", noteId],
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNoteQueryKey: (noteId: string) => ["note", noteId],
}));

function renderDialog(onEnded?: () => void) {
  const client = new QueryClient();
  const ui = (open: boolean) => (
    <QueryClientProvider client={client}>
      <MeetingEndDialog
        noteId="01K0000000002"
        open={open}
        onOpenChange={vi.fn()}
        onEnded={onEnded}
      />
    </QueryClientProvider>
  );
  const view = render(ui(true));
  return { ...view, reopen: () => view.rerender(ui(true)), close: () => view.rerender(ui(false)) };
}

describe("MeetingEndDialog", () => {
  beforeEach(() => {
    state.activeNoteId = null;
    state.phase = "idle";
    state.endMock.mockReset();
    state.stopMock.mockReset();
    state.disconnectMock.mockReset();
  });
  afterEach(cleanup);

  it("녹음 중이 아니면 회의 종료를 호출한다", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    expect(state.endMock).toHaveBeenCalledWith(
      { noteId: "01K0000000002" },
      expect.anything()
    );
  });

  it("종료가 접수되면 onEnded를 불러 요약 탭으로 넘긴다", () => {
    state.endMock.mockImplementation((_vars, options) => options?.onSuccess?.());
    const onEnded = vi.fn();
    renderDialog(onEnded);
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    expect(onEnded).toHaveBeenCalled();
  });

  it("녹음 중이면 종료 대신 녹음 중지를 준다", () => {
    state.activeNoteId = "01K0000000002";
    state.phase = "recording";
    renderDialog();
    expect(screen.getByText(/아직 녹음 중입니다/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "회의 종료" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "녹음 중지" }));
    expect(state.stopMock).toHaveBeenCalled();
    expect(state.endMock).not.toHaveBeenCalled();
  });

  it("녹음 연결 중이면 종료를 막는다 — 시작이 이어져 고아 세션을 만들지 않게", () => {
    state.activeNoteId = "01K0000000002";
    state.phase = "connecting";
    renderDialog();
    expect(screen.getByText(/녹음을 연결하는 중/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "회의 종료" })).toBeNull();
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    expect(screen.getByRole("button", { name: "연결 중…" })).toHaveProperty(
      "disabled",
      true
    );
    expect(state.endMock).not.toHaveBeenCalled();
  });

  it("서버가 활성 세션으로 막으면(로컬은 대기여도) 차단 상태로 바꾸고 다시 시도를 준다", () => {
    // 다른 탭·기기의 녹음이나 새로고침으로 로컬 상태를 잃어도 서버 409가 권위다.
    state.endMock.mockImplementation((_vars, options) =>
      options?.onError?.({
        success: false,
        data: null,
        error: { code: "ACTIVE_TRANSCRIPTION_SESSION", message: "녹음 중" },
      })
    );
    const { close, reopen } = renderDialog();
    // 처음엔 대기 → 회의 종료.
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    // 409 → 차단 안내 + 다시 시도. 전역 토스트는 끄고 인라인만.
    expect(screen.getByText(/녹음 세션이 아직 활성입니다/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
    expect(state.toastError).not.toHaveBeenCalled();

    // 닫았다 다시 열면 차단 상태를 접는다(그 사이 원격 녹음이 끝났을 수 있다).
    close();
    reopen();
    expect(screen.queryByText(/녹음 세션이 아직 활성입니다/)).toBeNull();
    expect(screen.getByRole("button", { name: "회의 종료" })).toBeTruthy();
  });
});
