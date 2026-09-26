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

/**
 * **종료 응답이 갱신된 노트다** (APP-685). 전에는 204 라 화면이 종료 뒤 상태를 스스로
 * 지어냈고, 녹음 길이를 브라우저의 `Date.now()` 로 계산했다.
 */
const ENDED_NOTE = {
  status: 200 as const,
  data: {
    success: true as const,
    data: {
      noteId: "01K0000000002",
      meetingStatus: "ENDED",
      meetingEndedAt: "2026-07-29T00:00:05.000Z",
      recordedDurationMs: 15_000,
      activeSessionStartedAt: null,
    },
  },
};

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
      options?.onSuccess?.(ENDED_NOTE)
    );
    const onEnded = vi.fn();
    renderDialog(onEnded);
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    await waitFor(() => expect(onEnded).toHaveBeenCalled());
  });

  it("종료가 접수되면 프로젝트 노트 목록도 즉시 갱신한다", async () => {
    state.endMock.mockImplementation((_vars, options) =>
      options?.onSuccess?.(ENDED_NOTE)
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
      options?.onSuccess?.(ENDED_NOTE)
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
      options?.onSuccess?.(ENDED_NOTE)
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

  /**
   * **지어내지 않고 서버가 준 것을 그대로 넣는다.** 전에는 `Date.now()` 로 마지막 구간을
   * 계산해 캐시에 썼다 — 시계가 서로 다른 두 사람이 같은 회의를 다른 길이로 봤다.
   */
  it("종료 응답의 노트를 그대로 캐시에 넣는다", async () => {
    state.endMock.mockImplementation((_vars, options) =>
      options?.onSuccess?.(ENDED_NOTE)
    );
    const { client } = renderDialog();
    const queryKey = ["note", "01K0000000002"];
    client.setQueryData(queryKey, {
      status: 200,
      data: {
        success: true,
        data: {
          noteId: "01K0000000002",
          meetingStatus: "PAUSED",
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
            data: { data: Record<string, unknown> };
          }
        ).data.data
      ).toMatchObject({
        meetingStatus: "ENDED",
        // 서버가 찍은 시각이다. 브라우저 시계가 아니다.
        meetingEndedAt: "2026-07-29T00:00:05.000Z",
        recordedDurationMs: 15_000,
        activeSessionStartedAt: null,
      })
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

  /**
   * **기록 중인 회의는 끝낼 수 없다** (APP-694). 예전에는 여기서 로컬 녹음을 먼저 끄고
   * 종료했다. 이제 서버가 409 로 거절하므로 대신 끄지 않고 판정을 서버에 맡긴다.
   */
  it("기록 중이어도 이 창의 녹음을 대신 끄지 않는다", () => {
    state.activeNoteId = "01K0000000002";
    state.phase = "recording";
    renderDialog(undefined, "IN_PROGRESS");

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));

    expect(state.stopMock).not.toHaveBeenCalled();
    expect(state.endMock).toHaveBeenCalledOnce();
  });

  it("기록 중이라 거절되면 이유를 알리고 노트를 다시 묻는다", async () => {
    state.toastError.mockReset();
    state.endMock.mockImplementation((_vars, options) =>
      options?.onError?.({
        success: false,
        data: null,
        error: {
          code: "MEETING_RECORDING",
          message: "기록 중인 회의는 중지한 뒤 종료할 수 있습니다.",
        },
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

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "기록 중인 회의는 중지한 뒤 종료할 수 있습니다."
    );
    expect(client.getQueryState(["note", "01K0000000002"])?.isInvalidated).toBe(
      true
    );
    expect(onEnded).not.toHaveBeenCalled();
    expect(state.toastError).not.toHaveBeenCalled();
  });

  it("PAUSED는 로컬 상태가 남아도 stop 없이 바로 종료한다", () => {
    state.activeNoteId = "01K0000000002";
    state.phase = "recording";
    renderDialog(undefined, "PAUSED");

    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));

    expect(state.stopMock).not.toHaveBeenCalled();
    expect(state.endMock).toHaveBeenCalledOnce();
  });

  /**
   * **409 는 지어내지 않고 다시 묻는다** (APP-685). 이미 끝난 회의라 응답에 노트가 없는데,
   * 그 자리에서 ENDED 를 써 넣으면 종료 시각·녹음 길이를 우리가 만들어 내게 된다. 이제
   * 서버가 그 값을 주므로 무효화하고 받아 오는 편이 짧고 정확하다.
   */
  it("다른 탭이 먼저 종료한 409면 노트를 다시 묻는다", async () => {
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
      client.getQueryState(["note", "01K0000000002"])?.isInvalidated
    ).toBe(true);
  });

  it("진행 중인 PAUSED 조회 취소가 끝난 뒤 ENDED를 캐시에 쓴다", async () => {
    state.endMock.mockImplementation((_vars, options) =>
      options?.onSuccess?.(ENDED_NOTE)
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
