import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuestsSettings } from "@/components/settings/guests-settings";

const state = vi.hoisted(() => ({
  create: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: state.invalidate }),
}));
vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { userId: "U1" } }),
}));
vi.mock("@/lib/api/generated/workspace-members/workspace-members", () => ({
  useGetWorkspaceMembers: () => ({ data: undefined, isError: false }),
}));
// 목록은 자기 시험(workspace-guests-settings.test)이 본다. 여기서는 추가 흐름만 본다.
vi.mock("@/components/settings/workspace-guests-settings", () => ({
  WorkspaceGuestsSettings: () => null,
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspaceGuestsQueryKey: (id: string) => ["guests", id],
  useCreateWorkspaceGuest: () => ({
    mutateAsync: state.create,
    isPending: false,
  }),
}));

afterEach(() => {
  cleanup();
  state.create.mockReset();
  state.invalidate.mockReset();
});

function openAndSubmit(name: string) {
  render(<GuestsSettings workspaceId="W1" />);
  fireEvent.click(screen.getByRole("button", { name: "추가" }));
  fireEvent.change(screen.getByLabelText("이름"), { target: { value: name } });
  fireEvent.submit(screen.getByLabelText("이름").closest("form")!);
}

describe("GuestsSettings 임시 참여자 추가", () => {
  it("다듬은 이름으로 만들고 목록을 다시 읽은 뒤 닫는다", async () => {
    state.create.mockResolvedValue({
      status: 201,
      data: { success: true, data: { guestId: "G1" } },
    });

    openAndSubmit("  박서준 ");

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(state.create).toHaveBeenCalledWith({
      workspaceId: "W1",
      data: { displayName: "박서준" },
    });
    expect(state.invalidate).toHaveBeenCalledWith({
      queryKey: ["guests", "W1"],
    });
  });

  it("실패하면 닫지 않고 서버 문구를 남긴다", async () => {
    state.create.mockRejectedValue({
      success: false,
      error: {
        code: "WORKSPACE_NOT_FOUND",
        message: "워크스페이스를 찾을 수 없습니다.",
      },
    });

    openAndSubmit("박서준");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "워크스페이스를 찾을 수 없습니다."
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(state.invalidate).not.toHaveBeenCalled();
  });
});
