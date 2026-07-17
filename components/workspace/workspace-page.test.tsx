import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspacePage } from "@/components/workspace/workspace-page";

const push = vi.hoisted(() => vi.fn());
const createNote = vi.hoisted(() => vi.fn());
const recording = vi.hoisted(() => ({
  phase: "idle",
  session: null as null | { noteId: string },
  elapsedMs: 0,
  levelHistory: [0, 0, 0, 0, 0],
  start: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/workspace/workspace-app-shell", () => ({
  useWorkspaceShell: () => ({ selectedProjectId: "01K0000000001" }),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => recording,
}));
vi.mock("@/lib/api/generated/projects/projects", () => ({
  useGetProjects: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          projects: [{ projectId: "01K0000000001", name: "모바일 앱" }],
        },
      },
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNotesQueryOptions: vi.fn(),
  useGetNotes: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          notes: [
            {
              noteId: "01K0000000002",
              projectId: "01K0000000001",
              title: "주간 제품 회의",
              createdAt: "2026-07-10T00:00:00Z",
              updatedAt: "2026-07-11T00:00:00Z",
            },
            {
              noteId: "01K0000000003",
              projectId: "01K0000000001",
              title: "리서치 공유",
              createdAt: "2026-07-09T00:00:00Z",
              updatedAt: "2026-07-10T00:00:00Z",
            },
          ],
        },
      },
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreateNote: () => ({ mutateAsync: createNote, isPending: false }),
}));

describe("WorkspacePage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    push.mockReset();
    createNote.mockReset();
    recording.start.mockReset();
    recording.phase = "idle";
    recording.session = null;
  });

  it("disables meeting creation while a recording is starting", () => {
    recording.phase = "requesting-permission";
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspacePage workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("button", { name: "새 회의 기록" })
    ).toBeDisabled();
  });

  it("renders the selected project hierarchy and creates a meeting", async () => {
    createNote.mockResolvedValue({
      status: 201,
      data: {
        success: true,
        data: { noteId: "01K0000000100" },
      },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspacePage workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    expect(screen.getByText("Meeting notes")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "모바일 앱" })
    ).toBeInTheDocument();
    expect(screen.getByText(/2개의 회의 기록/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "새 회의 기록" });
    expect(button).toHaveClass("rounded-full");
    fireEvent.click(button);

    await waitFor(() =>
      expect(recording.start).toHaveBeenCalledWith("01K0000000100")
    );
    expect(push).toHaveBeenCalledWith(
      "/w/01K0000000000/notes/01K0000000100?view=side&tab=transcript"
    );
  });

  it("opens the active recording instead of creating another meeting", () => {
    recording.phase = "recording";
    recording.session = { noteId: "01K0000000002" };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspacePage workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "현재 녹음" }));

    expect(push).toHaveBeenCalledWith(
      "/w/01K0000000000/notes/01K0000000002?view=side&tab=transcript"
    );
    expect(createNote).not.toHaveBeenCalled();
    expect(recording.start).not.toHaveBeenCalled();
  });
});
