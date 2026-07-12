import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TranscriptView } from "@/components/notes/transcript-view";

vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({
    session: { noteId: "01K0000000002", status: "STREAMING" },
    elapsedMs: 3200,
    level: 0.42,
    levelHistory: [0.1, 0.25, 0.7, 0.4],
    error: null,
    transcript: {
      partialByItemId: { "item-1": "결과를" },
      partialStartedAtMsByItemId: { "item-1": 1200 },
      finalSegments: [
        {
          segmentId: "01K0000000011",
          sessionId: "01K0000000010",
          sequence: 1,
          text: "첫 번째 결정사항입니다.",
          startedAtMs: 0,
          endedAtMs: 1200,
        },
      ],
    },
  }),
}));
vi.mock("@/lib/api/generated/transcription/transcription", () => ({
  getListNoteTranscriptSegmentsQueryKey: () => ["segments"],
  useDeleteTranscriptSegment: () => ({ mutateAsync: vi.fn() }),
  useListNoteTranscriptSegments: () => ({
    data: { status: 200, data: { success: true, data: { items: [] } } },
    isPending: false,
  }),
}));

describe("TranscriptView", () => {
  it("shows immutable finals, a live partial, and actual microphone level", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TranscriptView noteId="01K0000000002" />
      </QueryClientProvider>
    );
    expect(screen.getByText("결과를")).toHaveAttribute("data-state", "partial");
    expect(
      screen.getByText("첫 번째 결정사항입니다.").closest("article")
    ).toHaveAttribute("data-state", "final");
    expect(
      screen.getByRole("meter", { name: "실시간 마이크 파형" })
    ).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByTestId("wave-bar-2")).toHaveAttribute("height", "30.8");
    expect(
      screen.queryByRole("button", { name: /수정/ })
    ).not.toBeInTheDocument();
  });
});
