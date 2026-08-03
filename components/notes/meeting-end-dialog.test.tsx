import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MeetingEndDialog } from "@/components/notes/meeting-end-dialog";

const state = vi.hoisted(() => ({
  activeNoteId: null as string | null,
  phase: "idle" as string,
  sessionStartedAt: null as string | null,
  endMock: vi.fn(),
  stopMock: vi.fn(),
  disconnectMock: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/ui/toast", () => ({ toast: { error: state.toastError } }));

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
        ? {
            sessionId: "sess1",
            noteId: state.activeNoteId,
            status: "ACTIVE",
            startedAt: state.sessionStartedAt,
          }
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

function renderDialog(
  onEnded?: () => void,
  meetingStatus: "IN_PROGRESS" | "PAUSED" = "PAUSED"
) {
  const client = new QueryClient();
  const ui = (open: boolean) => (
    <QueryClientProvider client={client}>
      <MeetingEndDialog
        noteId="01K0000000002"
        meetingStatus={meetingStatus}
        open={open}
        onOpenChange={vi.fn()}
        onEnded={onEnded}
      />
    </QueryClientProvider>
  );
  const view = render(ui(true));
  return {
    ...view,
    client,
    reopen: () => view.rerender(ui(true)),
    close: () => view.rerender(ui(false)),
  };
}

describe("MeetingEndDialog", () => {
  beforeEach(() => {
    state.activeNoteId = null;
    state.phase = "idle";
    state.sessionStartedAt = null;
    state.endMock.mockReset();
    state.stopMock.mockReset();
    state.disconnectMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("녹음 중이 아니면 회의 종료를 호출한다", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    expect(state.endMock).toHaveBeenCalledWith(
      { noteId: "01K0000000002" },
      expect.anything()
    );
  });

  it("종료가 접수되면 onEnded를 불러 요약 탭으로 넘긴다", async () => {
    state.endMock.mockImplementation((_vars, options) =>
      options?.onSuccess?.()
    );
    const onEnded = vi.fn();
    renderDialog(onEnded);
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    await waitFor(() => expect(onEnded).toHaveBeenCalled());
  });

  it("종료가 접수되면 프로젝트 노트 목록도 즉시 갱신한다", async () => {
    state.endMock.mockImplementation((_vars, options) =>
      options?.onSuccess?.()
    );
    const { client } = renderDialog();
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));

    await waitFor(() => {
      const predicate = invalidateQueries.mock.calls
        .map(([filters]) => filters?.predicate)
        .find(Boolean);
      expect(
        predicate?.({
          queryKey: ["/v1/projects/01K0000000001/notes"],
        } as never)
      ).toBe(true);
    });
  });

  // invalidate만 하면 재조회 응답이 올 때까지 캐시에 IN_PROGRESS가 남고, 그 틈에
  // 녹음 시작이 열린다 — 계약이 종료된 회의의 세션 생성을 안 막아 서버도 안 잡아 준다.
  it("종료 직후 캐시의 회의 상태를 ENDED로 먼저 적는다", async () => {
    state.endMock.mockImplementation((_vars, options) =>
      options?.onSuccess?.()
    );
    const { client } = renderDialog();
    client.setQueryData(["note", "01K0000000002"], {
      status: 200,
      data: {
        success: true,
        data: { noteId: "01K0000000002", meetingStatus: "IN_PROGRESS" },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));

    await waitFor(() => {
      const cached = client.getQueryData(["note", "01K0000000002"]) as {
        data: { data: { meetingStatus: string } };
      };
      expect(cached.data.data.meetingStatus).toBe("ENDED");
    });
  });

  it("종료 전에 시작된 노트 조회가 늦게 끝나도 ENDED를 되돌리지 않는다", async () => {
    state.endMock.mockImplementation((_vars, options) =>
      options?.onSuccess?.()
    );
    const { client } = renderDialog();
    const queryKey = ["note", "01K0000000002"];
    const inProgress = {
      status: 200,
      data: {
        success: true,
        data: { noteId: "01K0000000002", meetingStatus: "IN_PROGRESS" },
      },
    };
    client.setQueryData(queryKey, inProgress);
    let resolveGetNote!: (value: typeof inProgress) => void;
    const getNote = new Promise<typeof inProgress>((resolve) => {
      resolveGetNote = resolve;
    });
    const pendingGetNote = client.fetchQuery({
      queryKey,
      queryFn: () => getNote,
    });

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    await waitFor(() =>
      expect(
        (
          client.getQueryData(queryKey) as {
            data: { data: { meetingStatus: string } };
          }
        ).data.data.meetingStatus
      ).toBe("ENDED")
    );

    await act(async () => {
      resolveGetNote(inProgress);
      await pendingGetNote;
    });

    expect(
      (
        client.getQueryData(queryKey) as {
          data: { data: { meetingStatus: string } };
        }
      ).data.data.meetingStatus
    ).toBe("ENDED");
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
    expect(screen.getByText(/다른 탭·기기에서 기록 중입니다/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
    expect(state.toastError).not.toHaveBeenCalled();

    // 닫았다 다시 열면 차단 상태를 접는다(그 사이 원격 녹음이 끝났을 수 있다).
    close();
    reopen();
    expect(screen.queryByText(/다른 탭·기기에서 기록 중입니다/)).toBeNull();
    expect(screen.getByRole("button", { name: "회의 종료" })).toBeTruthy();
  });

  it("IN_PROGRESS 확인 한 번으로 stop 성공을 기다린 뒤 회의를 종료한다", async () => {
    state.activeNoteId = "01K0000000002";
    state.phase = "recording";
    let finishStop!: (result: boolean) => void;
    state.stopMock.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishStop = resolve;
      })
    );
    renderDialog(undefined, "IN_PROGRESS");

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));

    expect(state.stopMock).toHaveBeenCalledOnce();
    expect(state.endMock).not.toHaveBeenCalled();

    finishStop(true);

    await waitFor(() => expect(state.endMock).toHaveBeenCalledOnce());
  });

  it("직접 종료 낙관 상태에 마지막 활성 구간을 포함한다", async () => {
    state.activeNoteId = "01K0000000002";
    state.phase = "recording";
    state.stopMock.mockResolvedValue(true);
    state.endMock.mockImplementation((_vars, options) =>
      options?.onSuccess?.()
    );
    vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-07-29T00:00:05.000Z")
    );
    const { client } = renderDialog(undefined, "IN_PROGRESS");
    const queryKey = ["note", "01K0000000002"];
    client.setQueryData(queryKey, {
      status: 200,
      data: {
        success: true,
        data: {
          noteId: "01K0000000002",
          meetingStatus: "IN_PROGRESS",
          recordedDurationMs: 10_000,
          activeSessionStartedAt: "2026-07-29T00:00:00.000Z",
        },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));

    await waitFor(() =>
      expect(
        (
          client.getQueryData(queryKey) as {
            data: {
              data: {
                meetingStatus: string;
                recordedDurationMs: number;
                activeSessionStartedAt: string | null;
              };
            };
          }
        ).data.data
      ).toMatchObject({
        meetingStatus: "ENDED",
        recordedDurationMs: 15_000,
        activeSessionStartedAt: null,
      })
    );
  });

  it("READY 스냅샷이면 로컬 ACTIVE 시작 시각으로 마지막 구간을 보정한다", async () => {
    state.activeNoteId = "01K0000000002";
    state.phase = "recording";
    state.sessionStartedAt = "2026-07-29T00:00:00.000Z";
    state.stopMock.mockResolvedValue(true);
    state.endMock.mockImplementation((_vars, options) =>
      options?.onSuccess?.()
    );
    vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-07-29T00:00:05.000Z")
    );
    const { client } = renderDialog(undefined, "IN_PROGRESS");
    const queryKey = ["note", "01K0000000002"];
    client.setQueryData(queryKey, {
      status: 200,
      data: {
        success: true,
        data: {
          noteId: "01K0000000002",
          meetingStatus: "IN_PROGRESS",
          recordedDurationMs: 10_000,
          activeSessionStartedAt: null,
        },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));

    await waitFor(() =>
      expect(
        (
          client.getQueryData(queryKey) as {
            data: { data: { recordedDurationMs: number } };
          }
        ).data.data.recordedDurationMs
      ).toBe(15_000)
    );
  });

  it.each(["requesting-permission", "connecting"])(
    "%s 중에는 종료를 시작하지 않는다",
    (phase) => {
      state.activeNoteId = "01K0000000002";
      state.phase = phase;
      renderDialog(undefined, "IN_PROGRESS");

      // 라벨은 진행 중에도 「회의 종료」 그대로다 — 문구를 갈면 스피너가 도는 동안
      // 버튼 폭이 튄다. 막혔다는 사실은 `disabled`와 `aria-busy`가 말한다.
      const confirm = screen.getByRole("button", { name: "회의 종료" });
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveAttribute("aria-busy", "true");
      fireEvent.click(confirm);

      expect(state.stopMock).not.toHaveBeenCalled();
      expect(state.endMock).not.toHaveBeenCalled();
    }
  );

  it("IN_PROGRESS stop이 false면 회의를 종료하지 않고 이유를 남긴다", async () => {
    state.activeNoteId = "01K0000000002";
    state.phase = "recording";
    state.stopMock.mockResolvedValue(false);
    renderDialog(undefined, "IN_PROGRESS");

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));

    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "현재 기록을 안전하게 저장하지 못했습니다."
    );
    expect(state.endMock).not.toHaveBeenCalled();
  });

  it("failed ACTIVE는 죽은 로컬 controller 대신 서버 종료 판정으로 넘긴다", () => {
    state.activeNoteId = "01K0000000002";
    state.phase = "failed";
    renderDialog(undefined, "IN_PROGRESS");

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));

    expect(state.stopMock).not.toHaveBeenCalled();
    expect(state.endMock).toHaveBeenCalledOnce();
  });

  it("PAUSED는 로컬 상태가 남아도 stop 없이 바로 종료한다", () => {
    state.activeNoteId = "01K0000000002";
    state.phase = "recording";
    renderDialog(undefined, "PAUSED");

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));

    expect(state.stopMock).not.toHaveBeenCalled();
    expect(state.endMock).toHaveBeenCalledOnce();
  });

  it("다른 탭이 먼저 종료한 409도 ENDED로 수렴한다", async () => {
    state.endMock.mockImplementation((_vars, options) =>
      options?.onError?.({
        success: false,
        data: null,
        error: { code: "MEETING_ALREADY_ENDED", message: "이미 종료됨" },
      })
    );
    const onEnded = vi.fn();
    const { client } = renderDialog(onEnded);
    client.setQueryData(["note", "01K0000000002"], {
      status: 200,
      data: {
        success: true,
        data: { noteId: "01K0000000002", meetingStatus: "PAUSED" },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));

    await waitFor(() => expect(onEnded).toHaveBeenCalledOnce());
    expect(
      (
        client.getQueryData(["note", "01K0000000002"]) as {
          data: { data: { meetingStatus: string } };
        }
      ).data.data.meetingStatus
    ).toBe("ENDED");
  });

  it("진행 중인 PAUSED 조회 취소가 끝난 뒤 ENDED를 캐시에 쓴다", async () => {
    state.endMock.mockImplementation((_vars, options) =>
      options?.onSuccess?.()
    );
    const { client } = renderDialog();
    const queryKey = ["note", "01K0000000002"];
    client.setQueryData(queryKey, {
      status: 200,
      data: {
        success: true,
        data: { noteId: "01K0000000002", meetingStatus: "PAUSED" },
      },
    });
    let finishCancel!: () => void;
    vi.spyOn(client, "cancelQueries").mockReturnValue(
      new Promise<void>((resolve) => {
        finishCancel = resolve;
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));

    expect(
      (
        client.getQueryData(queryKey) as {
          data: { data: { meetingStatus: string } };
        }
      ).data.data.meetingStatus
    ).toBe("PAUSED");

    finishCancel();

    await waitFor(() =>
      expect(
        (
          client.getQueryData(queryKey) as {
            data: { data: { meetingStatus: string } };
          }
        ).data.data.meetingStatus
      ).toBe("ENDED")
    );
  });
});
