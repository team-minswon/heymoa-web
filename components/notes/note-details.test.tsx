import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NoteDetails,
  NoteDetailsSkeleton,
} from "@/components/notes/note-details";

const NOTE_ID = "01K0000000002";
const WORKSPACE_ID = "01K0000000001";
const PROJECT_ID = "01K0000000010";
const mutateAsync = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNoteQueryKey: (noteId: string) => ["note", noteId],
  getGetNotesQueryKey: (projectId: string) => ["notes", projectId],
  useGetNoteSuspense: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          noteId: NOTE_ID,
          projectId: PROJECT_ID,
          title: "주간 제품 회의",
          createdAt: "2026-07-10T00:00:00Z",
          updatedAt: "2026-07-11T00:00:00Z",
          meetingStatus: "ENDED",
          meetingStartedAt: "2026-07-10T01:00:00Z",
          meetingStartedBy: {
            userId: "user-1",
            name: "김서연",
            email: "seoyeon@heymoa.com",
            image: null,
          },
          recordedDurationMs: 2_520_000,
          activeSessionStartedAt: null,
          participants: [
            {
              participantId: "part-1",
              userId: "user-1",
              guestId: null,
              name: "김서연",
              email: "a@b.c",
              image: null,
            },
            {
              participantId: "part-2",
              userId: "user-2",
              guestId: null,
              name: "박준호",
              email: "d@e.f",
              image: null,
            },
            {
              participantId: "part-3",
              userId: null,
              guestId: "guest-1",
              name: "박서준",
              email: null,
              image: null,
            },
          ],
        },
      },
    },
  }),
  useUpdateNote: () => ({ mutateAsync, isPending: false }),
  useReplaceNoteParticipants: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useReplaceNoteGuestParticipants: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreateNoteGuestParticipant: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspaceGuestsQueryKey: (workspaceId: string) => [
    "guests",
    workspaceId,
  ],
  useGetWorkspaceGuests: () => ({ isPending: false, data: undefined }),
}));
vi.mock("@/lib/api/generated/workspace-members/workspace-members", () => ({
  useGetWorkspaceMembers: () => ({ data: undefined }),
}));
vi.mock("@/lib/api/generated/projects/projects", () => ({
  useGetProject: () => ({
    data: {
      status: 200,
      data: { success: true, data: { projectId: PROJECT_ID, name: "주간" } },
    },
  }),
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { userId: "user-1", name: "김서연" } }),
}));
vi.mock("@/lib/ui/toast", () => ({ toast }));

function renderDetails() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NoteDetails noteId={NOTE_ID} workspaceId={WORKSPACE_ID} />
    </QueryClientProvider>
  );
}

describe("NoteDetails", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    toast.error.mockReset();
  });

  afterEach(cleanup);

  it("keeps the edited title and reports save failure through Sonner", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("save failed"));
    renderDetails();

    const title = screen.getByRole("textbox", { name: "제목" });
    fireEvent.change(title, { target: { value: "수정 중인 회의 제목" } });
    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "저장하지 못했습니다. 입력한 내용은 그대로 남아 있습니다.",
        { id: `note-save-${NOTE_ID}` }
      )
    );
    expect(title).toHaveValue("수정 중인 회의 제목");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("★ 저장에 성공하면 노트 단건과 목록 둘을 함께 무효화한다", async () => {
    mutateAsync.mockResolvedValueOnce({ status: 200 });
    const client = new QueryClient();
    const projectNotesKey = [`/v1/projects/${PROJECT_ID}/notes`];
    const workspaceNotesKey = [`/v1/workspaces/${WORKSPACE_ID}/notes`];
    client.setQueryData(projectNotesKey, { status: 200 });
    client.setQueryData(workspaceNotesKey, { status: 200 });
    render(
      <QueryClientProvider client={client}>
        <NoteDetails noteId={NOTE_ID} workspaceId={WORKSPACE_ID} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "변경사항 저장" }));

    await waitFor(() =>
      expect(client.getQueryState(projectNotesKey)?.isInvalidated).toBe(true)
    );
    expect(client.getQueryState(workspaceNotesKey)?.isInvalidated).toBe(true);
  });

  it("회의 정보를 카드 없는 키/값 표로 그린다", () => {
    const { container } = renderDetails();

    const facts = screen.getByRole("region", { name: "회의 정보" });
    expect(facts.querySelector(".rounded-block")).toBeNull();

    const rows = [...facts.querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(rows).toEqual([
      "진행자",
      "기록 길이",
      "공유 범위",
      "생성",
      "최종 수정",
    ]);
    expect(facts.querySelector("dt")?.className).toContain("w-[124px]");
    expect(container.querySelectorAll(".rounded-block")).toHaveLength(0);
  });

  it("기록 길이는 초 단위 timer로 남는다", () => {
    renderDetails();

    expect(screen.getByRole("timer", { name: "기록 길이" })).toHaveTextContent(
      "42:00"
    );
  });

  it("헤더가 이미 말하는 것을 표에 다시 적지 않는다", () => {
    renderDetails();

    const facts = screen.getByRole("region", { name: "회의 정보" });
    expect(facts).not.toHaveTextContent("회의 상태");
    expect(facts).not.toHaveTextContent("프로젝트");
    expect(facts).not.toHaveTextContent("시작 시각");
    expect(facts).not.toHaveTextContent("참석자");
    expect(screen.getByText("참석자")).toBeInTheDocument();
  });

  it("스켈레톤이 실제 화면의 뼈대를 그린다", () => {
    const { container } = render(<NoteDetailsSkeleton />);

    ["제목", "참석자"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { name: "회의 정보" })
    ).toBeInTheDocument();
    ["진행자", "기록 길이", "공유 범위", "생성", "최종 수정"].forEach(
      (label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    );
    expect(container.querySelectorAll("dd").length).toBe(5);
  });
});
