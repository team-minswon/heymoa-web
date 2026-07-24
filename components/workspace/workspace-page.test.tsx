import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspacePage } from "@/components/workspace/workspace-page";

const auth = vi.hoisted(() => ({
  user: { userId: "user-me", name: "나" } as { userId: string; name: string } | null,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: auth.user }),
}));
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
              lastRecordedAt: null,
              recordedDurationMs: 0,
              meetingStartedBy: { userId: "user-me", name: "나" },
            },
            {
              noteId: "01K0000000003",
              projectId: "01K0000000001",
              title: "리서치 공유",
              createdAt: "2026-07-09T00:00:00Z",
              updatedAt: "2026-07-10T00:00:00Z",
              lastRecordedAt: null,
              recordedDurationMs: 0,
              meetingStartedBy: { userId: "user-other", name: "남" },
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

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspacePage workspaceId="01K0000000000" />
    </QueryClientProvider>
  );
}

describe("WorkspacePage", () => {
  afterEach(() => {
    cleanup();
    auth.user = { userId: "user-me", name: "나" };
  });

  it("renders the screen title, count, and flat list without the marketing kicker", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "모바일 앱" })
    ).toBeInTheDocument();
    expect(screen.getByText(/2개의 회의 기록/)).toBeInTheDocument();
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.getByText("리서치 공유")).toBeInTheDocument();
    // v5: 제품 면 대문자 키커 금지, 새 노트 진입점은 상단바(헤더 CTA 없음).
    expect(screen.queryByText("Meeting notes")).toBeNull();
    expect(screen.queryByRole("button", { name: /새 회의 기록|새 노트/ })).toBeNull();
  });

  it("filters to notes I started via meetingStartedBy", () => {
    renderPage();

    const mine = screen.getByRole("button", { name: "내가 시작" });
    fireEvent.click(mine);

    expect(mine).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.queryByText("리서치 공유")).toBeNull();
    expect(screen.getByText(/1개의 회의 기록/)).toBeInTheDocument();
  });

  it("shows a filter-specific empty state, not '아직 회의 기록이 없습니다', when none are mine", () => {
    auth.user = { userId: "nobody", name: "X" };
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "내가 시작" }));

    expect(screen.getByText("내가 시작한 회의가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("아직 회의 기록이 없습니다")).toBeNull();
  });

  it("does not leak null-owner notes as mine while the user is unresolved", () => {
    auth.user = null;
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "내가 시작" }));

    // 유저 미해결이면 소유 판별 없이 아무 노트도 '내가 시작'에 걸리지 않는다.
    expect(screen.queryByText("주간 제품 회의")).toBeNull();
    expect(screen.queryByText("리서치 공유")).toBeNull();
    expect(screen.getByText("내가 시작한 회의가 없습니다.")).toBeInTheDocument();
  });
});
