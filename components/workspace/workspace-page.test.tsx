import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkspacePage } from "@/components/workspace/workspace-page";

const push = vi.hoisted(() => vi.fn());
const start = vi.hoisted(() => vi.fn());
const createNote = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/workspace/workspace-app-shell", () => ({
  useWorkspaceShell: () => ({ selectedProjectId: "01K0000000001" }),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({ start, session: null, phase: "idle" }),
}));
vi.mock("@/lib/api/generated/projects/projects", () => ({
  useGetProjects: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          projects: [
            { projectId: "01K0000000001", name: "모바일 앱" },
          ],
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
    expect(screen.getByRole("heading", { name: "모바일 앱" })).toBeInTheDocument();
    expect(screen.getByText("2개의 회의 기록")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "새 회의" });
    expect(button).toHaveClass("rounded-full");
    fireEvent.click(button);

    await waitFor(() => expect(start).toHaveBeenCalledWith("01K0000000100"));
    expect(push).toHaveBeenCalledWith(
      "/w/01K0000000000/notes/01K0000000100?view=side&tab=transcript"
    );
  });
});
