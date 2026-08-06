import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteDetails } from "@/components/notes/note-details";

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
            { userId: "user-1", name: "김서연", email: "a@b.c", image: null },
            { userId: "user-2", name: "박준호", email: "d@e.f", image: null },
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
}));
vi.mock(
  "@/lib/api/generated/workspace-members/workspace-members",
  () => ({ useGetWorkspaceMembers: () => ({ data: undefined }) })
);
// 프로젝트는 읽기 전용 한 줄로만 쓰인다 — 계약에 노트의 프로젝트를 바꾸는 길이 없다.
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
    fireEvent.click(screen.getByRole("button", { name: "변경 저장" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "저장하지 못했습니다. 입력한 내용은 유지됩니다.",
        { id: `note-save-${NOTE_ID}` }
      )
    );
    expect(title).toHaveValue("수정 중인 회의 제목");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("저장에 성공하면 노트 단건과 목록을 함께 무효화한다", async () => {
    mutateAsync.mockResolvedValueOnce({ status: 200 });
    const client = new QueryClient();
    const invalidate = vi
      .spyOn(client, "invalidateQueries")
      .mockResolvedValue(undefined);
    render(
      <QueryClientProvider client={client}>
        <NoteDetails noteId={NOTE_ID} workspaceId={WORKSPACE_ID} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "변경 저장" }));

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["note", NOTE_ID] });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["notes", PROJECT_ID],
      });
    });
  });

  /**
   * 정본 `M0Bfl`은 **카드 없는 키/값 표**다. 예전에는 제목·참여자·사실이 각자
   * `rounded-block` 상자에 들어 있어서, 카드 넷이 쌓이면 무엇이 편집이고 무엇이 읽기인지
   * 테두리로 구분되지 않았다. 지금은 편집만 컨트롤 테두리를 갖는다.
   */
  it("회의 정보를 카드 없는 키/값 표로 그린다", () => {
    const { container } = renderDetails();

    const facts = screen.getByRole("region", { name: "회의 정보" });
    expect(facts.querySelector(".rounded-block")).toBeNull();

    const rows = [...facts.querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(rows).toEqual([
      "회의 상태",
      "프로젝트",
      "시작 시각",
      "참석자",
      "진행자",
      "누적 기록 시간",
      "공유 범위",
      "생성",
      "최종 수정",
    ]);
    // 키 열은 124 고정이다 — 값이 세로로 훑혀야 한다.
    expect(facts.querySelector("dt")?.className).toContain("w-[124px]");
    expect(container.querySelectorAll(".rounded-block")).toHaveLength(0);
  });

  it("누적 기록 시간은 초 단위 timer로 남는다", () => {
    // 노트 헤더는 같은 값을 분 단위로 요약하고(「기록 42분」), 초 단위는 이 탭 하나뿐이다.
    renderDetails();

    expect(
      screen.getByRole("timer", { name: "누적 기록 시간" })
    ).toHaveTextContent("42:00");
  });

  it("프로젝트는 읽기 전용 한 줄이다 — 바꿀 컨트롤을 두지 않는다", () => {
    renderDetails();

    const facts = screen.getByRole("region", { name: "회의 정보" });
    expect(facts).toHaveTextContent("주간");
    expect(
      screen.queryByRole("combobox", { name: /프로젝트/ })
    ).not.toBeInTheDocument();
  });

  it("시작 전이면 시작 시각 자리에 그 사실을 적는다", () => {
    renderDetails();
    expect(screen.getByText(/2026년 7월 10일/)).toBeInTheDocument();
  });
});
