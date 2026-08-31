import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceGuestsSettings } from "@/components/settings/workspace-guests-settings";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

const state = vi.hoisted(() => ({
  guests: [] as Array<{
    guestId: string;
    displayName: string;
    noteCount: number;
    createdAt: string;
  }>,
  isLoading: false,
  isError: false,
  /** **캐시를 든 채 리패치만 실패한 상태.** `data` 는 살아 있고 `isError` 만 참이다. */
  staleFailed: false,
  isFetching: false,
  preview: vi.fn(),
  link: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspaceGuestsQueryKey: (id: string) => ["guests", id],
  useGetWorkspaceGuests: () => ({
    isLoading: state.isLoading,
    isError: state.isError || state.staleFailed,
    isFetching: state.isFetching,
    refetch: vi.fn(),
    data: state.isError
      ? undefined
      : {
          status: 200,
          data: { success: true, data: { guests: state.guests } },
        },
  }),
  usePreviewWorkspaceGuestLink: () => ({
    mutateAsync: state.preview,
    isPending: false,
  }),
  useLinkWorkspaceGuest: () => ({ mutateAsync: state.link, isPending: false }),
  useDeleteWorkspaceGuest: () => ({ mutateAsync: state.remove, isPending: false }),
}));

vi.mock(
  "@/lib/api/generated/workspace-members/workspace-members",
  () => ({
    useGetWorkspaceMembers: () => ({
      data: {
        status: 200,
        data: {
          success: true,
          data: {
            members: [
              {
                userId: "01K0000000001",
                name: "한지원",
                email: "jiwon@heymoa.com",
                image: null,
                role: "ADMIN",
                joinedAt: "2026-07-01T00:00:00Z",
              },
            ],
          },
        },
      },
    }),
  })
);

const GUEST = {
  guestId: "01K0000000301",
  displayName: "박서준",
  noteCount: 3,
  createdAt: "2026-07-08T00:00:00Z",
};

function envelope(data: unknown) {
  return { status: 200, data: { success: true, data } };
}

function renderSection(canManage = true) {
  return render(
    <WorkspaceGuestsSettings workspaceId="01K0000000000" canManage={canManage} />
  );
}

describe("WorkspaceGuestsSettings", () => {
  beforeEach(() => {
    state.guests = [GUEST];
    state.isLoading = false;
    state.isError = false;
    state.preview.mockReset();
    state.link.mockReset();
    state.remove.mockReset();
    state.remove.mockResolvedValue(envelope({ affectedNoteCount: 3 }));
  });
  afterEach(cleanup);

  it("임시 참여자를 쓰이고 있는 회의록 수와 함께 그린다", () => {
    renderSection();

    expect(screen.getByText("박서준")).toBeInTheDocument();
    expect(screen.getByText("회의록 3개")).toBeInTheDocument();
  });

  /** 빈 상태는 오류가 아니다 — 한 명도 없는 것이 정상이다. */
  it("한 명도 없으면 오류가 아니라 빈 안내를 보인다", () => {
    state.guests = [];
    renderSection();

    expect(
      screen.getByText("아직 임시 참여자가 없습니다.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("불러오지 못하면 다시 시도를 준다", () => {
    state.isError = true;
    renderSection();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "다시 시도" })
    ).toBeInTheDocument();
  });

  /**
   * **캐시를 든 채 리패치만 실패한 상태.** `data` 는 살아 있고 `isError` 만 참이다.
   *
   * 이때 목록을 오류 화면으로 덮으면 이미 보이던 임시 참여자가 **재시도가 성공할 때까지
   * 통째로 사라진다.** 「실패」와 「들고 있는 것이 없다」는 다른 상태다.
   */
  it("리패치가 실패해도 캐시가 있으면 목록을 유지한다", () => {
    state.staleFailed = true;
    try {
      renderSection();

      expect(screen.getByText("박서준")).toBeInTheDocument();
      // **오류 화면으로 바뀌지 않는다.** 목록을 통째로 덮는 분기는 안 탄다
      expect(
        screen.queryByText("임시 참여자를 불러오지 못했습니다.")
      ).toBeNull();
      // **다만 왜 관리가 잠겼는지는 말한다.** 안 그러면 권한이 사라진 것으로 읽는다
      expect(
        screen.getByText(/최신 목록을 확인하지 못해 연동·삭제를 잠갔습니다/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "다시 시도" })
      ).toBeInTheDocument();
    } finally {
      state.staleFailed = false;
    }
  });

  /**
   * **정상적으로 빈 목록**을 캐시한 뒤 실패한 경우다. 길이로 캐시 유무를 판정하면 이때
   * 빈 안내 대신 오류가 뜬다 — 성공 응답을 든 적이 있는가로 갈라야 한다.
   */
  it("빈 목록을 캐시한 뒤 실패해도 빈 안내를 보인다", () => {
    state.guests = [];
    state.staleFailed = true;
    try {
      renderSection();

      expect(screen.getByText("아직 임시 참여자가 없습니다.")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      state.staleFailed = false;
    }
  });

  /** 다만 **지우지는 못한다.** 확인창의 「회의록 N개」가 낡았을 수 있다. */
  it("리패치가 실패하면 연동·삭제는 잠근다", () => {
    state.staleFailed = true;
    try {
      renderSection();

      expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
      expect(screen.queryByRole("button", { name: "연동" })).toBeNull();
    } finally {
      state.staleFailed = false;
    }
  });

  /**
   * **목록은 전원이 본다.** 참석자 후보를 세우는 데 쓰이고 그 이름은 어차피 회의록에서
   * 보인다. 관리(연동·삭제)만 ADMIN이다.
   */
  it("ADMIN이 아니면 목록은 보이고 연동·삭제만 사라진다", () => {
    renderSection(false);

    expect(screen.getByText("박서준")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "연동" })).toBeNull();
    expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
  });

  it("연동은 멤버를 고른 뒤 미리보기를 먼저 보여준다", async () => {
    state.preview.mockResolvedValue(
      envelope({
        changedNoteCount: 2,
        changedNotes: [],
      })
    );
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "연동" }));
    fireEvent.click(screen.getByRole("button", { name: /한지원/ }));

    await waitFor(() =>
      expect(screen.getByText("회의록 2개가 바뀝니다.")).toBeInTheDocument()
    );
    // **되돌릴 수 없다는 사실**이 함께 보여야 한다 — 되돌리기를 안 만든 근거가 이 화면이다.
    expect(screen.getByText("되돌릴 수 없습니다.")).toBeInTheDocument();
    // 미리보기는 아무것도 안 바꾼다.
    expect(state.link).not.toHaveBeenCalled();
  });

  /**
   * **미리보기 숫자를 최종 결과로 쓰지 않는다.** 그 사이에 다른 사람이 화자를 고치면
   * 숫자가 달라지고, 그러면 사람이 본 것과 일어난 일이 어긋난다.
   */
  it("실행 결과가 미리보기와 다르면 실행 결과를 보여준다", async () => {
    state.preview.mockResolvedValue(
      envelope({
        changedNoteCount: 3,
        changedNotes: [],
      })
    );
    state.link.mockResolvedValue(
      envelope({
        changedNoteCount: 2,
        changedNotes: [],
      })
    );
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "연동" }));
    fireEvent.click(screen.getByRole("button", { name: /한지원/ }));
    await screen.findByText("회의록 3개가 바뀝니다.");
    fireEvent.click(screen.getByRole("button", { name: "연동" }));

    // 미리보기의 3이 아니라 실제로 바뀐 2다.
    await waitFor(() =>
      expect(screen.getByText("회의록 2개가 바뀌었습니다.")).toBeInTheDocument()
    );
    expect(screen.queryByText("되돌릴 수 없습니다.")).toBeNull();
  });

  it("취소하면 아무것도 안 바뀐다", async () => {
    state.preview.mockResolvedValue(
      envelope({
        changedNoteCount: 2,
        changedNotes: [],
      })
    );
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "연동" }));
    fireEvent.click(screen.getByRole("button", { name: /한지원/ }));
    await screen.findByText("회의록 2개가 바뀝니다.");
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(state.link).not.toHaveBeenCalled();
  });

  it("삭제 전에 쓰이고 있는 회의록 수를 보여준다", () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(
      screen.getByText(/회의록 3개에서 이 사람이 사라지고/)
    ).toBeInTheDocument();
    expect(screen.getByText(/되돌릴 수 없습니다/)).toBeInTheDocument();
  });

  /**
   * **확인창이 목록 밖에 살아야 하는 이유다.** 행 안에 두면, 남이 먼저 지워 목록에서 그
   * 행이 사라지는 순간 확인창까지 함께 언마운트돼 **설명 없이 닫힌다.**
   */
  it("남이 먼저 지웠으면 창을 닫지 않고 그렇다고 말한다", () => {
    const { rerender } = renderSection();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(screen.getByText(/회의록 3개에서 이 사람이 사라지고/)).toBeInTheDocument();

    // 그 사이 남이 먼저 지웠다 — 목록에서 사라진다
    state.guests = [];
    rerender(
      <WorkspaceGuestsSettings workspaceId="01K0000000000" canManage />
    );

    expect(screen.getByText(/이미 지워졌습니다/)).toBeInTheDocument();
    const confirm = screen.getAllByRole("button", { name: "삭제" }).at(-1)!;
    expect(confirm).toBeDisabled();
  });

  it("삭제를 확인하면 mutation 을 부른다", async () => {
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(screen.getAllByRole("button", { name: "삭제" }).at(-1)!);

    await waitFor(() =>
      expect(state.remove).toHaveBeenCalledWith({
        workspaceId: "01K0000000000",
        guestId: "01K0000000301",
      })
    );
  });
});
