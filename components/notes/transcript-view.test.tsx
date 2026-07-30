import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranscriptView } from "@/components/notes/transcript-view";
import type { SharedChatPhase } from "@/lib/notes/meeting-state";

const NOTE_ID = "01K0000000002";
const POLLED_SEGMENT = {
  segmentId: "01K0000000100",
  transcriptionSessionId: "01K0000000010",
  sequence: 1,
  text: "폴링 전 발화입니다.",
  startedAtMs: 0,
  endedAtMs: 900,
};
const NEW_POLLED_SEGMENT = {
  segmentId: "01K0000000101",
  transcriptionSessionId: "01K0000000010",
  sequence: 2,
  text: "폴링으로 도착한 발화입니다.",
  startedAtMs: 1_000,
  endedAtMs: 1_900,
};
const useRecording = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn() }));
const noteRealtime = vi.hoisted(() => ({
  transcript: {
    partial: null as { utteranceId: string; text: string } | null,
    finalSegments: [] as Array<Record<string, unknown>>,
  },
}));
const useGetNoteTranscript = vi.hoisted(() =>
  vi.fn<() => unknown>(() => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          segments: [
            {
              segmentId: "01K0000000012",
              transcriptionSessionId: "01K0000000010",
              sequence: 1,
              text: "첫 번째 결정사항입니다.",
              startedAtMs: 0,
              endedAtMs: 1_200,
            },
            {
              segmentId: "01K0000000013",
              transcriptionSessionId: "01K0000000010",
              sequence: 2,
              text: "두 번째 결정사항입니다.",
              startedAtMs: 1_300,
              endedAtMs: 2_400,
            },
            {
              segmentId: "01K0000000014",
              transcriptionSessionId: "01K0000000020",
              sequence: 1,
              text: "두 번째 녹음의 첫 문장입니다.",
              startedAtMs: 0,
              endedAtMs: 900,
            },
          ],
        },
      },
    },
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }))
);

vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => useRecording(),
  useRecordingTranscript: () => useRecording().transcript,
}));
vi.mock("@/components/notes/note-realtime-provider", () => ({
  useNoteRealtime: () => noteRealtime,
}));
vi.mock("@/lib/api/generated/transcription/transcription", () => ({
  getGetNoteTranscriptQueryKey: () => ["transcript"],
  useGetNoteTranscript,
}));
vi.mock("sonner", () => ({ toast }));

function recordingState(partialText = "결과를 정리합니다") {
  return {
    activeNoteId: NOTE_ID,
    session: {
      sessionId: "01K0000000030",
      noteId: NOTE_ID,
      status: "ACTIVE",
    },
    phase: "recording",
    elapsedMs: 3_200,
    error: null,
    transcript: {
      partial: { utteranceId: "01K0000000201", text: partialText },
      finalSegments: [
        {
          segmentId: "01K0000000011",
          utteranceId: "01K0000000200",
          type: "final",
          sequence: 2,
          text: "세 번째 녹음의 확정 문장입니다.",
          startedAtMs: 1_300,
          endedAtMs: 2_400,
        },
      ],
    },
  };
}

/** 회의가 안 도는 상태 — 종료된 회의의 전사를 다시 읽을 때가 이렇다. */
function idleState() {
  return {
    activeNoteId: null,
    session: null,
    phase: "idle",
    elapsedMs: 0,
    error: null,
    transcript: { partial: null, finalSegments: [] },
  };
}

function transcriptResult(segments: unknown[]) {
  return {
    data: { status: 200, data: { success: true, data: { segments } } },
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  };
}

function renderTranscript(phase: SharedChatPhase = "active") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <TranscriptView noteId={NOTE_ID} phase={phase} />
    </QueryClientProvider>
  );

  return {
    ...result,
    rerenderTranscript: () =>
      result.rerender(
        <QueryClientProvider client={client}>
          <TranscriptView noteId={NOTE_ID} phase={phase} />
        </QueryClientProvider>
      ),
  };
}

function deferAnimationFrames() {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    })
  );
  return () => frames.splice(0).forEach((frame) => frame(0));
}

function setScrollMetrics(
  viewport: HTMLElement,
  {
    scrollTop,
    scrollHeight = 1_000,
    clientHeight = 400,
  }: {
    scrollTop: number;
    scrollHeight?: number;
    clientHeight?: number;
  }
) {
  Object.defineProperties(viewport, {
    scrollTop: { configurable: true, writable: true, value: scrollTop },
    scrollHeight: { configurable: true, value: scrollHeight },
    clientHeight: { configurable: true, value: clientHeight },
  });
}

describe("TranscriptView", () => {
  const scrollTo = vi.fn();

  beforeEach(() => {
    toast.error.mockReset();
    noteRealtime.transcript.partial = null;
    noteRealtime.transcript.finalSegments = [];
    useRecording.mockReturnValue(recordingState());
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      })
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
  });

  it("keeps a low-frequency transcript safety poll while the server meeting is active", () => {
    useRecording.mockReturnValue(idleState());

    renderTranscript("active");

    expect(useGetNoteTranscript).toHaveBeenCalledWith(
      NOTE_ID,
      expect.objectContaining({
        query: expect.objectContaining({
          staleTime: 0,
          refetchInterval: 30_000,
        }),
      })
    );
  });

  it("does not poll the persisted transcript before the server meeting starts", () => {
    useRecording.mockReturnValue(idleState());

    renderTranscript("not-started");

    expect(useGetNoteTranscript).toHaveBeenCalledWith(
      NOTE_ID,
      expect.objectContaining({
        query: expect.objectContaining({
          refetchInterval: false,
        }),
      })
    );
  });

  it("lands on the latest transcript after an active viewer finishes loading", () => {
    const flushAnimationFrames = deferAnimationFrames();
    useRecording.mockReturnValue(idleState());
    useGetNoteTranscript.mockReturnValueOnce({
      data: undefined,
      isPending: true,
      isFetching: true,
      isError: false,
      refetch: vi.fn(),
    });
    scrollTo.mockClear();

    const { container, rerenderTranscript } = renderTranscript("active");
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    setScrollMetrics(viewport!, { scrollTop: 0, scrollHeight: 200 });
    flushAnimationFrames();
    expect(scrollTo).not.toHaveBeenCalled();

    setScrollMetrics(viewport!, { scrollTop: 0, scrollHeight: 1_000 });
    rerenderTranscript();
    flushAnimationFrames();

    expect(scrollTo).toHaveBeenCalledWith({
      top: 1_000,
      behavior: "auto",
    });
  });

  it("shows the waiting copy for an active server meeting with no transcript", () => {
    useRecording.mockReturnValue(idleState());
    useGetNoteTranscript.mockReturnValueOnce(transcriptResult([]));

    renderTranscript("active");

    expect(screen.getByText("첫 발화를 기다리고 있습니다")).toBeInTheDocument();
  });

  it("shows the waiting copy while local recording starts before the server phase catches up", () => {
    const recording = recordingState("");
    recording.transcript.finalSegments = [];
    useRecording.mockReturnValue(recording);
    useGetNoteTranscript.mockReturnValueOnce(transcriptResult([]));

    renderTranscript("not-started");

    expect(screen.getByText("첫 발화를 기다리고 있습니다")).toBeInTheDocument();
    expect(
      screen.queryByText(/기록을 시작하고 평소처럼 대화하세요/)
    ).toBeNull();
  });

  it.each(["unknown", "ended"] as const)(
    "shows neutral empty copy when the server phase is %s",
    (phase) => {
      useRecording.mockReturnValue(idleState());
      useGetNoteTranscript.mockReturnValueOnce(transcriptResult([]));

      renderTranscript(phase);

      expect(screen.getByText("전사된 대화가 없습니다.")).toBeInTheDocument();
      expect(
        screen.queryByText(/기록을 시작하고 평소처럼 대화하세요/)
      ).toBeNull();
    }
  );

  it("follows persisted segments added by polling while the active viewer stays near the bottom", () => {
    const flushAnimationFrames = deferAnimationFrames();
    useRecording.mockReturnValue(idleState());
    useGetNoteTranscript.mockReturnValueOnce(
      transcriptResult([POLLED_SEGMENT])
    );

    const { container, rerenderTranscript } = renderTranscript("active");
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    setScrollMetrics(viewport!, { scrollTop: 450 });
    flushAnimationFrames();
    fireEvent.scroll(viewport!);
    scrollTo.mockClear();
    useGetNoteTranscript.mockReturnValueOnce(
      transcriptResult([POLLED_SEGMENT, NEW_POLLED_SEGMENT])
    );

    rerenderTranscript();
    flushAnimationFrames();

    expect(screen.getByText(/폴링으로 도착한 발화입니다/)).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith({
      top: 1_000,
      behavior: "auto",
    });
  });

  it("does not follow persisted segments added by polling after the active viewer scrolls up", () => {
    const flushAnimationFrames = deferAnimationFrames();
    useRecording.mockReturnValue(idleState());
    useGetNoteTranscript.mockReturnValueOnce(
      transcriptResult([POLLED_SEGMENT])
    );

    const { container, rerenderTranscript } = renderTranscript("active");
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    setScrollMetrics(viewport!, { scrollTop: 100 });
    flushAnimationFrames();
    fireEvent.scroll(viewport!);
    scrollTo.mockClear();
    useGetNoteTranscript.mockReturnValueOnce(
      transcriptResult([POLLED_SEGMENT, NEW_POLLED_SEGMENT])
    );

    rerenderTranscript();
    flushAnimationFrames();

    expect(screen.getByText(/폴링으로 도착한 발화입니다/)).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("groups adjacent finals into presentation blocks and keeps the partial live", () => {
    renderTranscript();

    const blocks = screen.getAllByTestId("transcript-block");
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toHaveAttribute("data-segment-count", "2");
    expect(blocks[0]).toHaveTextContent(
      "첫 번째 결정사항입니다. 두 번째 결정사항입니다."
    );
    expect(blocks[1]).toHaveTextContent("두 번째 녹음의 첫 문장입니다.");
    expect(blocks[2]).toHaveTextContent("세 번째 녹음의 확정 문장입니다.");

    const partial = screen.getByText("결과를 정리합니다").closest("article");
    expect(partial).toHaveAttribute("data-state", "partial");
    expect(partial).toHaveTextContent("실시간 · 확정 전");

    // v5: 제품 면 대문자 키커·세리프 헤더 없음(FORM SPEC), 전사 행은 단일 값 grid.
    expect(screen.queryByText("Conversation")).toBeNull();
    expect(screen.queryByText("대화 기록")).toBeNull();
    expect(blocks[0]).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-[max-content_minmax(0,1fr)]"
    );
    expect(blocks[0].className).toContain("gap-5");
    expect(useGetNoteTranscript).toHaveBeenCalledWith(
      NOTE_ID,
      expect.objectContaining({
        query: expect.objectContaining({ refetchInterval: 30_000 }),
      })
    );
  });

  it("keeps the partial label on one line and wraps Korean text by words without changing the final column width", () => {
    useRecording.mockReturnValue(
      recordingState(
        "아주 긴 한국어 회의 문장이 남은 너비 안에서 어절을 기준으로 자연스럽게 줄바꿈됩니다"
      )
    );

    renderTranscript();

    const final = screen.getAllByTestId("transcript-block")[0];
    const partial = screen
      .getByText(/아주 긴 한국어 회의 문장/)
      .closest("article")!;
    const partialLabel = screen.getByText("실시간 · 확정 전");
    const partialBody = partial.querySelector("p");

    expect(final.firstElementChild).toHaveClass("sm:w-32");
    expect(partial.firstElementChild).toHaveClass("sm:w-32");
    expect(partial).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-[max-content_minmax(0,1fr)]"
    );
    expect(partialLabel).toHaveClass("whitespace-nowrap", "shrink-0");
    expect(partialBody).toHaveClass(
      "min-w-0",
      "whitespace-normal",
      "break-keep"
    );
    expect(partialBody).not.toHaveClass("truncate", "break-all");
    const horizontalPadding = (element: Element) =>
      [...element.classList].filter((name) => /^(px|pl|pr)-/.test(name));
    expect(horizontalPadding(partial)).toEqual(horizontalPadding(final));
  });

  it("dedupes recorder and note-topic partials by utteranceId and hides a finalized partial", () => {
    noteRealtime.transcript.partial = {
      utteranceId: "01K0000000201",
      text: "결과를 정리합니다",
    };
    noteRealtime.transcript.finalSegments = [
      {
        type: "transcript.final",
        segmentId: "01K0000000099",
        transcriptionSessionId: "01K0000000030",
        utteranceId: "01K0000000201",
        sequence: 3,
        text: "확정됐습니다.",
        startedAtMs: 2_500,
        endedAtMs: 3_200,
      },
    ];

    renderTranscript();

    expect(screen.queryByText("결과를 정리합니다")).toBeNull();
    expect(screen.getByText("확정됐습니다.")).toBeInTheDocument();
  });

  it("내가 녹음자면 토픽이 아니라 내 소켓의 발화를 그린다", () => {
    // 두 소스는 같은 서버 이벤트에서 갈라지고 토픽이 메아리다. 토픽이 지연·재연결되는
    // 동안 이미 지나간 발화를 그리지 않도록 녹음자는 자기 소켓만 본다.
    useRecording.mockReturnValue({
      ...recordingState(),
      transcript: {
        partial: { utteranceId: "01K0000000301", text: "지금 말하는 문장" },
        finalSegments: [],
      },
    });
    noteRealtime.transcript.partial = {
      utteranceId: "01K0000000300",
      text: "토픽에 남은 이전 문장",
    };

    renderTranscript();

    expect(screen.getByText("지금 말하는 문장")).toBeInTheDocument();
    expect(screen.queryByText("토픽에 남은 이전 문장")).toBeNull();
    // 예전에는 두 소스의 partial을 map에 모아 join(" ")했다. 확정되지 못한 발화가
    // 그렇게 남아 회의 내내 앞에 붙었다 — 이어 붙는 형태 자체가 없어야 한다.
    expect(
      screen.queryByText(/토픽에 남은 이전 문장\s+지금 말하는 문장/)
    ).toBeNull();
  });

  it("중지 drain 동안에도 내 소켓의 partial을 그린다", () => {
    // 중지 요청 뒤에도 같은 소켓이 마지막 final을 drain한다. 그 구간에 토픽으로 넘기면
    // 토픽이 재연결·catch-up으로 비어 있을 때 화면이 빈다.
    useRecording.mockReturnValue({
      ...recordingState(),
      phase: "stopping",
      transcript: {
        partial: { utteranceId: "01K0000000401", text: "마지막 문장" },
        finalSegments: [],
      },
    });
    noteRealtime.transcript.partial = null;

    renderTranscript();

    expect(screen.getByText("마지막 문장")).toBeInTheDocument();
  });

  it("내 녹음이 끝난 뒤에는 다른 탭의 토픽 발화를 그린다", () => {
    // 녹음이 끝나도 activeNoteId는 disconnect 전까지 남는다. 그것만 보고 내 소켓을
    // 고르면, 다른 탭·기기가 회의를 재개했을 때 비어 있는 내 소켓이 토픽을 가린다.
    useRecording.mockReturnValue({
      ...recordingState(),
      phase: "completed",
      transcript: { partial: null, finalSegments: [] },
    });
    noteRealtime.transcript.partial = {
      utteranceId: "01K0000000400",
      text: "다른 탭에서 말하는 중",
    };

    renderTranscript();

    expect(screen.getByText("다른 탭에서 말하는 중")).toBeInTheDocument();
  });

  it("exposes sequential transcript additions as an accessible log", () => {
    renderTranscript();

    expect(screen.getByRole("log", { name: "회의 전사" })).toBeInTheDocument();
  });

  it("reserves floating dock clearance only at desktop widths", () => {
    renderTranscript();

    const content = screen.getByRole("log", {
      name: "회의 전사",
    }).parentElement;

    expect(content).toHaveClass("pb-7", "sm:pb-9", "lg:pb-28");
    expect(content).not.toHaveClass("pb-28");
  });

  it("does not expose the pending transcript skeleton as a live log", () => {
    useGetNoteTranscript.mockReturnValueOnce({
      data: undefined,
      isPending: true,
      isFetching: true,
      isError: false,
      refetch: vi.fn(),
    });

    renderTranscript();

    expect(screen.queryByRole("log", { name: "회의 전사" })).toBeNull();
  });

  it("shows a retryable toast instead of inserting a transcript error into the page", async () => {
    const refetch = vi.fn();
    useGetNoteTranscript.mockReturnValueOnce({
      data: undefined,
      isPending: false,
      isFetching: false,
      isError: true,
      refetch,
    });

    renderTranscript();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "대화 기록을 불러오지 못했습니다.",
        expect.objectContaining({
          id: `transcript-load-${NOTE_ID}`,
          action: expect.objectContaining({ label: "다시 시도" }),
        })
      )
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const options = toast.error.mock.calls[0][1];
    options.action.onClick();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("continues following new live text while the reader stays near the bottom", () => {
    const { container, rerenderTranscript } = renderTranscript();
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    expect(viewport).not.toBeNull();
    setScrollMetrics(viewport!, { scrollTop: 450 });
    fireEvent.scroll(viewport!);
    scrollTo.mockClear();

    useRecording.mockReturnValue(
      recordingState("결과를 정리하고 다음 안건으로 넘어갑니다")
    );
    rerenderTranscript();

    expect(scrollTo).toHaveBeenCalledWith({
      top: 1_000,
      behavior: "auto",
    });
    expect(
      screen.queryByRole("button", { name: "맨 아래로" })
    ).not.toBeInTheDocument();
  });

  it("offers the way back even when no meeting is running", () => {
    // 종료된 회의의 전사를 위로 올려 읽는 경우다. 예전에는 표시 조건이 라이브에
    // 묶여 있어서 바닥으로 돌아갈 방법이 없었다(APP-239).
    useRecording.mockReturnValue(idleState());
    const { container } = renderTranscript();
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    setScrollMetrics(viewport!, { scrollTop: 100 });
    fireEvent.scroll(viewport!);

    const button = screen.getByRole("button", { name: "맨 아래로" });
    const overlay = button.parentElement;

    expect(button).toBeInTheDocument();
    expect(overlay).toHaveClass("bottom-4", "lg:bottom-20");
    expect(overlay).not.toHaveClass("bottom-20");
  });

  it("pauses follow after the reader scrolls away and resumes from the latest button", () => {
    const { container, rerenderTranscript } = renderTranscript();
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    expect(viewport).not.toBeNull();
    setScrollMetrics(viewport!, { scrollTop: 100 });
    fireEvent.scroll(viewport!);
    expect(
      screen.getByRole("button", { name: "맨 아래로" })
    ).toBeInTheDocument();
    scrollTo.mockClear();

    useRecording.mockReturnValue(recordingState("새로운 발화가 도착했습니다"));
    rerenderTranscript();
    expect(scrollTo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "맨 아래로" }));
    expect(scrollTo).toHaveBeenCalledWith({
      top: 1_000,
      behavior: "smooth",
    });
    expect(
      screen.queryByRole("button", { name: "맨 아래로" })
    ).not.toBeInTheDocument();
  });
});
