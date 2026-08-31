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
            // 계정 없는 참여자도 이 표에 선다 (APP-490).
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

    // **표는 헤더가 말하지 않은 것만 담는다.** 회의 상태·프로젝트·시작 시각·참석자는
    // 바로 위 노트 헤더에 같은 모양으로 이미 있고(칩·pill·메타 두 줄), 참석자는 이 탭의
    // 편집 필드에도 있어서 세 번 나왔다.
    const rows = [...facts.querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(rows).toEqual([
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

  it("헤더가 이미 말하는 것을 표에 다시 적지 않는다", () => {
    renderDetails();

    const facts = screen.getByRole("region", { name: "회의 정보" });
    // 상태·프로젝트·시작 시각은 노트 헤더의 칩·pill·메타 줄이 갖는다.
    expect(facts).not.toHaveTextContent("회의 상태");
    expect(facts).not.toHaveTextContent("프로젝트");
    expect(facts).not.toHaveTextContent("시작 시각");
    // 참석자는 편집 필드가 갖는다 — 표에 읽기 전용으로 또 두면 한 화면에 세 번이 된다.
    expect(facts).not.toHaveTextContent("참석자");
    expect(screen.getByText("참석자")).toBeInTheDocument();
  });

  /**
   * **스켈레톤은 데이터만 가린다.** 손으로 막대 셋을 쌓았을 때 296이었고 실제는 568이었다 —
   * 라벨·저장 버튼·「회의 정보」 머리글이 없고 표 다섯 줄이 `h-40` 한 덩어리였다.
   *
   * jsdom은 px를 못 재니 **같은 뼈대를 그리는지**로 검사한다. 실제 화면과 같은 라벨·머리글·
   * 행 수가 나오면 기하는 같은 wrapper(`Field`·`Fact`)가 보장한다.
   */
  it("스켈레톤이 실제 화면의 뼈대를 그린다", () => {
    const { container } = render(<NoteDetailsSkeleton />);

    ["제목", "참석자"].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { name: "회의 정보" })
    ).toBeInTheDocument();
    ["진행자", "누적 기록 시간", "공유 범위", "생성", "최종 수정"].forEach(
      (label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    );
    // 사실 표는 다섯 줄이다 — 한 덩어리로 대신하면 도착할 때 높이가 두 배가 된다.
    expect(container.querySelectorAll("dd").length).toBe(5);
  });
});
