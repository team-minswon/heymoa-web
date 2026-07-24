import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MembersSettings } from "@/components/settings/members-settings";

const state = vi.hoisted(() => ({
  myRole: "ADMIN" as "ADMIN" | "MEMBER",
  membersError: false,
  invitations: [] as unknown[],
  createError: null as unknown,
  createCalls: [] as unknown[],
  cancelMock: vi.fn(),
  invitationsEnabled: undefined as boolean | undefined,
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { userId: "user-12345" } }),
}));
vi.mock("@/lib/api/generated/workspace-members/workspace-members", () => ({
  useGetWorkspaceMembers: () => ({
    isLoading: false,
    isError: state.membersError,
    refetch: vi.fn(),
    data: state.membersError
      ? undefined
      : {
          status: 200,
          data: {
            success: true,
            data: {
              members: [
                {
                  userId: "user-12345",
                  name: "테스트 유저",
                  email: "me@heymoa.com",
                  role: state.myRole,
                  joinedAt: "2026-07-01T00:00:00Z",
                  image: null,
                },
                {
                  userId: "user-67890",
                  name: "김민수",
                  email: "minsu@heymoa.com",
                  role: "MEMBER",
                  joinedAt: "2026-07-05T00:00:00Z",
                  image: null,
                },
              ],
            },
          },
        },
  }),
}));
vi.mock(
  "@/lib/api/generated/workspace-invitations/workspace-invitations",
  () => ({
    getGetWorkspaceInvitationsQueryKey: (id: string) => ["invitations", id],
    useGetWorkspaceInvitations: (
      _id: string,
      options?: { query?: { enabled?: boolean } }
    ) => {
      state.invitationsEnabled = options?.query?.enabled;
      return {
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
        data: {
          status: 200,
          data: { success: true, data: { invitations: state.invitations } },
        },
      };
    },
    useCreateWorkspaceInvitation: () => ({
      isPending: false,
      mutateAsync: async (vars: unknown) => {
        state.createCalls.push(vars);
        if (state.createError) throw state.createError;
        return { status: 201 };
      },
    }),
    useCancelWorkspaceInvitation: () => ({
      isPending: false,
      mutate: state.cancelMock,
    }),
  })
);

function pendingInvite(overrides: Record<string, unknown> = {}) {
  return {
    invitationId: "inv-1",
    inviteeName: "이초대",
    inviteeEmail: "invitee@heymoa.com",
    inviteeImage: null,
    role: "MEMBER",
    inviterName: "테스트 유저",
    createdAt: "2026-07-20T00:00:00Z",
    ...overrides,
  };
}

function renderSettings() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MembersSettings workspaceId="01K0000000000" />
    </QueryClientProvider>
  );
}

async function invite(email: string) {
  fireEvent.change(screen.getByLabelText("초대할 이메일"), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "초대" }));
}

describe("MembersSettings", () => {
  beforeEach(() => {
    state.myRole = "ADMIN";
    state.membersError = false;
    state.invitations = [];
    state.createError = null;
    state.createCalls = [];
    state.cancelMock.mockReset();
    state.invitationsEnabled = undefined;
  });
  afterEach(cleanup);

  it("멤버 목록을 이름·이메일·역할로 그린다", () => {
    renderSettings();
    expect(screen.getByText("테스트 유저")).toBeTruthy();
    expect(screen.getByText("minsu@heymoa.com")).toBeTruthy();
    expect(screen.getByText("(나)")).toBeTruthy();
  });

  it("ADMIN이면 초대 폼을 보이고 MEMBER면 숨긴다", () => {
    const { rerender } = renderSettings();
    expect(screen.getByRole("button", { name: "초대" })).toBeTruthy();

    expect(state.invitationsEnabled).toBe(true);

    state.myRole = "MEMBER";
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <MembersSettings workspaceId="01K0000000000" />
      </QueryClientProvider>
    );
    expect(screen.queryByRole("button", { name: "초대" })).toBeNull();
    // ADMIN 전용 초대 목록 조회는 MEMBER에겐 아예 나가지 않는다.
    expect(state.invitationsEnabled).toBe(false);
  });

  it("초대하면 mutation을 이메일·역할과 함께 부른다", async () => {
    renderSettings();
    await invite("new@heymoa.com");
    await waitFor(() =>
      expect(state.createCalls).toContainEqual({
        workspaceId: "01K0000000000",
        data: { email: "new@heymoa.com", role: "MEMBER" },
      })
    );
  });

  it("이미 멤버(409)면 인라인으로 서버 문구를 보인다", async () => {
    state.createError = {
      success: false,
      data: null,
      error: {
        code: "ALREADY_WORKSPACE_MEMBER",
        message: "이미 워크스페이스 멤버입니다.",
      },
    };
    renderSettings();
    await invite("junho@heymoa.app");
    await waitFor(() =>
      expect(screen.getByText("이미 워크스페이스 멤버입니다.")).toBeTruthy()
    );
  });

  it("404면 대소문자 힌트를 덧붙인다", async () => {
    state.createError = {
      success: false,
      data: null,
      error: {
        code: "INVITEE_NOT_FOUND",
        message: "초대할 사용자를 찾을 수 없습니다.",
      },
    };
    renderSettings();
    await invite("Sora@Heymoa.app");
    await waitFor(() =>
      expect(
        screen.getByText(/철자와 대소문자를 확인해 주세요\./)
      ).toBeTruthy()
    );
  });

  it("이메일을 고치면 지난 초대 오류가 사라진다", async () => {
    state.createError = {
      success: false,
      data: null,
      error: {
        code: "ALREADY_WORKSPACE_MEMBER",
        message: "이미 워크스페이스 멤버입니다.",
      },
    };
    renderSettings();
    await invite("junho@heymoa.app");
    await waitFor(() =>
      expect(screen.getByText("이미 워크스페이스 멤버입니다.")).toBeTruthy()
    );
    fireEvent.change(screen.getByLabelText("초대할 이메일"), {
      target: { value: "junho2@heymoa.app" },
    });
    expect(screen.queryByText("이미 워크스페이스 멤버입니다.")).toBeNull();
  });

  it("대기 초대의 취소가 mutation을 부른다", () => {
    state.invitations = [pendingInvite()];
    renderSettings();
    expect(screen.getByText("invitee@heymoa.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(state.cancelMock).toHaveBeenCalledWith({
      workspaceId: "01K0000000000",
      invitationId: "inv-1",
    });
  });
});
