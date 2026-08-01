import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspacePage } from "@/components/workspace/workspace-page";

const useGetNotes = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/w/01K0000000000",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/transcription/recording-provider", () => ({
  useRecording: () => ({
    phase: "idle",
    activeNoteId: undefined,
    session: null,
  }),
  useRecordingMeter: () => ({ level: 0, levelHistory: [0, 0, 0, 0, 0] }),
}));
vi.mock("@/lib/workspace/use-create-meeting", () => ({
  useCreateMeeting: () => ({
    createMeeting: vi.fn(),
    disabled: false,
    isPending: false,
  }),
}));
vi.mock("@/components/workspace/workspace-app-shell", () => ({
  useWorkspaceShell: () => ({
    selectedProjectId: "01K0000000001",
    projects: [{ projectId: "01K0000000001", name: "모바일 앱" }],
    isWorkspacePending: false,
    isWorkspaceError: false,
  }),
}));

const NOTE_DEFAULTS = {
  projectId: "01K0000000001",
  scheduledAt: null,
  participants: [],
  analysisStatus: "NONE",
  previousNote: null,
  activeSessionStartedAt: null,
};

vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNotesQueryOptions: vi.fn(),
  useGetNotes: (...args: unknown[]) => {
    useGetNotes(...args);
    return {
      data: {
        status: 200,
        data: {
          success: true,
          data: {
            notes: [
              {
                ...NOTE_DEFAULTS,
                noteId: "01K0000000002",
                title: "주간 제품 회의",
                createdAt: "2026-07-10T00:00:00Z",
                updatedAt: "2026-07-11T00:00:00Z",
                lastRecordedAt: null,
                recordedDurationMs: 0,
                meetingStatus: "IN_PROGRESS",
                meetingStartedAt: "2026-07-11T00:00:00Z",
                meetingStartedBy: { userId: "user-me", name: "나" },
              },
              {
                ...NOTE_DEFAULTS,
                noteId: "01K0000000003",
                title: "리서치 공유",
                createdAt: "2026-07-09T00:00:00Z",
                updatedAt: "2026-07-10T00:00:00Z",
                lastRecordedAt: null,
                recordedDurationMs: 0,
                meetingStatus: "ENDED",
                meetingStartedAt: "2026-07-09T00:00:00Z",
                meetingStartedBy: { userId: "user-other", name: "남" },
              },
              {
                ...NOTE_DEFAULTS,
                noteId: "01K0000000004",
                title: "로드맵 리뷰",
                scheduledAt: "2026-08-03T05:00:00Z",
                createdAt: "2026-07-08T00:00:00Z",
                updatedAt: "2026-07-08T00:00:00Z",
                lastRecordedAt: null,
                recordedDurationMs: 0,
                meetingStatus: "NOT_STARTED",
                meetingStartedAt: null,
                meetingStartedBy: null,
              },
            ],
          },
        },
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    };
  },
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
    useGetNotes.mockReset();
  });

  it("renders the screen title, the counts, and the table under its column head", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "모바일 앱" })
    ).toBeInTheDocument();
    expect(screen.getByText("회의 3건 · 예정 1건 · 기록 중 1건")).toBeInTheDocument();
    // 표는 칸 이름을 갖는다 — 목록이 아니라 표라는 것이 이 줄로 결정된다.
    expect(screen.getByText("참석자")).toBeInTheDocument();
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.getByText("리서치 공유")).toBeInTheDocument();
    // 새 회의는 페이지 머리가 갖는다(상단바가 아니라).
    expect(screen.getByRole("button", { name: "새 회의" })).toBeInTheDocument();
  });

  it("splits scheduled meetings from started ones, each with its own order", () => {
    renderPage();

    // 「예정」은 필터 탭에도 있다 — 구획 제목 쪽만 본다.
    expect(screen.getAllByText("예정").length).toBeGreaterThan(1);
    expect(screen.getByText("1건 · 가까운 순")).toBeInTheDocument();
    expect(screen.getByText("시작된 회의")).toBeInTheDocument();
    expect(screen.getByText("2건 · 최근 시작순")).toBeInTheDocument();
  });

  it("filters by meeting status", () => {
    renderPage();

    const live = screen.getByRole("button", { name: "기록 중" });
    fireEvent.click(live);

    expect(live).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.queryByText("리서치 공유")).toBeNull();
    expect(screen.queryByText("로드맵 리뷰")).toBeNull();
  });

  it("searches title and participants without touching the status filter", () => {
    renderPage();

    fireEvent.change(screen.getByRole("searchbox", { name: "회의 찾기" }), {
      target: { value: "리서치" },
    });

    expect(screen.getByText("리서치 공유")).toBeInTheDocument();
    expect(screen.queryByText("주간 제품 회의")).toBeNull();
  });

  it("tells filtered-empty apart from never-had-any", () => {
    renderPage();

    fireEvent.change(screen.getByRole("searchbox", { name: "회의 찾기" }), {
      target: { value: "없는회의" },
    });

    expect(screen.getByText("조건에 맞는 회의가 없습니다")).toBeInTheDocument();
    expect(screen.queryByText("아직 회의가 없습니다")).toBeNull();
  });

  it("polls active lists every 10 seconds and inactive lists every 30 seconds", () => {
    renderPage();
    // MVP2에서 GET /v1/projects/{projectId}/notes에 조회 파라미터가 생겨
    // 훅 시그니처가 (projectId, params, options)로 바뀌었다 — options는 세 번째다.
    const options = useGetNotes.mock.calls.at(-1)?.[2] as {
      query: {
        refetchInterval: (query: { state: { data: unknown } }) => number;
      };
    };
    const response = (meetingStatus: "IN_PROGRESS" | "ENDED") => ({
      status: 200,
      data: {
        success: true,
        data: {
          notes: [
            {
              meetingStatus,
              meetingStartedAt:
                meetingStatus === "IN_PROGRESS" ? "2026-07-11T00:00:00Z" : null,
              meetingStartedBy:
                meetingStatus === "IN_PROGRESS"
                  ? { userId: "user-other", name: "남" }
                  : null,
            },
          ],
        },
      },
    });

    expect(
      options.query.refetchInterval({
        state: { data: response("IN_PROGRESS") },
      })
    ).toBe(10_000);
    expect(
      options.query.refetchInterval({ state: { data: response("ENDED") } })
    ).toBe(30_000);
  });
});
