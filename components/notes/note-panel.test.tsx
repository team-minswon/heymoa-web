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
const noteState = vi.hoisted(() => ({
  value: {
    noteId: "01K0000000002",
    title: "주간 제품 회의",
    projectId: "01K0000000001",
    meetingStatus: "IN_PROGRESS" as string,
    meetingStartedBy: { userId: "u1", name: "테스트 유저" } as unknown,
  },
}));

vi.mock("@/components/notes/note-details", () => ({
  NoteDetails: () => <p>정보 내용</p>,
}));
vi.mock("@/components/notes/transcript-view", () => ({
  TranscriptView: () => <p>전사 내용</p>,
}));
vi.mock("@/components/notes/shared-chat-panel", () => ({
  SharedChatPanel: ({
    phase,
    onTurnActiveChange,
  }: {
    phase: string;
    onTurnActiveChange?: (active: boolean) => void;
  }) => (
    <div data-testid="shared-chat-panel" data-phase={phase}>
      <button type="button" onClick={() => onTurnActiveChange?.(true)}>
        턴 시작
      </button>
      <button type="button" onClick={() => onTurnActiveChange?.(false)}>
        턴 끝
      </button>
    </div>
  ),
}));
vi.mock("@/components/notes/note-archive", () => ({
  NoteArchive: () => <div data-testid="note-archive" />,
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  useGetNote: () => ({
    data: { status: 200, data: { success: true, data: noteState.value } },
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
  const wrap = (node: ReactNode) => (
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
        {node}
      </RecordingProvider>
    </QueryClientProvider>
  );

  const view = render(wrap(ui));
  return { ...view, rerenderNote: (node: ReactNode) => view.rerender(wrap(node)) };
}

describe("NotePanel", () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });
  afterEach(() => {
    cleanup();
    noteState.value = {
      noteId: "01K0000000002",
      title: "주간 제품 회의",
      projectId: "01K0000000001",
      meetingStatus: "IN_PROGRESS",
      meetingStartedBy: { userId: "u1", name: "테스트 유저" },
    };
  });
  it("changes only the controlled tab", () => {
    const onTabChange = vi.fn();
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
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

  it("shows five microphone bars in the compact recording dock", async () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
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
          view="side"
          tab="transcript"
          onTabChange={vi.fn()}
          onClose={vi.fn()}
        />
        <NotePanel
          workspaceId="01K0000000000"
          noteId="01K0000000003"
          view="side"
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

  it("full + 활성이면 공유 챗봇 트레이가 선다", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(
      screen.getByTestId("shared-chat-panel").getAttribute("data-phase")
    ).toBe("active");
  });

  it("full + 종료면 트레이가 사라진다 — 우측은 개인 챗봇 몫", () => {
    noteState.value.meetingStatus = "ENDED";
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByTestId("shared-chat-panel")).toBeNull();
  });

  it("답변이 흐르는 중 회의가 종료돼도 트레이를 걷지 않고, 턴이 끝나면 아카이브로 넘긴다", () => {
    const el = (
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="full"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const { rerenderNote } = renderNotePanel(el);
    expect(screen.getByTestId("shared-chat-panel")).toBeTruthy();

    // 턴이 흐른다.
    fireEvent.click(screen.getByRole("button", { name: "턴 시작" }));
    // 그 사이 다른 멤버가 회의를 끝낸다(폴링이 ENDED를 올린다).
    noteState.value.meetingStatus = "ENDED";
    rerenderNote(el);
    // 트레이는 아직 있고 아카이브는 아직 없다 — 언마운트하면 흐르던 답변이 사라진다.
    expect(screen.getByTestId("shared-chat-panel")).toBeTruthy();
    expect(screen.queryByTestId("note-archive")).toBeNull();

    // 턴이 끝난다.
    fireEvent.click(screen.getByRole("button", { name: "턴 끝" }));
    expect(screen.queryByTestId("shared-chat-panel")).toBeNull();
    expect(screen.getByTestId("note-archive")).toBeTruthy();
  });

  it("side 모드에는 트레이가 없다", () => {
    renderNotePanel(
      <NotePanel
        workspaceId="01K0000000000"
        noteId="01K0000000002"
        view="side"
        tab="transcript"
        onTabChange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByTestId("shared-chat-panel")).toBeNull();
  });
});
