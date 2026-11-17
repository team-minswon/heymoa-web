import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NoteRealtimeProvider,
  useNoteRealtime,
} from "@/components/notes/note-realtime-provider";
import {
  getGetNoteAgendasQueryKey,
  getGetNoteQueryKey,
  getGetNotesQueryKey,
  getGetWorkspaceNotesQueryKey,
} from "@/lib/api/generated/notes/notes";
import { getGetNoteTranscriptQueryKey } from "@/lib/api/generated/transcription/transcription";
import { getGetProposalsQueryKey } from "@/lib/api/generated/proposals/proposals";

type TopicClientOptions = {
  noteId: string;
  onEvent: (event: Record<string, unknown>) => void;
  onCatchUp: () => void | Promise<void>;
  onReconnectingChange?: (reconnecting: boolean) => void;
  onSubscriptionRejected: (rejection: {
    type: "subscription.rejected";
    noteId: string;
    reason:
      | "NOT_MEMBER"
      | "ALREADY_SUBSCRIBED"
      | "TOO_MANY_SUBSCRIBERS"
      | "UNAVAILABLE";
  }) => void;
};

const topicClients = vi.hoisted(
  () =>
    [] as Array<{
      options: TopicClientOptions;
      connect: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      retrySubscription: ReturnType<typeof vi.fn>;
    }>
);

vi.mock("@/lib/notes/note-topic-client", () => ({
  NoteTopicClient: class {
    readonly connect = vi.fn();
    readonly close = vi.fn().mockResolvedValue(undefined);
    readonly retrySubscription = vi.fn();

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

function proposalHead(over: Record<string, unknown> = {}) {
  return {
    proposalId: CANDIDATE_ID,
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
    resolvesProposalId: null,
    citations: [
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
    runId: "0RDDJRN000001",
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

const seenCards: unknown[] = [];

function Probe() {
  const realtime = useNoteRealtime();
  seenCards.push(realtime.context.cards);

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
            card.proposalId,
            card.revision,
            card.status,
          ])
        )}
      </div>
      <div data-testid="context-batch-at">
        {String(realtime.context.state.lastBatchAt)}
      </div>
      <div data-testid="subscription-issue">
        {realtime.subscriptionIssue ?? "connected"}
      </div>
      <div data-testid="reconnecting">{String(realtime.reconnecting)}</div>
    </>
  );
}

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
  onNotMember,
}: {
  strict?: boolean;
  meetingStatus?: string | null;
  onNotMember?: () => void;
} = {}) {
  const queryClient = new QueryClient({
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
      <NoteRealtimeProvider noteId={NOTE_ID} onNotMember={onNotMember}>
        <Probe />
      </NoteRealtimeProvider>
    </QueryClientProvider>
  );
  const result = render(provider, { reactStrictMode: strict });

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
    .map(([proposal]) => proposal)
    .find((proposal) => proposal && "predicate" in proposal);
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
  vi.restoreAllMocks();
});

describe("NoteRealtimeProvider", () => {
  it("구독 거절 사유에 따라 목록 이동, 연결 오류, 재시도를 가른다", async () => {
    const onNotMember = vi.fn();
    renderProvider({ onNotMember });
    await waitFor(() => expect(topicClients).toHaveLength(1));
    const reject = topicClients[0].options.onSubscriptionRejected;

    act(() =>
      reject({
        type: "subscription.rejected",
        noteId: NOTE_ID,
        reason: "ALREADY_SUBSCRIBED",
      })
    );
    expect(screen.getByTestId("subscription-issue")).toHaveTextContent(
      "ALREADY_SUBSCRIBED"
    );

    vi.useFakeTimers();
    act(() =>
      reject({
        type: "subscription.rejected",
        noteId: NOTE_ID,
        reason: "TOO_MANY_SUBSCRIBERS",
      })
    );
    expect(screen.getByTestId("subscription-issue")).toHaveTextContent(
      "TOO_MANY_SUBSCRIBERS"
    );
    act(() => vi.advanceTimersByTime(5_000));
    expect(topicClients[0].retrySubscription).toHaveBeenCalledOnce();

    act(() =>
      reject({
        type: "subscription.rejected",
        noteId: NOTE_ID,
        reason: "NOT_MEMBER",
      })
    );
    expect(onNotMember).toHaveBeenCalledOnce();
  });

  it("UNAVAILABLE 은 목록으로 돌려보내지 않고 백오프로 다시 구독한다", async () => {
    const onNotMember = vi.fn();
    renderProvider({ onNotMember });
    await waitFor(() => expect(topicClients).toHaveLength(1));

    vi.useFakeTimers();
    act(() =>
      topicClients[0].options.onSubscriptionRejected({
        type: "subscription.rejected",
        noteId: NOTE_ID,
        reason: "UNAVAILABLE",
      })
    );
    expect(screen.getByTestId("subscription-issue")).toHaveTextContent(
      "UNAVAILABLE"
    );
    act(() => vi.advanceTimersByTime(5_000));
    expect(topicClients[0].retrySubscription).toHaveBeenCalledOnce();
    expect(onNotMember).not.toHaveBeenCalled();
  });

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

  it("안건 정본이 바뀌었다는 신호를 받으면 안건만 다시 읽는다", async () => {
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    invalidateQueries.mockClear();

    emit({ type: "agendas.changed", occurredAt: "2026-10-12T05:00:00.000Z" });

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expectInvalidated(invalidateQueries, getGetNoteAgendasQueryKey(NOTE_ID));
  });

  it("상태 이벤트는 exact note와 cached project lists를 즉시 갱신하고, final은 번호가 건너뛸 때만 전사를 다시 받는다", async () => {
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
    act(() => vi.advanceTimersByTime(1_000));
    expect(invalidateQueries).not.toHaveBeenCalled();

    emit({
      type: "transcript.final",
      transcriptionSessionId: SESSION_ID,
      segmentId: "01K0000000203",
      utteranceId: "01K0000000103",
      sequence: 4,
      text: "3번을 건너뛴 문장",
      startedAtMs: 3_000,
      endedAtMs: 3_900,
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

  it("구독 뒤 첫 final 도 REST 가 가진 마지막 번호와 비교해, 그 사이가 빠졌으면 전사를 다시 받는다", async () => {
    const { invalidateQueries, queryClient } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    queryClient.setQueryData(getGetNoteTranscriptQueryKey(NOTE_ID), {
      status: 200,
      headers: new Headers(),
      data: {
        success: true,
        error: null,
        data: {
          segments: [
            { segmentId: "01K0000000205", sequence: 5, text: "저장된 문장" },
          ],
        },
      },
    } as never);
    vi.useFakeTimers();
    invalidateQueries.mockClear();

    emit({
      type: "transcript.final",
      transcriptionSessionId: SESSION_ID,
      segmentId: "01K0000000207",
      utteranceId: "01K0000000107",
      sequence: 7,
      text: "6번을 건너뛴 문장",
      startedAtMs: 7_000,
      endedAtMs: 7_900,
    });
    act(() => vi.advanceTimersByTime(500));
    expectInvalidated(invalidateQueries, getGetNoteTranscriptQueryKey(NOTE_ID));
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

    expect(queryClient.getQueryData(noteKey)).toEqual(endedNote);
    expect(setQueryData).not.toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledTimes(7);
    expectInvalidated(invalidateQueries, noteKey);
    expectInvalidated(invalidateQueries, getGetProposalsQueryKey(NOTE_ID));
    expectInvalidated(invalidateQueries, getGetNoteAgendasQueryKey(NOTE_ID));
    expect(
      getProjectNotesPredicate(invalidateQueries)({
        queryKey: getGetNotesQueryKey(PROJECT_ID),
      } as never)
    ).toBe(true);
  });

  it("회의 이벤트는 상태를 즉시 갱신하고 누락된 시작자·종료 시각은 REST로 수렴시킨다", async () => {
    const { invalidateQueries, queryClient } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    const listEnvelope = {
      status: 200,
      headers: new Headers(),
      data: {
        success: true,
        error: null,
        data: {
          notes: [
            {
              noteId: "01K0000000004",
              meetingStatus: "NOT_STARTED",
              meetingStartedAt: null,
              recordedDurationMs: 0,
              activeSessionStartedAt: null,
              createdAt: "2026-08-18T09:30:00.000Z",
            },
            {
              noteId: NOTE_ID,
              meetingStatus: "NOT_STARTED",
              meetingStartedAt: null,
              recordedDurationMs: 0,
              activeSessionStartedAt: null,
              createdAt: "2026-08-18T09:00:00.000Z",
            },
          ],
        },
      },
    };
    const projectKey = getGetNotesQueryKey(PROJECT_ID);
    const workspaceKey = getGetWorkspaceNotesQueryKey("01K0000000009");
    queryClient.setQueryData(projectKey, listEnvelope);
    queryClient.setQueryData(workspaceKey, listEnvelope);
    invalidateQueries.mockClear();

    emit({
      type: "meeting.started",
      meetingStatus: "IN_PROGRESS",
      meetingStartedAt: "2026-08-18T10:00:00.000Z",
      recordedDurationMs: 15_000,
      activeSessionStartedAt: "2026-08-18T10:00:00.000Z",
    });

    expect(
      queryClient.getQueryData<ReturnType<typeof noteEnvelope>>(
        getGetNoteQueryKey(NOTE_ID)
      )?.data.data
    ).toMatchObject({
      meetingStatus: "IN_PROGRESS",
      recordedDurationMs: 15_000,
    });
    for (const key of [projectKey, workspaceKey]) {
      expect(
        queryClient.getQueryData<typeof listEnvelope>(key)?.data.data.notes[0]
      ).toMatchObject({
        noteId: NOTE_ID,
        meetingStatus: "IN_PROGRESS",
        recordedDurationMs: 15_000,
      });
    }
    expectInvalidated(invalidateQueries, getGetNoteQueryKey(NOTE_ID));
    expect(
      getProjectNotesPredicate(invalidateQueries)({
        queryKey: projectKey,
      } as never)
    ).toBe(true);
    expect(
      getProjectNotesPredicate(invalidateQueries)({
        queryKey: workspaceKey,
      } as never)
    ).toBe(true);
    invalidateQueries.mockClear();

    emit({
      type: "meeting.ended",
      meetingStatus: "ENDED",
      meetingStartedAt: "2026-08-18T10:00:00.000Z",
      recordedDurationMs: 30_000,
      activeSessionStartedAt: null,
    });
    expectInvalidated(invalidateQueries, getGetNoteQueryKey(NOTE_ID));
    expect(
      getProjectNotesPredicate(invalidateQueries)({
        queryKey: projectKey,
      } as never)
    ).toBe(true);
    invalidateQueries.mockClear();
    emit({
      type: "recording.started",
      transcriptionSessionId: SESSION_ID,
      meetingStatus: "IN_PROGRESS",
      meetingStartedAt: "2026-08-18T10:00:00.000Z",
      recordedDurationMs: 15_000,
      activeSessionStartedAt: "2026-08-18T10:00:00.000Z",
    });
    expect(
      queryClient.getQueryData<ReturnType<typeof noteEnvelope>>(
        getGetNoteQueryKey(NOTE_ID)
      )?.data.data.meetingStatus
    ).toBe("ENDED");
    expect(invalidateQueries).not.toHaveBeenCalled();
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

  it("현재 세션이 일시정지되면 확정되지 않은 partial을 지운다", async () => {
    renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({
      type: "transcript.partial",
      transcriptionSessionId: SESSION_ID,
      utteranceId: UTTERANCE_ID,
      confirmedText: "일시정지 전에 남은",
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
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

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
    act(() => vi.advanceTimersByTime(0));

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

  it("전사 조각이 와도 후보 카드 배열은 그대로다", async () => {
    renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    emit({
      type: "proposal.changed",
      occurredAt: "2026-08-24T01:02:03.000Z",
      proposal: proposalHead(),
    });
    const before = seenCards.at(-1);

    emit({
      type: "transcript.partial",
      transcriptionSessionId: SESSION_ID,
      utteranceId: UTTERANCE_ID,
      confirmedText: "",
      pendingText: "초안",
    });

    await waitFor(() =>
      expect(screen.getByTestId("partials").textContent).toContain("초안")
    );
    expect(seenCards.at(-1)).toBe(before);
  });

  it("후보 event가 화면 상태를 즉시 갱신하고 같은 후보를 두 번 만들지 않는다", async () => {
    renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({
      type: "proposal.changed",
      occurredAt: "2026-08-24T01:02:03.000Z",
      proposal: proposalHead(),
    });
    emit({
      type: "proposal.changed",
      occurredAt: "2026-08-24T01:02:10.000Z",
      proposal: proposalHead({ revision: 2, operation: "AMEND" }),
    });

    expect(screen.getByTestId("context-cards").textContent).toBe(
      JSON.stringify([[CANDIDATE_ID, 2, "OPEN"]])
    );
  });

  it("노트가 바뀌면 이전 노트의 후보·처리 상태를 즉시 비운다", async () => {
    const { rerender, queryClient } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({
      type: "proposal.changed",
      occurredAt: "2026-08-24T01:02:03.000Z",
      proposal: proposalHead(),
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
      type: "transcript-analysis-run.applied",
      occurredAt: "2026-08-24T02:00:00.000Z",
      range: coverageRange({ appliedAt: "2026-08-24T02:00:00.000Z" }),
    });

    expectInvalidated(invalidateQueries, getGetProposalsQueryKey(NOTE_ID));
    expect(screen.getByTestId("context-batch-at").textContent).toBe(
      "2026-08-24T02:00:00.000Z"
    );
  });

  it("catch-up 은 이벤트로 받은 확정 발화를 비우지 않는다", async () => {
    renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({
      type: "transcript.final",
      transcriptionSessionId: SESSION_ID,
      segmentId: SEGMENT_ID,
      utteranceId: UTTERANCE_ID,
      sequence: 1,
      text: "남아야 할 문장",
      startedAtMs: 0,
      endedAtMs: 900,
    });
    await act(() => topicClients[0].options.onCatchUp());

    expect(
      JSON.parse(screen.getByTestId("finals").textContent ?? "[]")
    ).toEqual([expect.objectContaining({ segmentId: SEGMENT_ID })]);
  });

  it("catch-up 은 저장본이 이미 가진 확정 발화만 덜어 낸다", async () => {
    const { queryClient } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    for (const sequence of [5, 6]) {
      emit({
        type: "transcript.final",
        transcriptionSessionId: SESSION_ID,
        segmentId: `01K000000020${sequence}`,
        utteranceId: `01K000000010${sequence}`,
        sequence,
        text: `문장 ${sequence}`,
        startedAtMs: sequence * 1_000,
        endedAtMs: sequence * 1_000 + 900,
      });
    }
    queryClient.setQueryData(getGetNoteTranscriptQueryKey(NOTE_ID), {
      status: 200,
      headers: new Headers(),
      data: {
        success: true,
        error: null,
        data: {
          segments: [
            { segmentId: "01K0000000205", sequence: 5, text: "문장 5" },
          ],
        },
      },
    } as never);

    await act(() => topicClients[0].options.onCatchUp());

    expect(
      JSON.parse(screen.getByTestId("finals").textContent ?? "[]")
    ).toEqual([expect.objectContaining({ sequence: 6 })]);
  });

  it("전사 조회가 실패해 있으면 다음 final 에 다시 받는다", async () => {
    const { invalidateQueries, queryClient } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    const key = getGetNoteTranscriptQueryKey(NOTE_ID);
    await queryClient
      .fetchQuery({
        queryKey: key,
        queryFn: () => Promise.reject(new Error("503")),
        retry: false,
      })
      .catch(() => undefined);
    vi.useFakeTimers();
    invalidateQueries.mockClear();

    emit({
      type: "transcript.final",
      transcriptionSessionId: SESSION_ID,
      segmentId: SEGMENT_ID,
      utteranceId: UTTERANCE_ID,
      sequence: 1,
      text: "회복 계기",
      startedAtMs: 0,
      endedAtMs: 900,
    });
    act(() => vi.advanceTimersByTime(500));
    expectInvalidated(invalidateQueries, key);
  });

  it("재연결 catch-up은 원장을 비우지 않고 조회만 다시 받는다", async () => {
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({
      type: "proposal.changed",
      occurredAt: "2026-08-24T01:02:03.000Z",
      proposal: proposalHead(),
    });

    invalidateQueries.mockClear();
    await act(() => topicClients[0].options.onCatchUp());

    expect(screen.getByTestId("context-cards").textContent).toBe(
      JSON.stringify([[CANDIDATE_ID, 1, "OPEN"]])
    );
    expectInvalidated(invalidateQueries, getGetProposalsQueryKey(NOTE_ID));
  });

  it("gap 을 본 뒤에는 proposal event 가 재조회를 깨운다", async () => {
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    invalidateQueries.mockClear();

    emit({
      type: "proposal.changed",
      occurredAt: "2026-08-24T01:02:03.000Z",
      proposal: proposalHead({ revision: 2 }),
    });
    expect(invalidateQueries).not.toHaveBeenCalled();

    invalidateQueries.mockClear();
    emit({
      type: "proposal.changed",
      occurredAt: "2026-08-24T01:02:10.000Z",
      proposal: proposalHead({ proposalId: "01K0000000301", revision: 1 }),
    });

    await waitFor(() =>
      expectInvalidated(invalidateQueries, getGetProposalsQueryKey(NOTE_ID))
    );
  });

  it("gap 이 없으면 proposal event 가 조회를 흔들지 않는다", async () => {
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    invalidateQueries.mockClear();

    emit({
      type: "proposal.changed",
      occurredAt: "2026-08-24T01:02:03.000Z",
      proposal: proposalHead({ revision: 1 }),
    });
    emit({
      type: "proposal.changed",
      occurredAt: "2026-08-24T01:02:10.000Z",
      proposal: proposalHead({ proposalId: "01K0000000302", revision: 1 }),
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  describe("재연결 뒤 따라잡기는 흩어 한 번", () => {
    const transcriptKey = getGetNoteTranscriptQueryKey(NOTE_ID);
    const calls = (
      invalidateQueries: ReturnType<typeof vi.fn>,
      queryKey: readonly unknown[]
    ) =>
      invalidateQueries.mock.calls.filter(
        ([filters]) =>
          JSON.stringify(filters?.queryKey) === JSON.stringify(queryKey)
      ).length;

    async function reconnected(random: number) {
      const rendered = renderProvider();
      await waitFor(() => expect(topicClients).toHaveLength(1));
      vi.useFakeTimers();
      vi.spyOn(Math, "random").mockReturnValue(random);
      await act(() => topicClients[0].options.onCatchUp());
      rendered.invalidateQueries.mockClear();
      await act(() => topicClients[0].options.onCatchUp());
      return rendered;
    }

    it("★ 재연결 catch-up 은 난수 지연(0~3초) 뒤에 GET 셋을 한 번씩 낸다", async () => {
      const { invalidateQueries } = await reconnected(0.5);

      act(() => vi.advanceTimersByTime(1_499));
      expect(invalidateQueries).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(calls(invalidateQueries, getGetNoteQueryKey(NOTE_ID))).toBe(1);
      expect(calls(invalidateQueries, transcriptKey)).toBe(1);
      expect(calls(invalidateQueries, getGetProposalsQueryKey(NOTE_ID))).toBe(
        1
      );
    });

    it("★ 기다리는 사이 번호가 건너뛴 final 이 와도 전사는 한 번만 받는다", async () => {
      const { invalidateQueries, queryClient } = await reconnected(0.999);
      queryClient.setQueryData(transcriptKey, {
        status: 200,
        headers: new Headers(),
        data: {
          success: true,
          error: null,
          data: {
            segments: [
              { segmentId: "01K0000000205", sequence: 5, text: "저장된 문장" },
            ],
          },
        },
      } as never);

      emit({
        type: "transcript.final",
        transcriptionSessionId: SESSION_ID,
        segmentId: "01K0000000209",
        utteranceId: "01K0000000109",
        sequence: 9,
        text: "틈 뒤의 문장",
        startedAtMs: 9_000,
        endedAtMs: 9_900,
      });
      act(() => vi.advanceTimersByTime(3_000));
      expect(calls(invalidateQueries, transcriptKey)).toBe(1);
      expect(calls(invalidateQueries, getGetNoteQueryKey(NOTE_ID))).toBe(1);
      expect(calls(invalidateQueries, getGetProposalsQueryKey(NOTE_ID))).toBe(
        1
      );
    });

    it("★ 기다리는 사이 녹음이 멈춰도 전사는 한 번, 제안도 받는다", async () => {
      const { invalidateQueries } = await reconnected(0.5);

      emit({ type: "recording.stopped", transcriptionSessionId: SESSION_ID });
      act(() => vi.advanceTimersByTime(3_000));
      expect(calls(invalidateQueries, transcriptKey)).toBe(1);
      expect(calls(invalidateQueries, getGetProposalsQueryKey(NOTE_ID))).toBe(
        1
      );
    });

    it("★ 기다리는 사이 회의가 끝나도 전사·제안은 한 번씩이다", async () => {
      const { invalidateQueries } = await reconnected(0.5);

      emit({ type: "meeting.ended", meetingStatus: "ENDED" });
      act(() => vi.advanceTimersByTime(3_000));
      expect(calls(invalidateQueries, transcriptKey)).toBe(1);
      expect(calls(invalidateQueries, getGetProposalsQueryKey(NOTE_ID))).toBe(
        1
      );
    });

    it("짧게 두 번 다시 붙어도 따라잡기는 한 번이다", async () => {
      const { invalidateQueries } = await reconnected(0.5);
      await act(() => topicClients[0].options.onCatchUp());
      act(() => vi.advanceTimersByTime(3_000));
      expect(calls(invalidateQueries, transcriptKey)).toBe(1);
    });
  });

  it("★ 30초 넘게 못 붙었다는 신호를 화면 상태로 올리고, 붙으면 내린다", async () => {
    renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    expect(screen.getByTestId("reconnecting").textContent).toBe("false");

    act(() => topicClients[0].options.onReconnectingChange?.(true));
    expect(screen.getByTestId("reconnecting").textContent).toBe("true");
    act(() => topicClients[0].options.onReconnectingChange?.(false));
    expect(screen.getByTestId("reconnecting").textContent).toBe("false");
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
