import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TranscriptView } from "@/components/notes/transcript-view";

const useGetNoteTranscript = vi.hoisted(() =>
  vi.fn(() => ({
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
              endedAtMs: 1200,
            },
            {
              segmentId: "01K0000000013",
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
  }))
);

vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({
    session: {
      sessionId: "01K0000000030",
      noteId: "01K0000000002",
      status: "ACTIVE",
    },
    phase: "recording",
    elapsedMs: 3200,
    level: 0.42,
    levelHistory: [0.1, 0.25, 0.7, 0.4],
    error: null,
    transcript: {
      partialByUtteranceId: { "01K0000000201": "결과를 정리합니다" },
      finalSegments: [
        {
          segmentId: "01K0000000011",
          utteranceId: "01K0000000200",
          type: "final",
          sequence: 2,
          text: "두 번째 결정사항입니다.",
          startedAtMs: 1300,
          endedAtMs: 2400,
        },
      ],
    },
  }),
}));
vi.mock("@/lib/api/generated/transcription/transcription", () => ({
  getGetNoteTranscriptQueryKey: () => ["transcript"],
  useGetNoteTranscript,
}));

describe("TranscriptView", () => {
  const scrollIntoView = vi.fn();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows immutable finals, a live partial, and actual microphone level", () => {
    vi.stubGlobal("scrollIntoView", scrollIntoView);
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <TranscriptView noteId="01K0000000002" />
      </QueryClientProvider>
    );
    expect(screen.getByText("결과를 정리합니다")).toHaveAttribute(
      "data-state",
      "partial"
    );
    expect(screen.queryByText("결과를")).not.toBeInTheDocument();
    expect(screen.getByText("결과를 정리합니다")).toHaveClass(
      "text-[var(--el-body)]"
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "end",
    });
    expect(
      screen.getByText("첫 번째 결정사항입니다.").closest("article")
    ).toHaveAttribute("data-state", "final");
    expect(
      screen.queryByRole("meter", { name: "실시간 마이크 파형" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /수정/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByTestId("final-segment").map((row) => row.dataset.sequence)
    ).toEqual(["1", "1", "2"]);
    expect(
      screen
        .getAllByTestId("final-segment")
        .map((row) => row.dataset.timelineStartMs)
    ).toEqual(["0", "1200", "3400"]);
    expect(useGetNoteTranscript).toHaveBeenCalledWith(
      "01K0000000002",
      expect.objectContaining({
        query: expect.objectContaining({ refetchInterval: 2_500 }),
      })
    );
  });
});
