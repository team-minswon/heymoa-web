import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NoteRealtimeProvider,
  useNoteRealtime,
} from "@/components/notes/note-realtime-provider";
import { getGetNoteSharedChatMessagesQueryKey } from "@/lib/api/generated/note-shared-chat/note-shared-chat";
import {
  getGetNoteQueryKey,
  getGetNotesQueryKey,
} from "@/lib/api/generated/notes/notes";
import { getGetNoteTranscriptQueryKey } from "@/lib/api/generated/transcription/transcription";

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
      <div data-testid="chat-text">{realtime.chat.text}</div>
      <div data-testid="chat-interrupted">
        {String(realtime.chat.interrupted)}
      </div>
    </>
  );
}

function renderProvider({ strict = false }: { strict?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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

describe("NoteRealtimeProvider", () => {
  beforeEach(() => {
    topicClients.length = 0;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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

  it("token은 즉시 이어 붙이고 message_end에서 공유 채팅 히스토리를 무효화한다", async () => {
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));

    emit({ type: "chat.token", delta: "회의 " });
    emit({ type: "chat.token", delta: "요약" });

    expect(screen.getByTestId("chat-text").textContent).toBe("회의 요약");
    expect(invalidateQueries).not.toHaveBeenCalled();

    emit({
      type: "chat.message_end",
      messageId: "01K0000000300",
      content: "회의 요약",
    });

    expectInvalidated(
      invalidateQueries,
      getGetNoteSharedChatMessagesQueryKey(NOTE_ID)
    );
  });

  it("message_end 없이 lock이 풀린 채 1초가 지나면 중단을 표시하고 히스토리를 다시 받는다", async () => {
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    vi.useFakeTimers();

    emit({
      type: "chat.lock",
      chatId: "01K0000000400",
      locked: true,
      lockedByUserId: "01K0000000500",
    });
    emit({ type: "chat.token", delta: "작성 중" });
    emit({
      type: "chat.lock",
      chatId: "01K0000000400",
      locked: false,
      lockedByUserId: null,
    });

    expect(screen.getByTestId("chat-interrupted").textContent).toBe("false");
    invalidateQueries.mockClear();
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByTestId("chat-interrupted").textContent).toBe("false");

    act(() => vi.advanceTimersByTime(1));

    expect(screen.getByTestId("chat-interrupted").textContent).toBe("true");
    expectInvalidated(
      invalidateQueries,
      getGetNoteSharedChatMessagesQueryKey(NOTE_ID)
    );
  });

  it("lock 해제 유예 안에 message_end가 오면 정상 종료로 처리한다", async () => {
    const { invalidateQueries } = renderProvider();
    await waitFor(() => expect(topicClients).toHaveLength(1));
    vi.useFakeTimers();

    emit({
      type: "chat.lock",
      chatId: "01K0000000400",
      locked: true,
      lockedByUserId: "01K0000000500",
    });
    emit({ type: "chat.token", delta: "완료된 답변" });
    emit({
      type: "chat.lock",
      chatId: "01K0000000400",
      locked: false,
      lockedByUserId: null,
    });
    emit({
      type: "chat.message_end",
      messageId: "01K0000000300",
      content: "완료된 답변",
    });
    invalidateQueries.mockClear();

    act(() => vi.advanceTimersByTime(1_000));

    expect(screen.getByTestId("chat-interrupted").textContent).toBe("false");
    expect(invalidateQueries).not.toHaveBeenCalled();
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

    expect(queryClient.getQueryData(noteKey)).toBe(endedNote);
    expect(setQueryData).not.toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledTimes(6);
    expectInvalidated(invalidateQueries, noteKey);
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

  it("재연결 catch-up에서 임시 payload를 버리고 note·transcript·chat을 모두 갱신한다", async () => {
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
    emit({ type: "chat.token", delta: "놓칠 수 있는 토큰" });

    await act(() => topicClients[0].options.onCatchUp());

    expect(screen.getByTestId("partials").textContent).toBe("null");
    expect(screen.getByTestId("chat-text").textContent).toBe("");
    expectInvalidated(invalidateQueries, getGetNoteQueryKey(NOTE_ID));
    expectInvalidated(invalidateQueries, getGetNoteTranscriptQueryKey(NOTE_ID));
    expect(
      getProjectNotesPredicate(invalidateQueries)({
        queryKey: getGetNotesQueryKey(PROJECT_ID),
      } as never)
    ).toBe(true);
    expectInvalidated(
      invalidateQueries,
      getGetNoteSharedChatMessagesQueryKey(NOTE_ID)
    );
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
