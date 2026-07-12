import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { SidebarProvider } from "@/components/ui/sidebar";

const recording = vi.hoisted(() => ({
  session: null as null | Record<string, unknown>,
  elapsedMs: 0,
  level: 0.42,
  levelHistory: [0.1, 0.25, 0.7, 0.4],
  microphoneState: "recording",
  error: null,
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
}));
const createNote = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
}));
vi.mock("@/lib/api/generated/note/note", () => ({
  useCreateNote: () => ({ mutateAsync: createNote, isPending: false }),
}));

describe("WorkspaceToolbar", () => {
  afterEach(() => {
    cleanup();
    createNote.mockReset();
    push.mockReset();
    recording.start.mockReset();
  });
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("shows the start action when idle", () => {
    recording.session = null;
    recording.elapsedMs = 0;
    render(
      <SidebarProvider>
        <WorkspaceToolbar
          workspaceId="01K0000000000"
          currentLabel="모든 노트"
        />
      </SidebarProvider>
    );

    expect(
      screen.getByRole("button", { name: "실시간 기록 시작" })
    ).toBeEnabled();
  });

  it("creates a fresh note and starts a session for that exact note", async () => {
    recording.session = null;
    createNote.mockResolvedValue({
      status: 200,
      data: { success: true, data: { noteId: "01K0000000100" } },
    });
    render(
      <SidebarProvider>
        <WorkspaceToolbar
          workspaceId="01K0000000000"
          currentLabel="모든 노트"
        />
      </SidebarProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "실시간 기록 시작" }));

    await waitFor(() =>
      expect(recording.start).toHaveBeenCalledWith("01K0000000100")
    );
    expect(push).toHaveBeenCalledWith(
      "/w/01K0000000000/notes/01K0000000100?view=side&tab=transcript"
    );
  });

  it("creates only a fresh note when the plus button is used", async () => {
    recording.session = null;
    recording.start.mockClear();
    createNote.mockResolvedValue({
      status: 200,
      data: { success: true, data: { noteId: "01K0000000101" } },
    });
    render(
      <SidebarProvider>
        <WorkspaceToolbar
          workspaceId="01K0000000000"
          currentLabel="모든 노트"
        />
      </SidebarProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "새 노트" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/w/01K0000000000/notes/01K0000000101?view=side&tab=transcript"
      )
    );
    expect(recording.start).not.toHaveBeenCalled();
  });

  it("shows global pause and stop controls while streaming", () => {
    recording.session = {
      sessionId: "01K0000000010",
      noteId: "01K0000000002",
      status: "STREAMING",
    };
    recording.elapsedMs = 12_000;
    render(
      <SidebarProvider>
        <WorkspaceToolbar workspaceId="01K0000000000" currentLabel="주간" />
      </SidebarProvider>
    );

    expect(screen.getByText("녹음 중")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "마이크 입력" })).toHaveAttribute(
      "aria-valuenow",
      "42"
    );
    expect(screen.getByText("00:12")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "녹음 일시 정지" })
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "녹음 종료" })).toBeEnabled();
  });
});
