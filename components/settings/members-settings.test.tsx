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
  /** 서버는 가입순으로 내려주므로 내가 첫 줄이 아닐 수 있다. 그 경우를 재현한다. */
  meJoinedLast: false,
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
              members: (() => {
                const me = {
                  userId: "user-12345",
                  name: "테스트 유저",
                  email: "me@heymoa.com",
                  role: state.myRole,
                  joinedAt: "2026-07-01T00:00:00Z",
                  image: null,
                };
                const other = {
                  userId: "user-67890",
                  name: "김민수",
                  email: "minsu@heymoa.com",
                  role: "MEMBER" as const,
                  joinedAt: "2026-07-05T00:00:00Z",
                  image: null,
                };
                const third = {
                  userId: "user-24680",
                  name: "박서준",
                  email: "seojun@heymoa.com",
                  role: "MEMBER" as const,
                  joinedAt: "2026-07-09T00:00:00Z",
                  image: null,
                };
                return state.meJoinedLast
                  ? [other, third, me]
                  : [me, other, third];
              })(),
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
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
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
    state.meJoinedLast = false;
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

  // 계약은 가입순이라 늦게 합류하면 내 행이 목록 아래로 밀린다. 「나」 배지와 역할이 붙은
  // 행이라 제일 먼저 보여야 한다.
  it("가입이 늦어도 내 행을 맨 위로 올리고 나머지 순서는 서버 그대로 둔다", () => {
    state.meJoinedLast = true;
    renderSettings();

    const names = screen
      .getAllByRole("listitem")
      .map((row) => row.textContent ?? "");

    expect(names[0]).toContain("테스트 유저");
    expect(names[0]).toContain("(나)");
    // 나를 뽑아 올린 것뿐이고 남은 둘은 서버가 준 가입순 그대로다.
    expect(names[1]).toContain("김민수");
    expect(names[2]).toContain("박서준");
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

  it("미가입자 초대 행은 이메일을 주 텍스트로 보인다", () => {
    state.invitations = [
      pendingInvite({ inviteeName: null, inviteeEmail: "stranger@heymoa.dev" }),
    ];
    renderSettings();
    const email = screen.getByText("stranger@heymoa.dev");
    expect(email.className).toMatch(/font-medium/);
    expect(screen.getAllByText("stranger@heymoa.dev")).toHaveLength(1);
  });

  it("만료 지난 초대는 만료됨 배지를 보이고 취소 버튼은 남는다", () => {
    state.invitations = [
      pendingInvite({ expiresAt: "2026-07-01T00:00:00Z" }),
    ];
    renderSettings();
    expect(screen.getByText("만료됨")).toBeTruthy();
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  });
});
