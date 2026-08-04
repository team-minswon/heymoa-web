import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InviteLanding } from "@/components/workspace/invite-landing";

const state = vi.hoisted(() => ({
  authStatus: "authenticated" as "checking" | "authenticated" | "anonymous",
  mutateMock: vi.fn(),
  mutationError: null as unknown,
  isPending: false,
}));
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ status: state.authStatus, user: null }),
}));

vi.mock(
  "@/lib/api/generated/workspace-invitations/workspace-invitations",
  () => ({
    useAcceptInvitationByToken: () => ({
      mutateAsync: (vars: unknown) => {
        state.mutateMock(vars);
        if (state.mutationError) {
          return Promise.reject(state.mutationError);
        }
        return Promise.resolve({
          status: 200,
          data: {
            success: true,
            data: {
              invitationId: "01K0000000021",
              workspaceId: "01K0000000030",
              role: "MEMBER",
              status: "ACCEPTED",
            },
          },
        });
      },
      isPending: state.isPending,
    }),
  })
);

function envelopeError(code: string, message: string) {
  return { success: false, data: null, error: { code, message, details: null } };
}

function renderLanding(token: string | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <InviteLanding token={token} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  state.authStatus = "authenticated";
  state.mutationError = null;
  state.isPending = false;
  state.mutateMock.mockClear();
  replaceMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("InviteLanding", () => {
  it("토큰이 없으면 유효하지 않은 링크 안내를 보여주고 수락을 호출하지 않는다", () => {
    renderLanding(null);

    expect(screen.getByText(/유효하지 않은 초대 링크/)).toBeTruthy();
    expect(state.mutateMock).not.toHaveBeenCalled();
  });

  it("미로그인이면 구글 로그인 버튼이 토큰을 returnTo로 보존한다", () => {
    state.authStatus = "anonymous";

    renderLanding("abc123");

    const link = screen.getByRole("link", { name: /Google로 계속하기/ });
    expect(link.getAttribute("href")).toContain(
      encodeURIComponent("/invite?token=abc123")
    );
    expect(state.mutateMock).not.toHaveBeenCalled();
  });

  it("로그인 상태면 토큰으로 자동 수락하고 워크스페이스로 이동한다", async () => {
    renderLanding("abc123");

    await waitFor(() => {
      expect(state.mutateMock).toHaveBeenCalledTimes(1);
    });
    expect(state.mutateMock).toHaveBeenCalledWith({
      data: { token: "abc123" },
    });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/w/01K0000000030");
    });
  });

  it("만료된 초대는 재초대 안내를 보여준다", async () => {
    state.mutationError = envelopeError("INVITATION_EXPIRED", "만료된 초대입니다.");

    renderLanding("abc123");

    expect(await screen.findByText(/초대가 만료되었습니다/)).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("다른 계정으로 로그인했으면 계정 안내를 보여준다", async () => {
    state.mutationError = envelopeError(
      "INVITATION_EMAIL_MISMATCH",
      "초대 대상 이메일이 아닙니다."
    );

    renderLanding("abc123");

    expect(await screen.findByText(/다른 이메일 계정용/)).toBeTruthy();
  });

  it("이미 멤버면 홈으로 가는 안내를 보여준다", async () => {
    state.mutationError = envelopeError(
      "ALREADY_WORKSPACE_MEMBER",
      "이미 워크스페이스 멤버입니다."
    );

    renderLanding("abc123");

    expect(await screen.findByText(/이미 이 워크스페이스의 멤버/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /홈으로/ })).toBeTruthy();
  });
});
