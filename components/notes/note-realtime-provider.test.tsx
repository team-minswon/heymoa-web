import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NoteRealtimeProvider,
  useNoteRealtime,
} from "@/components/notes/note-realtime-provider";
import {
  getGetNoteQueryKey,
  getGetNotesQueryKey,
} from "@/lib/api/generated/notes/notes";
import { getGetNoteTranscriptQueryKey } from "@/lib/api/generated/transcription/transcription";
import { getGetContextCandidatesQueryKey } from "@/lib/api/generated/context-candidates/context-candidates";

type TopicClientOptions = {
  noteId: string;
  onEvent: (event: Record<string, unknown>) => void;
  onCatchUp: () => void | Promise<void>;
};

const topicClients = vi.hoisted(
  () =>
    [] as Array<{
      options: TopicClientOptions;
      connect: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    }>
);

vi.mock("@/lib/notes/note-topic-client", () => ({
  getNoteTopicWebSocketUrl: () => "ws://localhost/ws/transcriptions",
  NoteTopicClient: class {
    readonly connect = vi.fn();
    readonly close = vi.fn().mockResolvedValue(undefined);

    constructor(readonly options: TopicClientOptions) {
      topicClients.push(this);
    }
  },
}));

const NOTE_ID = "01K0000000002";
const PROJECT_ID = "01K0000000001";
const SESSION_ID = "01K0000000010";
const UTTERANCE_ID = "01K0000000100";
const SEGMENT_ID = "01K0000000200";
const CANDIDATE_ID = "01K0000000300";
const EVENT_ID = "01K0000000400";

function candidateHead(over: Record<string, unknown> = {}) {
  return {
    candidateId: CANDIDATE_ID,
    revision: 1,
    operation: "CREATE",
    kind: "DECISION",
    status: "OPEN",
    closeReason: null,
    revisionSource: "LIVE",
    content: "경로 데이터 저장소는 MongoDB를 사용한다",
    createdSequence: 10,
    lastEvidenceSequence: 10,
    aiSemanticRevisionCount: 0,
    resolvesCandidateId: null,
    evidence: [
      {
        segmentId: SEGMENT_ID,
        sequence: 10,
        startedAtMs: 1_872_000,
        text: "그럼 MongoDB로 갑시다",
        role: "SUPPORTS",
      },
    ],
    ...over,
  };
}

function coverageRange(over: Record<string, unknown> = {}) {
  return {
    runKey: "0RDDJRN000001",
    applyStatus: "APPLIED",
    fromSequence: 1,
    toSequence: 10,
    fromStartedAtMs: 0,
    toEndedAtMs: 100_000,
    rawDeltaSaturated: false,
    semanticUnitSaturated: false,
    appliedAt: "2026-08-24T01:02:03.000Z",
    ...over,
  };
}

function Probe() {
  const realtime = useNoteRealtime();

  return (
    <>
      <div data-testid="partials">
        {JSON.stringify(realtime.transcript.partial)}
      </div>
      <div data-testid="finals">
        {JSON.stringify(realtime.transcript.finalSegments)}
      </div>
      <div data-testid="context-cards">
        {JSON.stringify(
          realtime.context.cards.map((card) => [
            card.candidateId,
            card.revision,
            card.status,
          ])
        )}
      </div>
      <div data-testid="context-batch-at">
        {String(realtime.context.state.lastBatchAt)}
      </div>
    </>
  );
}

/** 노트 조회 봉투. 소켓을 열지 말지는 이 안의 `meetingStatus` 가 정한다. */
function noteEnvelope(meetingStatus: string, noteId = NOTE_ID) {
  return {
    status: 200,
    headers: new Headers(),
    data: {
      success: true,
      error: null,
      data: {
        noteId,
        projectId: PROJECT_ID,
        title: "회의",
        meetingStatus,
      },
    },
  };
}

function renderProvider({
  strict = false,
  meetingStatus = "IN_PROGRESS",
}: {
  strict?: boolean;
  /** `null` 이면 캐시를 안 심는다 — 상태를 모르는 채 마운트되는 경우. */
  meetingStatus?: string | null;
} = {}) {
  const queryClient = new QueryClient({
    // 노트 조회는 화면이 서버에서 미리 받아 온 것을 쓴다. 여기서는 심어 두고 다시 안 받는다.
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (meetingStatus !== null) {
    queryClient.setQueryData(
      getGetNoteQueryKey(NOTE_ID),
      noteEnvelope(meetingStatus)
    );
  }
  const invalidateQueries = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue(undefined);
  const provider = (
    <QueryClientProvider client={queryClient}>
      <NoteRealtimeProvider noteId={NOTE_ID}>
        <Probe />
      </NoteRealtimeProvider>
    </QueryClientProvider>
  );
  const result = render(
    strict ? <StrictMode>{provider}</StrictMode> : provider
  );

  return { ...result, invalidateQueries, queryClient };
}

function emit(event: Record<string, unknown>, clientIndex = 0) {
  act(() => topicClients[clientIndex].options.onEvent(event));
}

function expectInvalidated(
  invalidateQueries: ReturnType<typeof vi.fn>,
  queryKey: readonly unknown[]
) {
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
}

function getProjectNotesPredicate(invalidateQueries: ReturnType<typeof vi.fn>) {
  const filters = invalidateQueries.mock.calls
    .map(([candidate]) => candidate)
    .find((candidate) => candidate && "predicate" in candidate);
  if (!filters?.predicate) {
    throw new Error("project note list invalidation was not called");
  }
  return filters.predicate;
}

beforeEach(() => {
  topicClients.length = 0;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("NoteRealtimeProvider", () => {
  it("partial은 utteranceId로 교체하고 final은 segmentId로 중복 제거한다", async () => {
    renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({
      type: "transcript.partial",
      transcriptionSessionId: SESSION_ID,
      utteranceId: UTTERANCE_ID,
      confirmedText: "",
      pendingText: "초안",
    });
    emit({
      type: "transcript.partial",
      transcriptionSessionId: SESSION_ID,
      utteranceId: UTTERANCE_ID,
      confirmedText: "수정된",
      pendingText: " 초안",
    });

    expect(
      JSON.parse(screen.getByTestId("partials").textContent ?? "null")
    ).toEqual(
      expect.objectContaining({
        utteranceId: UTTERANCE_ID,
        confirmedText: "수정된",
        pendingText: " 초안",
      })
    );

    const finalEvent = {
      type: "transcript.final",
      transcriptionSessionId: SESSION_ID,
      segmentId: SEGMENT_ID,
      utteranceId: UTTERANCE_ID,
      sequence: 1,
      text: "확정 문장",
      startedAtMs: 0,
      endedAtMs: 900,
    };
    emit(finalEvent);
    emit({ ...finalEvent, text: "확정 문장 교정본" });

    expect(screen.getByTestId("partials").textContent).toBe("null");
    expect(
      JSON.parse(screen.getByTestId("finals").textContent ?? "[]")
    ).toEqual([
      expect.objectContaining({
        segmentId: SEGMENT_ID,
        utteranceId: UTTERANCE_ID,
        text: "확정 문장 교정본",
      }),
    ]);
  });

  it("상태 이벤트는 exact note와 cached project lists를 즉시, 연속 final은 한 번 묶어 REST를 갱신한다", async () => {
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    vi.useFakeTimers();

    emit({
      type: "meeting.started",
      transcriptionSessionId: SESSION_ID,
    });
    expectInvalidated(invalidateQueries, getGetNoteQueryKey(NOTE_ID));
    expect(
      getProjectNotesPredicate(invalidateQueries)({
        queryKey: getGetNotesQueryKey(PROJECT_ID),
      } as never)
    ).toBe(true);
    invalidateQueries.mockClear();

    emit({
      type: "transcript.final",
      transcriptionSessionId: SESSION_ID,
      segmentId: SEGMENT_ID,
      utteranceId: UTTERANCE_ID,
      sequence: 1,
      text: "확정 문장",
      startedAtMs: 0,
      endedAtMs: 900,
    });
    expect(invalidateQueries).not.toHaveBeenCalled();
    emit({
      type: "transcript.final",
      transcriptionSessionId: SESSION_ID,
      segmentId: "01K0000000201",
      utteranceId: "01K0000000101",
      sequence: 2,
      text: "다음 확정 문장",
      startedAtMs: 1_000,
      endedAtMs: 1_900,
    });
    act(() => vi.advanceTimersByTime(499));
    expect(invalidateQueries).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expectInvalidated(invalidateQueries, getGetNoteTranscriptQueryKey(NOTE_ID));

    invalidateQueries.mockClear();
    emit({
      type: "recording.stopped",
      transcriptionSessionId: SESSION_ID,
    });
    expectInvalidated(invalidateQueries, getGetNoteQueryKey(NOTE_ID));
    expectInvalidated(invalidateQueries, getGetNoteTranscriptQueryKey(NOTE_ID));
    expect(
      getProjectNotesPredicate(invalidateQueries)({
        queryKey: getGetNotesQueryKey(PROJECT_ID),
      } as never)
    ).toBe(true);
  });

  it("late and order-reversed lifecycle events only invalidate and never overwrite authoritative cache state", async () => {
    const { invalidateQueries, queryClient } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    const noteKey = getGetNoteQueryKey(NOTE_ID);
    const endedNote = {
      status: 200,
      headers: new Headers(),
      data: {
        success: true,
        error: null,
        data: {
          noteId: NOTE_ID,
          projectId: PROJECT_ID,
          title: "종료된 회의",
          meetingStatus: "ENDED",
        },
      },
    };
    queryClient.setQueryData(noteKey, endedNote);
    const setQueryData = vi.spyOn(queryClient, "setQueryData");
    invalidateQueries.mockClear();

    emit({ type: "meeting.ended", meetingStatus: "ENDED" });
    emit({
      type: "recording.started",
      transcriptionSessionId: SESSION_ID,
      meetingStatus: "IN_PROGRESS",
    });

    // 구조 공유로 참조는 바뀔 수 있다. 덮어쓰지 않았다는 것은 아래 spy 가 지킨다.
    expect(queryClient.getQueryData(noteKey)).toEqual(endedNote);
    expect(setQueryData).not.toHaveBeenCalled();
    // meeting.ended 가 note·목록·transcript·후보를, recording.started 가 note·목록을 갱신한다.
    expect(invalidateQueries).toHaveBeenCalledTimes(6);
    expectInvalidated(invalidateQueries, noteKey);
    expectInvalidated(
      invalidateQueries,
      getGetContextCandidatesQueryKey(NOTE_ID)
    );
    expect(
      getProjectNotesPredicate(invalidateQueries)({
        queryKey: getGetNotesQueryKey(PROJECT_ID),
      } as never)
    ).toBe(true);
  });

  it("a stale stopped event from session A does not clear session B partials", async () => {
    renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    const newerSessionId = "01K0000000011";

    emit({
      type: "transcript.partial",
      transcriptionSessionId: newerSessionId,
      utteranceId: UTTERANCE_ID,
      confirmedText: "새 세션의 작성 중",
      pendingText: " 문장",
    });
    emit({
      type: "recording.stopped",
      transcriptionSessionId: SESSION_ID,
    });

    expect(
      JSON.parse(screen.getByTestId("partials").textContent ?? "null")
    ).toEqual(
      expect.objectContaining({
        transcriptionSessionId: newerSessionId,
        confirmedText: "새 세션의 작성 중",
        pendingText: " 문장",
      })
    );
  });

  it("다른 발화의 final이 와도 현재 partial을 비운다", async () => {
    // utteranceId는 최신성을 뜻하지 않는다 — 서버가 재연결 때 폐기한 commit의 이전 id를
    // 되살린다. id 일치로만 지우면 확정되지 못한 발화가 세션 끝까지 화면에 남는다.
    renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({
      type: "transcript.partial",
      transcriptionSessionId: SESSION_ID,
      utteranceId: UTTERANCE_ID,
      confirmedText: "확정되지 못한",
      pendingText: " 문장",
    });
    emit({
      type: "transcript.final",
      transcriptionSessionId: SESSION_ID,
      segmentId: SEGMENT_ID,
      utteranceId: "01K0000000999",
      sequence: 1,
      text: "다음 발화의 확정",
      startedAtMs: 0,
      endedAtMs: 900,
    });

    expect(screen.getByTestId("partials").textContent).toBe("null");
  });

  it("현재 세션이 중지되면 확정되지 않은 partial을 지운다", async () => {
    renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({
      type: "transcript.partial",
      transcriptionSessionId: SESSION_ID,
      utteranceId: UTTERANCE_ID,
      confirmedText: "중지 전에 남은",
      pendingText: " 초안",
    });
    emit({
      type: "recording.stopped",
      transcriptionSessionId: SESSION_ID,
    });

    expect(screen.getByTestId("partials").textContent).toBe("null");
  });

  it("회의가 종료되면 세션 순서와 무관하게 모든 partial을 지운다", async () => {
    renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({
      type: "transcript.partial",
      transcriptionSessionId: SESSION_ID,
      utteranceId: UTTERANCE_ID,
      confirmedText: "종료 전에 남은",
      pendingText: " 초안",
    });
    emit({ type: "meeting.ended" });

    expect(screen.getByTestId("partials").textContent).toBe("null");
  });

  it("재연결 catch-up에서 임시 payload를 버리고 note·transcript를 갱신한다", async () => {
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    await act(() => topicClients[0].options.onCatchUp());
    invalidateQueries.mockClear();
    emit({
      type: "transcript.partial",
      transcriptionSessionId: SESSION_ID,
      utteranceId: UTTERANCE_ID,
      confirmedText: "놓칠 수 있는",
      pendingText: " 초안",
    });
    await act(() => topicClients[0].options.onCatchUp());

    expect(screen.getByTestId("partials").textContent).toBe("null");
    expectInvalidated(invalidateQueries, getGetNoteQueryKey(NOTE_ID));
    expectInvalidated(invalidateQueries, getGetNoteTranscriptQueryKey(NOTE_ID));
    expect(
      getProjectNotesPredicate(invalidateQueries)({
        queryKey: getGetNotesQueryKey(PROJECT_ID),
      } as never)
    ).toBe(true);
    expectInvalidated(invalidateQueries, getGetNoteQueryKey(NOTE_ID));
  });

  it("후보 event가 화면 상태를 즉시 갱신하고 같은 후보를 두 번 만들지 않는다", async () => {
    renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({
      type: "context.candidate.changed",
      eventId: EVENT_ID,
      changeOrdinal: 0,
      occurredAt: "2026-08-24T01:02:03.000Z",
      candidate: candidateHead(),
    });
    emit({
      type: "context.candidate.changed",
      eventId: "01K0000000401",
      changeOrdinal: 0,
      occurredAt: "2026-08-24T01:02:10.000Z",
      candidate: candidateHead({ revision: 2, operation: "AMEND" }),
    });

    expect(screen.getByTestId("context-cards").textContent).toBe(
      JSON.stringify([[CANDIDATE_ID, 2, "OPEN"]])
    );
  });

  it("노트가 바뀌면 이전 노트의 후보·처리 상태를 즉시 비운다", async () => {
    // catch-up 의 reset 만 믿으면 WS 가 붙기 전까지(또는 못 붙으면 영영) A 의 원장이
    // B 에 그대로 보인다.
    const { rerender, queryClient } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({
      type: "context.candidate.changed",
      eventId: EVENT_ID,
      changeOrdinal: 0,
      occurredAt: "2026-08-24T01:02:03.000Z",
      candidate: candidateHead(),
    });
    expect(screen.getByTestId("context-cards").textContent).not.toBe(
      JSON.stringify([])
    );

    queryClient.setQueryData(
      getGetNoteQueryKey("01K0000000005"),
      noteEnvelope("IN_PROGRESS", "01K0000000005")
    );
    rerender(
      <QueryClientProvider client={queryClient}>
        <NoteRealtimeProvider noteId="01K0000000005">
          <Probe />
        </NoteRealtimeProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("context-cards").textContent).toBe(
      JSON.stringify([])
    );
  });

  it("배치 event는 서버 시각을 싣고 후보 조회를 무효화한다", async () => {
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    invalidateQueries.mockClear();

    emit({
      type: "context.classification.batch.applied",
      eventId: "01K0000000500",
      occurredAt: "2026-08-24T02:00:00.000Z",
      range: coverageRange({ appliedAt: "2026-08-24T02:00:00.000Z" }),
    });

    // REAFFIRM 은 candidate event 가 없어서 이 무효화로만 화면에 수렴한다.
    expectInvalidated(
      invalidateQueries,
      getGetContextCandidatesQueryKey(NOTE_ID)
    );
    // 갱신 띠 시각은 수신 시각이 아니라 서버가 준 값이다.
    expect(screen.getByTestId("context-batch-at").textContent).toBe(
      "2026-08-24T02:00:00.000Z"
    );
  });

  it("재연결 catch-up은 원장을 비우지 않고 조회만 다시 받는다", async () => {
    // 비우면 그 직후의 snapshot 재조회가 실패했을 때(캐시가 남아 isLoadingError도 거짓)
    // 다시 채울 경로가 없어 「정리된 사건이 없습니다」가 영구히 남는다. 원장은 낡은 것을
    // 되돌리지 않는 snapshot 병합으로 수렴시키고, catch-up이 버리는 것은 전사뿐이다.
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({
      type: "context.candidate.changed",
      eventId: EVENT_ID,
      changeOrdinal: 0,
      occurredAt: "2026-08-24T01:02:03.000Z",
      candidate: candidateHead(),
    });

    invalidateQueries.mockClear();
    await act(() => topicClients[0].options.onCatchUp());

    expect(screen.getByTestId("context-cards").textContent).toBe(
      JSON.stringify([[CANDIDATE_ID, 1, "OPEN"]])
    );
    expectInvalidated(
      invalidateQueries,
      getGetContextCandidatesQueryKey(NOTE_ID)
    );
  });

  /**
   * **revision gap 을 본 뒤 재조회가 실패하면 갇힙니다.**
   *
   * `needsRefetch` 는 sticky 이고 그것을 보는 effect 의 deps 가 안 바뀌어서, 한 번 실패하면
   * 다시 안 돕니다. 그 뒤 오는 candidate event 는 gap 을 못 메웁니다 — 빠진 revision 은
   * 다시 안 오기 때문입니다.
   *
   * **batch 는 이미 복구 경로가 있습니다** — `invalidateContext()` 가 조회를 다시 띄웁니다.
   * 그런데 candidate event 만 계속 오는 구간(배치가 멎은 회의)에서는 그 경로가 안 열립니다.
   * 여기서 그 한 갈래를 지킵니다.
   */
  it("gap 을 본 뒤에는 candidate event 가 재조회를 깨운다", async () => {
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    // 마운트 catch-up 이 이미 한 번 invalidate 한다. 그 뒤부터를 본다.
    invalidateQueries.mockClear();

    // revision 1 을 못 보고 2 가 왔다 — 사이를 놓쳤으므로 snapshot 을 다시 받아야 한다.
    emit({
      type: "context.candidate.changed",
      eventId: EVENT_ID,
      changeOrdinal: 0,
      occurredAt: "2026-08-24T01:02:03.000Z",
      candidate: candidateHead({ revision: 2 }),
    });
    expect(invalidateQueries).not.toHaveBeenCalled();

    // jsdom 에는 서버가 없어 그 재조회는 실패한다. 그 상태에서 다음 event 가 와야 한다.
    invalidateQueries.mockClear();
    emit({
      type: "context.candidate.changed",
      eventId: "01K0000000401",
      changeOrdinal: 0,
      occurredAt: "2026-08-24T01:02:10.000Z",
      candidate: candidateHead({ candidateId: "01K0000000301", revision: 1 }),
    });

    await waitFor(() =>
      expectInvalidated(
        invalidateQueries,
        getGetContextCandidatesQueryKey(NOTE_ID)
      )
    );
  });

  it("gap 이 없으면 candidate event 가 조회를 흔들지 않는다", async () => {
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    invalidateQueries.mockClear();

    // revision 1 부터 순서대로면 놓친 것이 없다 — 재조회할 이유가 없다.
    emit({
      type: "context.candidate.changed",
      eventId: EVENT_ID,
      changeOrdinal: 0,
      occurredAt: "2026-08-24T01:02:03.000Z",
      candidate: candidateHead({ revision: 1 }),
    });
    emit({
      type: "context.candidate.changed",
      eventId: "01K0000000402",
      changeOrdinal: 0,
      occurredAt: "2026-08-24T01:02:10.000Z",
      candidate: candidateHead({ candidateId: "01K0000000302", revision: 1 }),
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("StrictMode의 setup-cleanup-setup에서도 활성 연결을 하나만 남긴다", async () => {
    const view = renderProvider({ strict: true });

    await waitFor(() => expect(topicClients).toHaveLength(2));
    expect(topicClients[0].connect).toHaveBeenCalledOnce();
    expect(topicClients[0].close).toHaveBeenCalledOnce();
    expect(topicClients[1].connect).toHaveBeenCalledOnce();
    expect(topicClients[1].close).not.toHaveBeenCalled();

    view.unmount();

    expect(topicClients[1].close).toHaveBeenCalledOnce();
  });
});

/**
 * ★ **소켓은 아직 무언가 올 수 있는 노트에만 연다.**
 *
 * 이 토픽의 여덟 이벤트 중 끝난 회의에서 올 수 있는 것은 회의 직후 분석이 도는 동안의 후보·배치
 * 둘뿐이다. 지난 노트를 읽는 탭마다 연결이 하나씩 서 있었고, 2대에서 배포할 때 그 전부가
 * 재연결을 했다. 반대로 **시작 전 노트는 열어야 한다** — 동료가 녹음을 시작하면 그 소켓으로
 * `meeting.started` 가 온다.
 */
describe("소켓을 여는 조건", () => {
  it("끝난 노트에 들어오면 소켓을 안 연다", async () => {
    renderProvider({ meetingStatus: "ENDED" });
    await act(async () => {});
    expect(topicClients).toHaveLength(0);
  });

  it("시작 전 노트는 연다 — 동료가 시작하면 그 소켓으로 온다", async () => {
    renderProvider({ meetingStatus: "NOT_STARTED" });
    await waitFor(() => expect(topicClients).toHaveLength(1));
    expect(topicClients[0].connect).toHaveBeenCalledOnce();
  });

  it("열린 뒤 회의가 끝나도 나갈 때까지 유지한다 — 직후의 분석 배치를 놓치지 않게", async () => {
    const { queryClient } = renderProvider({ meetingStatus: "IN_PROGRESS" });
    await waitFor(() => expect(topicClients).toHaveLength(1));

    act(() => {
      queryClient.setQueryData(
        getGetNoteQueryKey(NOTE_ID),
        noteEnvelope("ENDED")
      );
    });
    await act(async () => {});

    expect(topicClients).toHaveLength(1);
    expect(topicClients[0].close).not.toHaveBeenCalled();
  });

  it("끝난 노트로 옮기면 이전 소켓을 닫고 새로 열지 않는다", async () => {
    const { rerender, queryClient } = renderProvider({
      meetingStatus: "IN_PROGRESS",
    });
    await waitFor(() => expect(topicClients).toHaveLength(1));

    queryClient.setQueryData(
      getGetNoteQueryKey("01K0000000005"),
      noteEnvelope("ENDED", "01K0000000005")
    );
    rerender(
      <QueryClientProvider client={queryClient}>
        <NoteRealtimeProvider noteId="01K0000000005">
          <Probe />
        </NoteRealtimeProvider>
      </QueryClientProvider>
    );
    await act(async () => {});

    expect(topicClients[0].close).toHaveBeenCalledOnce();
    expect(topicClients).toHaveLength(1);
  });

  it("상태를 모르는 동안은 안 열고, 알게 되면 연다", async () => {
    const { queryClient } = renderProvider({ meetingStatus: null });
    await act(async () => {});
    expect(topicClients).toHaveLength(0);

    act(() => {
      queryClient.setQueryData(
        getGetNoteQueryKey(NOTE_ID),
        noteEnvelope("IN_PROGRESS")
      );
    });
    await waitFor(() => expect(topicClients).toHaveLength(1));
  });
});
