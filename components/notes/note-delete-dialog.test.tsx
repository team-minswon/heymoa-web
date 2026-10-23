import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { NoteDeleteDialog } from "@/components/notes/note-delete-dialog";
import { getGetAnalysisFlowQueryKey } from "@/lib/api/generated/analysis/analysis";
import type { MeetingAnalysisFlowResponseDataStatus } from "@/lib/api/generated/models";

const deleteNote = vi.hoisted(() => vi.fn());
const disconnect = vi.hoisted(() => vi.fn());
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({ disconnect }),
}));

vi.mock("@/lib/api/generated/notes/notes", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useDeleteNote: () => ({ mutateAsync: deleteNote, isPending: false }),
}));

/**
 * **queryClient 를 손으로 흉내 내지 않는다.** 예전에는 `setQueryData`·`removeQueries` 를
 * `vi.fn()` 으로 갈아끼우고 「무엇을 어떤 인자로 불렀나」를 단언했다. 그러면 구현을 그대로
 * 되읽는 거울이 되고, 실제로 목록 키가 둘로 늘었을 때 **초록인 채 지나갔다.**
 *
 * 진짜 캐시를 세우고 **그 안에 무엇이 남았는지**를 본다.
 */

const stream = vi.hoisted(() => ({ healthy: false }));
vi.mock("@/lib/events/health", () => ({
  useEventStreamHealthy: () => stream.healthy,
}));

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/toast", () => ({ toast: { success: toastSuccess } }));

const PROJECT_NOTES_KEY = ["/v1/projects/01K0000000001/notes"];
const WORKSPACE_NOTES_KEY = ["/v1/workspaces/01K0000000000/notes"];
const FLOW_PATH = "*/v1/notes/:noteId/analyses/flow";
let liveStatus: MeetingAnalysisFlowResponseDataStatus = "NOT_APPLICABLE";
const flowBody = (status: MeetingAnalysisFlowResponseDataStatus) => ({
  success: true,
  data: { noteId: "01K0000000002", status, regions: [] },
  error: null,
});
const server = setupServer(
  http.get(FLOW_PATH, () => HttpResponse.json(flowBody(liveStatus)))
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());

async function clickDelete() {
  const button = screen.getByRole("button", { name: "삭제" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

/** 두 목록에 같은 두 행을 세운다. 지운 뒤 **양쪽 다** 한 행만 남아야 한다. */
function listPayload() {
  return {
    status: 200,
    data: {
      success: true,
      data: {
        notes: [{ noteId: "01K0000000002" }, { noteId: "01K0000000009" }],
      },
    },
  };
}

function notesIn(client: QueryClient, key: readonly unknown[]) {
  const cached = client.getQueryData(key) as
    | { data?: { data?: { notes?: { noteId: string }[] } } }
    | undefined;
  return cached?.data?.data?.notes?.map((note) => note.noteId);
}

function renderDialog(
  onDeleted?: () => void,
  flowStatus: MeetingAnalysisFlowResponseDataStatus = "NOT_APPLICABLE"
) {
  liveStatus = flowStatus;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const flowKey = getGetAnalysisFlowQueryKey("01K0000000002");
  client.setQueryDefaults(flowKey, { staleTime: Infinity });
  client.setQueryData(flowKey, {
    status: 200,
    data: { success: true, data: { status: flowStatus }, error: null },
  });
  client.setQueryData(PROJECT_NOTES_KEY, listPayload());
  client.setQueryData(WORKSPACE_NOTES_KEY, listPayload());
  client.setQueryData(["/v1/notes/01K0000000002"], { status: 200 });
  client.setQueryData(
    ["/v1/notes/01K0000000002/transcript", { cursor: "01K0000000050" }],
    { status: 200 }
  );
  client.setQueryData(["/v1/notes/01K0000000009"], { status: 200 });
  client.setQueryData(["/v1/projects/01K0000000001/meeting-links"], {
    status: 200,
  });
  client.setQueryData(["/v1/projects/01K0000000099/meeting-links"], {
    status: 200,
  });
  render(
    <QueryClientProvider client={client}>
      <NoteDeleteDialog
        noteId="01K0000000002"
        projectId="01K0000000001"
        title="주간 제품 회의"
        open
        onOpenChange={() => {}}
        onDeleted={onDeleted}
      />
    </QueryClientProvider>
  );
  return client;
}

describe("NoteDeleteDialog", () => {
  afterEach(() => {
    cleanup();
    server.resetHandlers();
    deleteNote.mockReset();
    disconnect.mockReset();
    toastSuccess.mockReset();
  });

  it("무엇이 함께 사라지는지와 되돌릴 수 없음을 문구로 말한다", () => {
    renderDialog();

    expect(
      screen.getByRole("heading", { name: "회의록을 삭제할까요?" })
    ).toBeInTheDocument();
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(
      screen.getByText(/발언에 연결된 근거가 함께 삭제됩니다/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/삭제한 회의록은 되돌릴 수 없습니다/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "이 회의록만 물어본 에이전트 대화도 함께 삭제됩니다. 같은 프로젝트의 다른 회의록과 결정 사항, 할 일, 다른 자료도 함께 물어본 대화는 그대로 남습니다."
      )
    ).toBeInTheDocument();
  });

  it("204면 목록을 무효화하고 성공을 알린 뒤 호출자에게 넘긴다", async () => {
    deleteNote.mockResolvedValue({ status: 204 });
    const onDeleted = vi.fn();
    renderDialog(onDeleted);

    await clickDelete();

    await waitFor(() => {
      expect(deleteNote).toHaveBeenCalledWith({ noteId: "01K0000000002" });
      expect(disconnect).toHaveBeenCalledWith("01K0000000002");
      expect(toastSuccess).toHaveBeenCalledWith("회의를 삭제했습니다.");
      expect(onDeleted).toHaveBeenCalled();
    });
  });

  it("분석 진행 중에는 삭제를 비활성화하고 요청하지 않는다", () => {
    renderDialog(undefined, "ANALYZING");
    const button = screen.getByRole("button", { name: "삭제" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(deleteNote).not.toHaveBeenCalled();
    expect(
      screen.getByText("회의 분석이 끝나면 삭제할 수 있습니다.")
    ).toBeInTheDocument();
  });

  it("방금 조회한 실패 캐시가 있어도 열 때 서버의 분석 중 상태를 확인한다", async () => {
    server.use(
      http.get(FLOW_PATH, () => HttpResponse.json(flowBody("ANALYZING")))
    );
    renderDialog(undefined, "ANALYSIS_FAILED");
    expect(screen.getByRole("button", { name: "삭제" })).toBeDisabled();
    await screen.findByText("회의 분석이 끝나면 삭제할 수 있습니다.");
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(deleteNote).not.toHaveBeenCalled();
  });

  it("상태 조회 실패는 재시도를 표시하고 삭제 요청을 보내지 않는다", async () => {
    server.use(http.get(FLOW_PATH, () => HttpResponse.error()));
    renderDialog();
    await screen.findByText("분석 상태를 불러오지 못했습니다.");
    const button = screen.getByRole("button", { name: "삭제" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(deleteNote).not.toHaveBeenCalled();
  });

  it.each([
    "NOT_APPLICABLE",
    "DIARIZING",
    "NOT_REQUESTED",
    "REVIEWABLE",
    "CONFIRMED",
    "ANALYSIS_FAILED",
  ] as const)("%s 상태에서는 삭제 요청을 보낸다", async (status) => {
    deleteNote.mockResolvedValue({ status: 204 });
    renderDialog(undefined, status);
    await clickDelete();
    await waitFor(() => expect(deleteNote).toHaveBeenCalledOnce());
  });

  it("늦게 도착한 비활성 목록 조회가 삭제한 행을 되살리지 않는다", async () => {
    deleteNote.mockResolvedValue({ status: 204 });
    const onDeleted = vi.fn();
    const client = renderDialog(onDeleted);
    let release!: (value: ReturnType<typeof listPayload>) => void;
    const pending = client
      .fetchQuery({
        queryKey: PROJECT_NOTES_KEY,
        queryFn: () =>
          new Promise<ReturnType<typeof listPayload>>((resolve) => {
            release = resolve;
          }),
      })
      .catch(() => null);
    await clickDelete();
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    release(listPayload());
    await pending;
    expect(notesIn(client, PROJECT_NOTES_KEY)).toEqual(["01K0000000009"]);
  });

  it("열려 있는 연결 조회도 서버의 새 결과로 갱신한다", async () => {
    deleteNote.mockResolvedValue({ status: 204 });
    const onDeleted = vi.fn();
    const client = renderDialog(onDeleted);
    const linksKey = ["/v1/projects/01K0000000001/meeting-links"];
    const refreshed = { status: 200, data: { links: [] } };
    const observer = new QueryObserver(client, {
      queryKey: linksKey,
      queryFn: async () => refreshed,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await clickDelete();
      await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
      expect(observer.getCurrentResult().data).toEqual(refreshed);
    } finally {
      unsubscribe();
    }
  });

  it("그 노트를 키에 담은 캐시를 전부 버린다", async () => {
    // 단건만 지우면 전사·요약·공유 채팅이 각자 키로 살아남아 뒤로가기에서 되살아난다.
    deleteNote.mockResolvedValue({ status: 204 });
    const client = renderDialog();

    await clickDelete();

    await waitFor(() =>
      expect(client.getQueryData(["/v1/notes/01K0000000002"])).toBeUndefined()
    );
    // noteId 가 객체 안에 있는 키도 같이 사라져야 한다 — 최상위 문자열 검사로는 안 걸린다.
    expect(
      client.getQueryData([
        "/v1/notes/01K0000000002/transcript",
        { cursor: "01K0000000050" },
      ])
    ).toBeUndefined();
    // 남의 노트는 그대로다.
    expect(client.getQueryData(["/v1/notes/01K0000000009"])).toBeDefined();
    expect(
      client.getQueryData(["/v1/projects/01K0000000001/meeting-links"])
    ).toBeUndefined();
    expect(
      client.getQueryData(["/v1/projects/01K0000000099/meeting-links"])
    ).toBeDefined();
  });

  it("★ 목록 둘 다에서 행을 먼저 뺀다", async () => {
    // `invalidateQueries` 는 재조회가 실패해도 resolve 하고 옛 데이터를 남긴다. 그래서
    // 재검증 전에 행을 직접 뺀다 — **그리고 목록은 둘이다** (APP-685). 프로젝트 것만 빼면
    // 「모든 노트」 화면에 지운 회의가 그대로 서 있다.
    deleteNote.mockResolvedValue({ status: 204 });
    const client = renderDialog();

    await clickDelete();

    await waitFor(() =>
      expect(notesIn(client, PROJECT_NOTES_KEY)).toEqual(["01K0000000009"])
    );
    expect(notesIn(client, WORKSPACE_NOTES_KEY)).toEqual(["01K0000000009"]);
  });

  it("후처리가 끝날 때까지 버튼을 다시 열지 않는다", async () => {
    // isPending은 DELETE가 끝나면 바로 풀린다. 그때 다시 누르면 지운 노트로 또 나간다.
    deleteNote.mockResolvedValue({ status: 204 });
    renderDialog();
    const button = screen.getByRole("button", { name: "삭제" });

    await clickDelete();

    await waitFor(() => expect(deleteNote).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    expect(deleteNote).toHaveBeenCalledTimes(1);
  });

  it("실패는 삼키지 않고 거절을 소비한다", async () => {
    // catch가 없으면 unhandled rejection이 된다. 토스트는 MutationCache가 띄운다.
    deleteNote.mockRejectedValue(new Error("Network request failed"));
    const onDeleted = vi.fn();
    renderDialog(onDeleted);

    await clickDelete();

    await waitFor(() => expect(deleteNote).toHaveBeenCalled());
    expect(disconnect).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("204가 아니면 성공으로 다루지 않는다", async () => {
    // 실패 토스트는 MutationCache가 전역으로 띄운다 — 여기서 또 부르면 두 개가 겹친다.
    deleteNote.mockResolvedValue({ status: 409 });
    const onDeleted = vi.fn();
    renderDialog(onDeleted);

    await clickDelete();

    await waitFor(() => expect(deleteNote).toHaveBeenCalled());
    expect(disconnect).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

/**
 * 분석 흐름의 힌트 전환(PRO-67 I03). 분석 중(3초)인 흐름도 이벤트 스트림이 건강하면 폴링하지 않고(안전망 60초), 스트림이
 * 끊기면 지금 간격으로 돌아온다. 힌트가 오면 provider 가 같은 키를 무효화해 다시 읽는다(lib/events 표가 검증한다).
 */
describe("분석 흐름 폴링과 이벤트 스트림", () => {
  async function flowReadsWithin(ms: number) {
    let reads = 0;
    const count = () => {
      reads += 1;
    };
    server.events.on("request:start", count);
    renderDialog(undefined, "ANALYZING");
    await new Promise((resolve) => setTimeout(resolve, ms));
    server.events.removeListener("request:start", count);
    cleanup();
    return reads;
  }

  it("건강하면 3초 폴링을 하지 않고, 끊기면 원래 3초로 돈다", async () => {
    stream.healthy = true;
    expect(await flowReadsWithin(3_500)).toBe(1);
    stream.healthy = false;
    expect(await flowReadsWithin(3_500)).toBeGreaterThanOrEqual(2);
  }, 15_000);
});
