import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotePanel } from "@/components/notes/note-panel";
import {
  RecordingProvider,
  type RecordingRuntime,
} from "@/components/transcription/recording-provider";

vi.mock("@/components/notes/note-details", () => ({
  NoteDetails: () => <p>정보 내용</p>,
}));
vi.mock("@/components/notes/transcript-view", () => ({
  TranscriptView: () => <p>전사 내용</p>,
}));
vi.mock("@/lib/api/generated/note/note", () => ({
  getListWorkspaceNotesQueryKey: () => ["notes"],
  useGetNote: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          noteId: "01K0000000002",
          title: "주간 제품 회의",
          folders: [{ folderId: "01K0000000001", name: "주간" }],
        },
      },
    },
  }),
  useDeleteNote: () => ({ mutateAsync: vi.fn() }),
}));

const runtime: RecordingRuntime = {
  createAudio: () => ({
    requestPermission: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  }),
  createSocket: () => ({
    connect: vi.fn().mockResolvedValue(undefined),
    sendAudio: vi.fn(),
    sendCommand: vi.fn(),
    close: vi.fn(),
  }),
};

function renderNotePanel(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <RecordingProvider
        runtime={runtime}
        api={{
          createSession: vi.fn(async (noteId) => ({
            session: {
              sessionId: "01K0000000010",
              noteId,
              status: "CONNECTING",
              recordedDurationMs: 0,
              startedBy: { userId: "01K0000000003", name: "테스트 유저" },
              startedAt: "2026-07-11T00:00:00Z",
              endedAt: null,
            },
            socketUrl: "ws://localhost/stream?ticket=test",
            ticketExpiresAt: "2026-07-11T00:01:00Z",
          })),
          createTicket: vi.fn(),
        }}
      >
        {ui}
      </RecordingProvider>
    </QueryClientProvider>
  );
}

describe("NotePanel", () => {
  afterEach(cleanup);
  it("changes only the controlled tab", () => {
    const onTabChange = vi.fn();
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        tab="transcript"
        onTabChange={onTabChange}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("tab", { name: "노트 정보" }));
    expect(onTabChange).toHaveBeenCalledWith("details");
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.getByText("주간")).toBeInTheDocument();
  });

  it("shows five rounded microphone bars in the bottom recording control", async () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "기록 시작" }));
    await waitFor(() =>
      expect(
        screen.getByTestId("note-recording-waveform").children
      ).toHaveLength(5)
    );
  });
});
