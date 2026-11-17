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
import type { MeetingPhase } from "@/lib/notes/meeting-state";

const NOTE_ID = "01K0000000002";
const POLLED_SEGMENT = {
  segmentId: "01K0000000100",
  sequence: 1,
  text: "폴링 전 발화입니다.",
  startedAtMs: 0,
  endedAtMs: 900,
};
const NEW_POLLED_SEGMENT = {
  segmentId: "01K0000000101",
  sequence: 2,
  text: "폴링으로 도착한 발화입니다.",
  startedAtMs: 1_000,
  endedAtMs: 1_900,
};
const THIRD_SEGMENT = {
  segmentId: "01K0000000102",
  sequence: 3,
  text: "세 번째로 도착한 발화입니다.",
  startedAtMs: 2_000,
  endedAtMs: 2_900,
};
function livePartial(utteranceId: string, text: string) {
  const words = text.split(" ");
  return words.length > 1
    ? {
        utteranceId,
        confirmedText: words.slice(0, -1).join(" "),
        pendingText: ` ${words.at(-1)}`,
      }
    : { utteranceId, confirmedText: "", pendingText: text };
}

function partialRow() {
  return document.querySelector('[data-state="partial"]');
}

const useRecording = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn() }));
const noteRealtime = vi.hoisted(() => ({
  transcript: {
    partial: null as ReturnType<typeof livePartial> | null,
    finalSegments: [] as Array<Record<string, unknown>>,
  },
  context: {
    cards: [] as Array<Record<string, unknown>>,
    state: { runs: [] as Array<Record<string, unknown>> },
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
              sequence: 1,
              text: "첫 번째 결정사항입니다.",
              startedAtMs: 0,
              endedAtMs: 1_200,
            },
            {
              segmentId: "01K0000000013",
              sequence: 2,
              text: "두 번째 결정사항입니다.",
              startedAtMs: 1_300,
              endedAtMs: 2_400,
            },
            {
              segmentId: "01K0000000014",
              sequence: 3,
              text: "두 번째 녹음의 첫 문장입니다.",
              startedAtMs: 620_000,
              endedAtMs: 620_900,
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
vi.mock("@/lib/ui/toast", () => ({ toast }));

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
      partial: livePartial("01K0000000201", partialText),
      finalSegments: [
        {
          segmentId: "01K0000000011",
          utteranceId: "01K0000000200",
          type: "final",
          sequence: 4,
          text: "세 번째 녹음의 확정 문장입니다.",
          startedAtMs: 1_240_000,
          endedAtMs: 1_241_100,
        },
      ],
    },
  };
}

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

function renderTranscript(phase: MeetingPhase = "active") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <TranscriptView
        noteId={NOTE_ID}
        phase={phase}
        focusSegmentId={null}
        onFocusHandled={() => {}}
      />
    </QueryClientProvider>
  );

  return {
    ...result,
    rerenderTranscript: () =>
      result.rerender(
        <QueryClientProvider client={client}>
          <TranscriptView
            noteId={NOTE_ID}
            phase={phase}
            focusSegmentId={null}
            onFocusHandled={() => {}}
          />
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

  it("실시간 전사는 이벤트로 받고 active 조회는 재진입 때 다시 읽는다", () => {
    useRecording.mockReturnValue(idleState());

    renderTranscript("active");

    expect(useGetNoteTranscript).toHaveBeenCalledWith(NOTE_ID, {
      query: { staleTime: 0, refetchOnWindowFocus: true },
    });
  });

  it("시작 전 전사는 60초 캐시를 쓰고 주기 조회를 하지 않는다", () => {
    useRecording.mockReturnValue(idleState());

    renderTranscript("not-started");

    expect(useGetNoteTranscript).toHaveBeenCalledWith(NOTE_ID, {
      query: { staleTime: 60_000, refetchOnWindowFocus: true },
    });
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

      expect(screen.getByText("스크립트가 없습니다.")).toBeInTheDocument();
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

  it("저장본 뒤에 이벤트로 온 새 발화도 따라간다", () => {
    const flushAnimationFrames = deferAnimationFrames();
    useRecording.mockReturnValue(idleState());
    useGetNoteTranscript
      .mockReturnValueOnce(transcriptResult([POLLED_SEGMENT]))
      .mockReturnValueOnce(transcriptResult([POLLED_SEGMENT]));

    const { container, rerenderTranscript } = renderTranscript("active");
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    setScrollMetrics(viewport!, { scrollTop: 450 });
    flushAnimationFrames();
    fireEvent.scroll(viewport!);
    scrollTo.mockClear();
    noteRealtime.transcript.finalSegments = [
      {
        type: "transcript.final",
        utteranceId: "01K0000000401",
        ...NEW_POLLED_SEGMENT,
      },
    ];

    rerenderTranscript();
    flushAnimationFrames();

    expect(scrollTo).toHaveBeenCalledWith({ top: 1_000, behavior: "auto" });
  });

  it("바닥에서 조금만 휠로 올려도 새 발화가 와도 따라가지 않고, 바닥 근처로 내려오면 다시 따라간다", () => {
    const flushAnimationFrames = deferAnimationFrames();
    useRecording.mockReturnValue(idleState());
    useGetNoteTranscript.mockReturnValueOnce(
      transcriptResult([POLLED_SEGMENT])
    );

    const { container, rerenderTranscript } = renderTranscript("active");
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )!;
    setScrollMetrics(viewport, { scrollTop: 600 });
    flushAnimationFrames();
    fireEvent.scroll(viewport);

    fireEvent.wheel(viewport, { deltaY: -100 });
    setScrollMetrics(viewport, { scrollTop: 500 });
    fireEvent.scroll(viewport);
    scrollTo.mockClear();
    useGetNoteTranscript.mockReturnValueOnce(
      transcriptResult([POLLED_SEGMENT, NEW_POLLED_SEGMENT])
    );
    rerenderTranscript();
    flushAnimationFrames();
    expect(scrollTo).not.toHaveBeenCalled();

    setScrollMetrics(viewport, { scrollTop: 580 });
    fireEvent.scroll(viewport);
    useGetNoteTranscript.mockReturnValueOnce(
      transcriptResult([POLLED_SEGMENT, NEW_POLLED_SEGMENT, THIRD_SEGMENT])
    );
    rerenderTranscript();
    flushAnimationFrames();
    expect(scrollTo).toHaveBeenCalledWith({ top: 1_000, behavior: "auto" });
  });

  it("새 발화로 예약된 자동 스크롤이 뜨기 전에 위로 올리면 그 예약은 위치를 빼앗지 않는다", () => {
    const flushAnimationFrames = deferAnimationFrames();
    useRecording.mockReturnValue(idleState());
    useGetNoteTranscript.mockReturnValueOnce(
      transcriptResult([POLLED_SEGMENT])
    );

    const { container, rerenderTranscript } = renderTranscript("active");
    const viewport = container.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )!;
    setScrollMetrics(viewport, { scrollTop: 600 });
    flushAnimationFrames();
    fireEvent.scroll(viewport);
    scrollTo.mockClear();

    useGetNoteTranscript.mockReturnValueOnce(
      transcriptResult([POLLED_SEGMENT, NEW_POLLED_SEGMENT])
    );
    rerenderTranscript();
    fireEvent.wheel(viewport, { deltaY: -40 });
    flushAnimationFrames();

    expect(scrollTo).not.toHaveBeenCalled();
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

  it("확정 발화를 묶지 않고 한 줄에 하나씩 그리며 partial을 살려 둔다", () => {
    renderTranscript();

    const blocks = screen.getAllByTestId("transcript-block");
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toHaveTextContent("첫 번째 결정사항입니다.");
    expect(blocks[0]).not.toHaveTextContent("두 번째 결정사항입니다.");
    expect(blocks[1]).toHaveTextContent("두 번째 결정사항입니다.");
    expect(blocks[2]).toHaveTextContent("두 번째 녹음의 첫 문장입니다.");
    expect(blocks[3]).toHaveTextContent("세 번째 녹음의 확정 문장입니다.");

    const partial = partialRow();
    expect(partial).toHaveTextContent("결과를 정리합니다");
    expect(partial).toHaveTextContent("받아 적는 중");

    expect(screen.queryByText("Conversation")).toBeNull();
    expect(screen.queryByText("대화 기록")).toBeNull();
    expect(blocks[0]).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-[max-content_minmax(0,1fr)]"
    );
    expect(blocks[0].className).toContain("gap-5");
  });

  it("partial 한 줄 안에서 확정된 앞부분만 확정 행과 같은 농도로 그린다", () => {
    useRecording.mockReturnValue({
      ...recordingState(),
      transcript: {
        partial: {
          utteranceId: "01K0000000501",
          confirmedText: "오늘 배포는 금요일에",
          pendingText: " 하지 않기로",
        },
        finalSegments: [],
      },
    });

    renderTranscript();

    const confirmed = screen.getByTestId("partial-confirmed");
    const pending = screen.getByTestId("partial-pending");

    expect(confirmed).toHaveTextContent("오늘 배포는 금요일에");
    expect(pending).toHaveTextContent("하지 않기로");
    expect(confirmed).toHaveClass("text-[var(--el-ink)]");
    expect(pending.className).not.toContain("text-[var(--el-ink)]");
    expect(partialRow()?.querySelector("p")).toHaveClass(
      "text-[var(--el-body)]"
    );
    expect(partialRow()).toHaveTextContent("오늘 배포는 금요일에 하지 않기로");
  });

  it("확정 토막이 비어 있으면 미확정 토막만 그린다", () => {
    useRecording.mockReturnValue({
      ...recordingState(),
      transcript: {
        partial: {
          utteranceId: "01K0000000502",
          confirmedText: "",
          pendingText: " 그러면",
        },
        finalSegments: [],
      },
    });

    renderTranscript();

    expect(screen.queryByTestId("partial-confirmed")).toBeNull();
    expect(screen.getByTestId("partial-pending")).toHaveTextContent("그러면");
    expect(screen.getByTestId("partial-pending").textContent).toBe("그러면");
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
    const partialLabel = screen.getByText("받아 적는 중");
    const partialBody = partial.querySelector("p");

    expect(final.firstElementChild).toHaveClass("sm:w-32");
    expect(partial.firstElementChild).toHaveClass("sm:w-32");
    expect(partial).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-[max-content_minmax(0,1fr)]"
    );
    expect(partialLabel).toHaveClass("whitespace-nowrap", "shrink-0");
    expect(partialBody).toHaveClass("min-w-0", "whitespace-normal");
    expect(partialBody).not.toHaveClass("truncate", "break-all");
    const scale = (element: Element, prefix: RegExp) =>
      [...element.classList]
        .map((name) => prefix.exec(name)?.[1])
        .filter((value): value is string => Boolean(value))
        .map(Number);
    expect(scale(final, /^px-(\d+)$/)).toEqual([]);
    expect(scale(partial, /^px-(\d+)$/)).toEqual(scale(partial, /^-mx-(\d+)$/));
  });

  it("dedupes recorder and note-topic partials by utteranceId and hides a finalized partial", () => {
    noteRealtime.transcript.partial = livePartial(
      "01K0000000201",
      "결과를 정리합니다"
    );
    noteRealtime.transcript.finalSegments = [
      {
        type: "transcript.final",
        segmentId: "01K0000000099",
        utteranceId: "01K0000000201",
        sequence: 3,
        text: "확정됐습니다.",
        startedAtMs: 2_500,
        endedAtMs: 3_200,
      },
    ];

    renderTranscript();

    expect(document.querySelector('[data-state="partial"]')).toBeNull();
    expect(screen.getByText(/확정됐습니다\./)).toBeInTheDocument();
  });

  it("같은 발화는 이벤트 사본보다 저장본을 그린다", () => {
    noteRealtime.transcript.finalSegments = [
      {
        type: "transcript.final",
        segmentId: "01K0000000012",
        utteranceId: "01K0000000301",
        sequence: 1,
        text: "이벤트로 온 옛 문장",
        startedAtMs: 0,
        endedAtMs: 1_200,
      },
    ];

    renderTranscript();

    expect(screen.getByText(/첫 번째 결정사항입니다\./)).toBeInTheDocument();
    expect(screen.queryByText(/이벤트로 온 옛 문장/)).toBeNull();
  });

  it("내가 녹음자면 토픽이 아니라 내 소켓의 발화를 그린다", () => {
    useRecording.mockReturnValue({
      ...recordingState(),
      transcript: {
        partial: livePartial("01K0000000301", "지금 말하는 문장"),
        finalSegments: [],
      },
    });
    noteRealtime.transcript.partial = livePartial(
      "01K0000000300",
      "토픽에 남은 이전 문장"
    );

    renderTranscript();

    expect(partialRow()).toHaveTextContent("지금 말하는 문장");
    expect(partialRow()).not.toHaveTextContent("토픽에 남은 이전 문장");
    expect(
      screen.queryByText(/토픽에 남은 이전 문장\s+지금 말하는 문장/)
    ).toBeNull();
  });

  it("일시정지 drain 동안에도 내 소켓의 partial을 그린다", () => {
    useRecording.mockReturnValue({
      ...recordingState(),
      phase: "stopping",
      transcript: {
        partial: livePartial("01K0000000401", "마지막 문장"),
        finalSegments: [],
      },
    });
    noteRealtime.transcript.partial = null;

    renderTranscript();

    expect(partialRow()).toHaveTextContent("마지막 문장");
  });

  it("내 녹음이 끝난 뒤에는 다른 탭의 토픽 발화를 그린다", () => {
    useRecording.mockReturnValue({
      ...recordingState(),
      phase: "completed",
      transcript: { partial: null, finalSegments: [] },
    });
    noteRealtime.transcript.partial = livePartial(
      "01K0000000400",
      "다른 탭에서 말하는 중"
    );

    renderTranscript();

    expect(partialRow()).toHaveTextContent("다른 탭에서 말하는 중");
  });

  it("exposes sequential transcript additions as an accessible log", () => {
    renderTranscript();

    expect(
      screen.getByRole("log", { name: "회의 스크립트" })
    ).toBeInTheDocument();
  });

  it("reserves floating dock clearance only at desktop widths", () => {
    renderTranscript();

    const content = screen.getByRole("log", {
      name: "회의 스크립트",
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

    expect(screen.queryByRole("log", { name: "회의 스크립트" })).toBeNull();
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
        "스크립트를 불러오지 못했습니다.",
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
