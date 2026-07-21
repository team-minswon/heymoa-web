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

const NOTE_ID = "01K0000000002";
const useRecording = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn() }));
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
      partialByUtteranceId: { "01K0000000201": partialText },
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

function renderTranscript() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <TranscriptView noteId={NOTE_ID} />
    </QueryClientProvider>
  );

  return {
    ...result,
    rerenderTranscript: () =>
      result.rerender(
        <QueryClientProvider client={client}>
          <TranscriptView noteId={NOTE_ID} />
        </QueryClientProvider>
      ),
  };
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
    expect(partial).toHaveTextContent("Live");
    expect(useGetNoteTranscript).toHaveBeenCalledWith(
      NOTE_ID,
      expect.objectContaining({
        query: expect.objectContaining({ refetchInterval: 2_500 }),
      })
    );
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
      screen.queryByRole("button", { name: "최신 기록 보기" })
    ).not.toBeInTheDocument();
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
      screen.getByRole("button", { name: "최신 기록 보기" })
    ).toBeInTheDocument();
    scrollTo.mockClear();

    useRecording.mockReturnValue(recordingState("새로운 발화가 도착했습니다"));
    rerenderTranscript();
    expect(scrollTo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "최신 기록 보기" }));
    expect(scrollTo).toHaveBeenCalledWith({
      top: 1_000,
      behavior: "smooth",
    });
    expect(
      screen.queryByRole("button", { name: "최신 기록 보기" })
    ).not.toBeInTheDocument();
  });
});
