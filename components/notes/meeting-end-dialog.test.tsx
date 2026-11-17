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

import { intlWrapper } from "@/components/help/test-intl";
import { MeetingEndDialog } from "@/components/notes/meeting-end-dialog";
import { REQUEST_TIMEOUT_MS } from "@/lib/api/fetcher";
import type { Participant } from "@/components/notes/note-participants";

const participant = (id: string, name: string): Participant => ({
  participantId: id,
  userId: id,
  guestId: null,
  name,
  email: `${id}@heymoa.com`,
  image: null,
});
const TWO_PARTICIPANTS = [
  participant("p1", "김민수"),
  participant("p2", "한지원"),
];

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
  pending: false,
  realMutation: false,
  request: vi.fn(),
  requestOptions: undefined as unknown,
}));

vi.mock("@/lib/ui/toast", () => ({ toast: { error: state.toastError } }));

vi.mock("@/components/transcription/recording-provider", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/transcription/recording-provider")
  >("@/components/transcription/recording-provider");
  return {
    isNoteRecordingActive: actual.isNoteRecordingActive,
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
vi.mock("@/lib/api/generated/analysis/analysis", async () => {
  const { useMutation } = await vi.importActual<
    typeof import("@tanstack/react-query")
  >("@tanstack/react-query");
  return {
    useEndMeeting: (options?: { mutation?: object; request?: object }) => {
      state.requestOptions = options?.request;
      const mutation = useMutation({
        mutationFn: () => state.request(),
        ...options?.mutation,
      });
      return state.realMutation
        ? mutation
        : {
            mutate: (variables: unknown) =>
              state.endMock(variables, options?.mutation),
            isPending: state.pending,
          };
    },
    getGetLatestAnalysisQueryKey: (noteId: string) => ["analysis", noteId],
    getGetAnalysisFlowQueryKey: (noteId: string) => ["flow", noteId],
  };
});
vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNoteQueryKey: (noteId: string) => ["note", noteId],
}));

function renderDialog(
  onEnded?: () => void,
  meetingStatus: "IN_PROGRESS" | "PAUSED" = "PAUSED",
  onEditParticipants?: () => void,
  onOpenChange: (open: boolean) => void = vi.fn(),
  participants: Participant[] = TWO_PARTICIPANTS
) {
  const client = new QueryClient();
  const ui = (open: boolean) => (
    <QueryClientProvider client={client}>
      <MeetingEndDialog
        noteId="01K0000000002"
        meetingStatus={meetingStatus}
        participants={participants}
        open={open}
        onOpenChange={onOpenChange}
        onEnded={onEnded}
        onEditParticipants={onEditParticipants}
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
    state.pending = false;
    state.realMutation = false;
    state.request.mockReset();
    state.stopMock.mockReset();
    state.disconnectMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("종료 이벤트로 다이얼로그가 먼저 사라져도 HTTP 종료 응답 뒤 요약으로 이동한다", async () => {
    state.realMutation = true;
    let finish!: (value: typeof ENDED_NOTE) => void;
    state.request.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const onEnded = vi.fn();
    const view = renderDialog(onEnded);
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    await waitFor(() => expect(state.request).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => finish(ENDED_NOTE));
    await waitFor(() => expect(onEnded).toHaveBeenCalledOnce());
  });

  it("우측 상단 닫기(X) 버튼으로 닫힌다", () => {
    const onOpenChange = vi.fn();
    renderDialog(undefined, "PAUSED", undefined, onOpenChange);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Esc 로 닫힌다", () => {
    const onOpenChange = vi.fn();
    renderDialog(undefined, "PAUSED", undefined, onOpenChange);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("종료 요청 중에는 X 를 그리지 않고 취소를 잠가 Esc 로도 안 닫힌다", () => {
    state.pending = true;
    const onOpenChange = vi.fn();
    renderDialog(undefined, "PAUSED", undefined, onOpenChange);
    expect(screen.queryByRole("button", { name: "닫기" })).toBeNull();
    expect(
      (screen.getByRole("button", { name: "취소" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("종료 전에 참여자 수와 이름을 접근성 설명 안에 보인다", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    const description = document.getElementById(
      dialog.getAttribute("aria-describedby")!
    );
    expect(description?.textContent).toContain("참여자 2명");
    expect(description?.textContent).toContain("김민수");
    expect(description?.textContent).toContain("한지원");
    expect(description?.textContent).toContain("말한 사람이 모두 들어 있나요?");
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  });

  it("참여자가 1명 이하이면 화자 수를 못 알려 준다고 경고한다", () => {
    renderDialog(undefined, "PAUSED", undefined, undefined, [
      participant("p1", "김민수"),
    ]);
    const section = screen.getByRole("region", { name: "회의 참여자" });
    expect(section.textContent).toContain("참여자 1명");
    expect(section.textContent).toContain("말한 사람을 모두 같은 화자로 봅니다");
    expect(section.textContent).toContain("먼저 참여자를 지정해 주세요");
    expect(section.textContent).not.toContain("말한 사람이 모두 들어 있나요?");
  });

  it("영어 화면에서는 참여자 수를 복수형으로 세고 상태를 영어로 말한다", () => {
    const client = new QueryClient();
    const ui = (participants: Participant[]) => (
      <QueryClientProvider client={client}>
        <MeetingEndDialog
          noteId="01K0000000002"
          meetingStatus="PAUSED"
          participants={participants}
          open
          onOpenChange={vi.fn()}
          onEditParticipants={vi.fn()}
        />
      </QueryClientProvider>
    );
    const view = render(ui([participant("p1", "김민수")]), {
      wrapper: intlWrapper("en"),
    });
    expect(
      screen.getByRole("heading", { name: "End this meeting?" })
    ).toBeInTheDocument();
    const section = screen.getByRole("region", { name: "Meeting participants" });
    expect(section.textContent).toContain("1 participant");
    expect(section.textContent).toContain("treated as the same speaker");
    expect(screen.getByText("Recording status · Paused")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go to participants" })
    ).toBeInTheDocument();

    view.rerender(ui(TWO_PARTICIPANTS));
    expect(section.textContent).toContain("2 participants");
    expect(
      screen
        .getByRole("dialog")
        .textContent?.replace(/김민수|한지원|닫기/g, "")
    ).not.toMatch(/[가-힣]/);
  });

  it("참여자가 없으면 이름 목록 없이 경고만 보인다", () => {
    renderDialog(undefined, "PAUSED", undefined, undefined, []);
    const section = screen.getByRole("region", { name: "회의 참여자" });
    expect(section.textContent).toContain("참여자 0명");
    expect(section.textContent).toContain("화자 수를 정하지 않고 나눕니다");
    expect(section.querySelector("ul")).toBeNull();
  });

  it("참여자 지정하러 가기는 창을 닫고 정보 탭으로 보낸다", () => {
    const onEdit = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog(undefined, "PAUSED", onEdit, onOpenChange);
    fireEvent.click(
      screen.getByRole("button", { name: "참여자 지정하러 가기" })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onEdit).toHaveBeenCalled();
    expect(state.endMock).not.toHaveBeenCalled();
  });

  it("종료 요청 중에는 참여자 지정하러 가기를 막는다", () => {
    state.pending = true;
    renderDialog(undefined, "PAUSED", vi.fn());
    expect(
      (
        screen.getByRole("button", {
          name: "참여자 지정하러 가기",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
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

      const confirm = screen.getByRole("button", { name: "회의 종료" });
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveAttribute("aria-busy", "true");
      fireEvent.click(confirm);

      expect(state.stopMock).not.toHaveBeenCalled();
      expect(state.endMock).not.toHaveBeenCalled();
    }
  );

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
          message: "기록 중인 회의는 일시정지한 뒤 종료할 수 있습니다.",
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
      "기록 중인 회의는 일시정지한 뒤 종료할 수 있습니다."
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

  it("종료 요청에 사람을 기다리게 하는 호출의 시한을 넘긴다", () => {
    renderDialog();

    expect(state.requestOptions).toEqual({ timeoutMs: REQUEST_TIMEOUT_MS });
  });

  it("종료 요청이 시한 오류로 끝나면 알리고 다시 누를 수 있게 풀린다", async () => {
    state.realMutation = true;
    let fail!: (error: unknown) => void;
    state.request.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        })
    );
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "회의 종료" })).toBeDisabled()
    );

    await act(async () =>
      fail({
        success: false,
        data: null,
        error: { code: "REQUEST_TIMEOUT", message: "응답이 오지 않습니다." },
      })
    );

    await waitFor(() =>
      expect(state.toastError).toHaveBeenCalledWith("응답이 오지 않습니다.")
    );
    expect(screen.getByRole("button", { name: "회의 종료" })).toBeEnabled();
  });

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
    expect(client.getQueryState(["note", "01K0000000002"])?.isInvalidated).toBe(
      true
    );
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

it("회의 종료 시 이전 흐름 조회를 취소하고 상태를 무효화한 뒤 요약으로 이동한다", async () => {
  state.endMock.mockImplementation((_args, options) =>
    options.onSuccess(ENDED_NOTE)
  );
  const ended = vi.fn();
  const { client } = renderDialog(ended);
  const key = ["flow", "01K0000000002"];
  client.setQueryData(key, {
    status: 200,
    data: { success: true, data: { status: "NOT_REQUESTED" } },
  });
  const cancel = vi.spyOn(client, "cancelQueries");
  fireEvent.click(screen.getByRole("button", { name: "회의 종료" }));
  await waitFor(() => expect(ended).toHaveBeenCalled());
  expect(cancel).toHaveBeenCalledWith({ queryKey: key });
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
});
