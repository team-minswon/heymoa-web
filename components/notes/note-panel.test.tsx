import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { NotePanel } from "@/components/notes/note-panel";
import {
  RecordingProvider,
  type RecordingRuntime,
} from "@/components/transcription/recording-provider";

const useGetProject = vi.hoisted(() => vi.fn());

vi.mock("@/components/notes/note-details", () => ({
  NoteDetails: () => <p>정보 내용</p>,
}));
vi.mock("@/components/notes/transcript-view", () => ({
  TranscriptView: () => <p>전사 내용</p>,
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  useGetNote: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          noteId: "01K0000000002",
          title: "주간 제품 회의",
          projectId: "01K0000000001",
        },
      },
    },
  }),
}));
vi.mock("@/lib/api/generated/projects/projects", () => ({
  useGetProject: (...args: unknown[]) => {
    useGetProject(...args);
    return {
      data: {
        status: 200,
        data: {
          success: true,
          data: {
            projectId: "01K0000000001",
            name: "주간",
          },
        },
      },
    };
  },
}));

const runtime: RecordingRuntime = {
  createSession: (options) => ({
    requestPermission: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn(async (sessionId: string) =>
      options.onEvent({ type: "connected", sessionId })
    ),
    commit: vi.fn(),
    stop: vi.fn(async () =>
      options.onEvent({ type: "completed", sessionId: "01K0000000010" })
    ),
    reconcile: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
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
        enablePolling={false}
        api={{
          startSession: vi.fn(async (noteId) => ({
            sessionId: "01K0000000010",
            noteId,
            status: "READY" as const,
            readyExpiresAt: "2026-07-11T00:10:00Z",
            startedAt: null,
            endedAt: null,
            endReason: null,
          })),
        }}
      >
        {ui}
      </RecordingProvider>
    </QueryClientProvider>
  );
}

describe("NotePanel", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });
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

    expect(
      screen.getByRole("tab", { name: "실시간 전사" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "노트 정보" }));
    expect(onTabChange).toHaveBeenCalledWith("details");
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.getByText("주간")).toBeInTheDocument();
    expect(useGetProject).toHaveBeenCalledWith(
      "01K0000000000",
      "01K0000000001",
      { query: { enabled: true } }
    );
  });

  it("shows nine microphone bars in the recording dock", async () => {
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
      ).toHaveLength(9)
    );
    expect(
      screen.queryByRole("button", { name: "구간 확정" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /일시 정지|재개/ })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "녹음 종료" })).toBeEnabled();
  });

  it("blocks a second note from starting while another note records", async () => {
    renderNotePanel(
      <>
        <NotePanel
          workspaceId="01K0000000000"
          noteId="01K0000000002"
          tab="transcript"
          onTabChange={vi.fn()}
          onClose={vi.fn()}
        />
        <NotePanel
          workspaceId="01K0000000000"
          noteId="01K0000000003"
          tab="transcript"
          onTabChange={vi.fn()}
          onClose={vi.fn()}
        />
      </>
    );

    fireEvent.click(screen.getAllByRole("button", { name: "기록 시작" })[0]);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "다른 노트에서 녹음 중" })
      ).toBeDisabled()
    );
  });
});
