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
  hasMore: false,
  loadingMore: false,
  partial: false,
  totalCount: null as number | null,
  pagesAsked: [] as number[],
  staleFailed: false,
  isFetching: false,
  preview: vi.fn(),
  link: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
}));

vi.mock("@/lib/workspace/use-guest-list-pages", () => ({
  useGuestListPages: (args: { pages: number }) => {
    state.pagesAsked.push(args.pages);
    return {
      isLoading: state.isLoading,
      isError: state.isError || state.staleFailed,
      isFetching: state.isFetching || state.loadingMore,
      isPlaceholderData: state.loadingMore,
      refetch: vi.fn(),
      data: state.isError
        ? undefined
        : {
            partial: state.partial,
            status: 200,
            data: {
              success: true,
              data: {
                guests: state.guests,
                totalCount: state.totalCount ?? state.guests.length,
                hasMore: state.hasMore,
                nextDisplayName: null,
                nextGuestId: null,
              },
            },
          },
    };
  },
}));

vi.mock("@/lib/workspace/use-rename-guest", () => ({
  useRenameGuest: () => ({ rename: state.rename, isPending: false }),
}));

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspaceGuestsQueryKey: (id: string) => ["guests", id],
  usePreviewWorkspaceGuestLink: () => ({
    mutateAsync: state.preview,
    isPending: false,
  }),
  useLinkWorkspaceGuest: () => ({ mutateAsync: state.link, isPending: false }),
  useDeleteWorkspaceGuest: () => ({
    mutateAsync: state.remove,
    isPending: false,
  }),
}));

vi.mock("@/lib/api/generated/workspace-members/workspace-members", () => ({
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
}));

const GUEST = {
  guestId: "01K0000000301",
  displayName: "박서준",
  noteCount: 3,
  createdAt: "2026-07-08T00:00:00Z",
};

function envelope(data: unknown) {
  return { status: 200, data: { success: true, data } };
}

async function pick(item: string) {
  fireEvent.click(screen.getByRole("button", { name: "박서준 관리" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: item }));
}

async function menuItem(item: string) {
  fireEvent.click(screen.getByRole("button", { name: "박서준 관리" }));
  return screen.findByRole("menuitem", { name: item });
}

function renderSection(canManage = true) {
  return render(
    <WorkspaceGuestsSettings
      workspaceId="01K0000000000"
      canManage={canManage}
    />
  );
}

describe("WorkspaceGuestsSettings", () => {
  beforeEach(() => {
    state.guests = [GUEST];
    state.isLoading = false;
    state.isError = false;
    state.hasMore = false;
    state.loadingMore = false;
    state.partial = false;
    state.totalCount = null;
    state.pagesAsked = [];
    state.preview.mockReset();
    state.link.mockReset();
    state.remove.mockReset();
    state.rename.mockReset();
    state.remove.mockResolvedValue(envelope({ affectedNoteCount: 3 }));
  });
  afterEach(cleanup);

  it("읽은 수가 아니라 서버가 센 전체 수를 말한다", () => {
    state.totalCount = 57;
    renderSection();

    expect(screen.getByText("57명")).toBeInTheDocument();
  });

  it("뒤에 더 있으면 버튼으로 다음 쪽을 요청한다", () => {
    state.hasMore = true;
    renderSection();
    expect(state.pagesAsked.at(-1)).toBe(1);

    fireEvent.click(
      screen.getByRole("button", { name: "임시 참여자 더 보기" })
    );

    expect(state.pagesAsked.at(-1)).toBe(2);
  });

  it("더 없으면 버튼이 없다", () => {
    renderSection();

    expect(
      screen.queryByRole("button", { name: "임시 참여자 더 보기" })
    ).toBeNull();
  });

  it("다음 쪽을 읽는 동안 버튼을 잠근다", () => {
    state.hasMore = true;
    state.loadingMore = true;
    renderSection();

    expect(screen.getByRole("button", { name: /불러오는 중/ })).toBeDisabled();
  });

  it("임시 참여자를 쓰이고 있는 회의록 수와 함께 그린다", () => {
    renderSection();

    expect(screen.getByText("박서준")).toBeInTheDocument();
    expect(screen.getByText("회의록 3개")).toBeInTheDocument();
  });

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

  it("리패치가 실패해도 캐시가 있으면 목록을 유지한다", () => {
    state.staleFailed = true;
    try {
      renderSection();

      expect(screen.getByText("박서준")).toBeInTheDocument();
      expect(
        screen.queryByText("임시 참여자를 불러오지 못했습니다.")
      ).toBeNull();
      expect(
        screen.getByText(/최신 목록을 확인하지 못해 연동하거나 삭제할 수 없습니다/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "다시 시도" })
      ).toBeInTheDocument();
    } finally {
      state.staleFailed = false;
    }
  });

  it("빈 목록을 캐시한 뒤 실패해도 빈 안내를 보인다", () => {
    state.guests = [];
    state.staleFailed = true;
    try {
      renderSection();

      expect(
        screen.getByText("아직 임시 참여자가 없습니다.")
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
    } finally {
      state.staleFailed = false;
    }
  });

  it("리패치가 실패하면 연동·삭제는 잠그고 이름 변경은 연다", async () => {
    state.staleFailed = true;
    try {
      renderSection();

      expect(await menuItem("삭제")).toHaveAttribute("aria-disabled", "true");
      expect(
        screen.getByRole("menuitem", { name: "계정과 연동" })
      ).toHaveAttribute("aria-disabled", "true");
      expect(
        screen.getByRole("menuitem", { name: "이름 변경" })
      ).not.toHaveAttribute("aria-disabled", "true");
    } finally {
      state.staleFailed = false;
    }
  });

  it("ADMIN이 아니면 목록은 보이고 관리 메뉴가 없다", () => {
    renderSection(false);

    expect(screen.getByText("박서준")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "박서준 관리" })).toBeNull();
  });

  describe("이름 변경", () => {
    async function openRename() {
      renderSection();
      await pick("이름 변경");
      return screen.getByRole("textbox", { name: "이름" });
    }

    it("대화상자에서 고치고 Enter 로 저장하면 응답 뒤에 닫는다", async () => {
      state.rename.mockResolvedValue(null);
      const input = await openRename();
      expect(input).toHaveValue("박서준");
      expect(screen.getByText("회의록 3개")).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "  박서준2 " } });
      fireEvent.submit(input.closest("form")!);

      await waitFor(() => expect(state.rename).toHaveBeenCalledWith("박서준2"));
      await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    });

    it("실패하면 닫지 않고 서버 문구를 그 안에 보인다", async () => {
      state.rename.mockResolvedValue("권한이 없습니다.");
      const input = await openRename();

      fireEvent.change(input, { target: { value: "박서준3" } });
      fireEvent.click(screen.getByRole("button", { name: "저장" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "권한이 없습니다."
      );
      expect(screen.getByRole("textbox", { name: "이름" })).toHaveValue(
        "박서준3"
      );
    });

    it("빈 값·바뀌지 않은 값이면 저장을 잠근다", async () => {
      const input = await openRename();
      const save = screen.getByRole("button", { name: "저장" });
      expect(save).toBeDisabled();

      fireEvent.change(input, { target: { value: "   " } });
      expect(save).toBeDisabled();
      fireEvent.submit(input.closest("form")!);
      expect(state.rename).not.toHaveBeenCalled();
    });

    it("이름은 30자까지 받고 글자 수를 보인다", async () => {
      const input = await openRename();
      expect(input).toHaveAttribute("maxLength", "30");
      expect(screen.getByText("3/30")).toBeInTheDocument();
    });

    it("취소하면 요청하지 않고 닫는다", async () => {
      const input = await openRename();
      fireEvent.change(input, { target: { value: "다른 이름" } });
      fireEvent.click(screen.getByRole("button", { name: "취소" }));

      await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
      expect(state.rename).not.toHaveBeenCalled();
    });
  });

  it("연동은 멤버를 고른 뒤 미리보기를 먼저 보여준다", async () => {
    state.preview.mockResolvedValue(
      envelope({
        changedNoteCount: 2,
        changedNotes: [],
      })
    );
    renderSection();

    await pick("계정과 연동");
    fireEvent.click(screen.getByRole("button", { name: /한지원/ }));

    await waitFor(() =>
      expect(screen.getByText("회의록 2개가 바뀝니다.")).toBeInTheDocument()
    );
    expect(screen.getByText("되돌릴 수 없습니다.")).toBeInTheDocument();
    expect(state.link).not.toHaveBeenCalled();
  });

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

    await pick("계정과 연동");
    fireEvent.click(screen.getByRole("button", { name: /한지원/ }));
    await screen.findByText("회의록 3개가 바뀝니다.");
    fireEvent.click(screen.getByRole("button", { name: "연동" }));

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

    await pick("계정과 연동");
    fireEvent.click(screen.getByRole("button", { name: /한지원/ }));
    await screen.findByText("회의록 2개가 바뀝니다.");
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(state.link).not.toHaveBeenCalled();
  });

  it("삭제 전에 쓰이고 있는 회의록 수를 보여준다", async () => {
    renderSection();

    await pick("삭제");

    expect(
      screen.getByText(/회의록 3개에서 이 사람이 사라지고/)
    ).toBeInTheDocument();
    expect(screen.getByText(/되돌릴 수 없습니다/)).toBeInTheDocument();
  });

  it("남이 먼저 지웠으면 창을 닫지 않고 그렇다고 말한다", async () => {
    const { rerender } = renderSection();

    await pick("삭제");
    expect(
      screen.getByText(/회의록 3개에서 이 사람이 사라지고/)
    ).toBeInTheDocument();

    state.guests = [];
    rerender(<WorkspaceGuestsSettings workspaceId="01K0000000000" canManage />);

    expect(screen.getByText(/이미 지워졌습니다/)).toBeInTheDocument();
    const confirm = screen.getAllByRole("button", { name: "삭제" }).at(-1)!;
    expect(confirm).toBeDisabled();
  });

  it("더 읽을 쪽이 있는데 그 사람이 안 보이면 지워졌다고 하지 않고 확인하지 못했다고 말한다", async () => {
    state.hasMore = true;
    const { rerender } = renderSection();
    await pick("삭제");

    state.guests = [];
    rerender(<WorkspaceGuestsSettings workspaceId="01K0000000000" canManage />);

    expect(screen.queryByText(/이미 지워졌습니다/)).toBeNull();
    expect(
      screen.getByText(/영향 범위를 확인하지 못했습니다/)
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "다시 시도" }).length
    ).toBeGreaterThan(0);
  });

  it("뒷쪽을 못 읽었으면 목록 위에 그렇다고 알리고 연동·삭제를 잠근다", async () => {
    state.partial = true;
    renderSection();

    expect(screen.getByRole("alert")).toHaveTextContent(
      /끝까지 불러오지 못해 연동하거나 삭제할 수 없습니다/
    );
    expect(await menuItem("삭제")).toHaveAttribute("aria-disabled", "true");
  });

  it("삭제를 확인하면 mutation 을 부른다", async () => {
    renderSection();

    await pick("삭제");
    fireEvent.click(screen.getAllByRole("button", { name: "삭제" }).at(-1)!);

    await waitFor(() =>
      expect(state.remove).toHaveBeenCalledWith({
        workspaceId: "01K0000000000",
        guestId: "01K0000000301",
      })
    );
  });
});
