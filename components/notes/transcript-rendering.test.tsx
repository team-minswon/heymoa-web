import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TranscriptView } from "./transcript-view";

const fixture = vi.hoisted(() => {
  const segments = Array.from({ length: 200 }, (_, i) => ({
    segmentId: `segment-${i}`,
    sequence: i + 1,
    text: `확정 발화 ${i}`,
    startedAtMs: i * 1000,
    endedAtMs: i * 1000 + 900,
    speakerLabel: "A",
  }));
  return {
    recording: {
      activeNoteId: "note-1",
      session: null,
      phase: "recording",
      transcript: {
        partial: {
          utteranceId: "partial-1",
          confirmedText: "받아 적는",
          pendingText: " 첫 글자",
        },
        finalSegments: [],
      },
    },
    realtime: {
      transcript: { partial: null, finalSegments: [] },
      context: { cards: [], state: { runs: [] } },
    },
    response: {
      data: {
        status: 200,
        data: {
          success: true,
          data: {
            segments,
            diarization: { status: "MAPPED", speakers: [{ label: "A" }] },
          },
        },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    },
    speakerRender: vi.fn(),
  };
});
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => fixture.recording,
  useRecordingTranscript: () => fixture.recording.transcript,
}));
vi.mock("@/components/notes/note-realtime-provider", () => ({
  useNoteRealtime: () => fixture.realtime,
}));
vi.mock("@/lib/api/generated/transcription/transcription", () => ({
  useGetNoteTranscript: () => fixture.response,
}));
vi.mock("@/components/notes/speaker-chip", async (original) => {
  const actual = await original<typeof import("./speaker-chip")>();
  return {
    SpeakerChip: (props: Parameters<typeof actual.SpeakerChip>[0]) => {
      fixture.speakerRender();
      return actual.SpeakerChip(props);
    },
  };
});
afterEach(cleanup);

it("잠정 글자만 바뀔 때 긴 확정 목록의 화자 컴포넌트를 다시 그리지 않는다", () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = () => (
    <QueryClientProvider client={client}>
      <TranscriptView
        noteId="note-1"
        phase="active"
        focusSegmentId={null}
        onFocusHandled={() => {}}
      />
    </QueryClientProvider>
  );
  const rendered = render(view());
  const before = fixture.speakerRender.mock.calls.length;
  expect(before).toBe(200);
  fixture.recording.transcript.partial = {
    ...fixture.recording.transcript.partial,
    pendingText: " 새로운 글자",
  };
  rendered.rerender(view());
  expect(screen.getByText("새로운 글자")).toBeVisible();
  expect(fixture.speakerRender.mock.calls.length).toBe(before);

  const transcript = fixture.response.data.data.data;
  fixture.response.data.data.data = {
    ...transcript,
    segments: transcript.segments.map((segment, index) =>
      index === 0 ? { ...segment, text: "정정된 발화" } : segment
    ),
  };
  rendered.rerender(view());
  expect(screen.getByText("정정된 발화")).toBeVisible();
  expect(screen.queryByText("확정 발화 0")).not.toBeInTheDocument();

  const corrected = fixture.response.data.data.data;
  fixture.response.data.data.data = {
    ...corrected,
    segments: [
      ...corrected.segments,
      {
        ...corrected.segments[0],
        segmentId: "new-final",
        sequence: 201,
        text: "새 확정 발화",
        startedAtMs: 201000,
        endedAtMs: 201900,
      },
    ],
  };
  rendered.rerender(view());
  expect(screen.getByText("새 확정 발화")).toBeVisible();
  expect(screen.getAllByTestId("transcript-block")).toHaveLength(201);
});
