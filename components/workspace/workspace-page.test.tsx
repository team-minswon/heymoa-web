import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspacePage } from "@/components/workspace/workspace-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({ phase: "idle", activeNoteId: undefined, session: null }),
  useRecordingMeter: () => ({ level: 0, levelHistory: [0, 0, 0, 0, 0] }),
}));
vi.mock("@/components/workspace/workspace-app-shell", () => ({
  useWorkspaceShell: () => ({
    selectedProjectId: "01K0000000001",
    projects: [{ projectId: "01K0000000001", name: "모바일 앱" }],
    isWorkspacePending: false,
    isWorkspaceError: false,
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
}));

describe("WorkspacePage", () => {
  afterEach(cleanup);

  it("renders the screen title, count, and note list without the marketing kicker or header CTA", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WorkspacePage workspaceId="01K0000000000" />
      </QueryClientProvider>
    );

    expect(
      screen.getByRole("heading", { name: "모바일 앱" })
    ).toBeInTheDocument();
    expect(screen.getByText(/2개의 회의 기록/)).toBeInTheDocument();
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    // v5: 제품 면 대문자 키커 금지, 새 노트 진입점은 상단바로 이동(헤더 CTA 없음).
    expect(screen.queryByText("Meeting notes")).toBeNull();
    expect(screen.queryByRole("button", { name: /새 회의 기록|새 노트/ })).toBeNull();
  });
});
