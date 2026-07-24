import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "@/components/notification/notification-bell";

const state = vi.hoisted(() => ({
  notifications: [] as unknown[],
  unreadCount: 0,
  isLoading: false,
  isError: false,
  markMock: vi.fn(),
  acceptMock: vi.fn(),
  declineMock: vi.fn(),
  acceptError: null as unknown,
}));
const toastError = vi.hoisted(() => vi.fn());
const refetchMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: { error: toastError } }));

vi.mock("@/lib/api/generated/notifications/notifications", () => ({
  getGetNotificationsQueryKey: () => ["notifications"],
  useGetNotifications: () => ({
    isLoading: state.isLoading,
    isError: state.isError,
    refetch: refetchMock,
    data: state.isError
      ? undefined
      : {
          status: 200,
          data: {
            success: true,
            data: {
              unreadCount: state.unreadCount,
              notifications: state.notifications,
            },
          },
        },
  }),
  useMarkNotificationRead: () => ({ mutate: state.markMock, isPending: false }),
}));
vi.mock("@/lib/api/generated/workspace-invitations/workspace-invitations", () => ({
  useAcceptWorkspaceInvitation: () => ({
    mutate: (vars: unknown, options?: { onError?: (e: unknown) => void }) => {
      state.acceptMock(vars);
      if (state.acceptError) options?.onError?.(state.acceptError);
    },
    isPending: false,
  }),
  useDeclineWorkspaceInvitation: () => ({
    mutate: state.declineMock,
    isPending: false,
  }),
}));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspacesQueryKey: () => ["workspaces"],
}));

function invitation(status: string, readAt: string | null = null) {
  return {
    notificationId: `n-${status}`,
    type: "WORKSPACE_INVITATION",
    createdAt: "2026-07-24T00:00:00Z",
    readAt,
    invitation: {
      invitationId: "inv-1",
      inviterName: "김민수",
      workspaceName: "제품 팀",
      workspaceId: "01K0000000000",
      role: "MEMBER",
      status,
    },
  };
}

function renderBell() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationBell />
    </QueryClientProvider>
  );
}

async function openBell() {
  fireEvent.click(screen.getByRole("button", { name: /알림/ }));
  await screen.findByText("알림");
}

describe("NotificationBell", () => {
  beforeEach(() => {
    state.notifications = [];
    state.unreadCount = 0;
    state.isLoading = false;
    state.isError = false;
    state.acceptError = null;
    state.markMock.mockReset();
    state.acceptMock.mockReset();
    state.declineMock.mockReset();
    toastError.mockReset();
    refetchMock.mockReset();
  });
  afterEach(cleanup);

  it("unreadCount 배지를 보이고, 0이면 숨긴다", () => {
    state.unreadCount = 2;
    const { rerender } = renderBell();
    expect(screen.getByText("2")).toBeTruthy();

    state.unreadCount = 0;
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <NotificationBell />
      </QueryClientProvider>
    );
    expect(screen.queryByText("2")).toBeNull();
  });

  it("PENDING 초대는 수락/거절 버튼을 주고 수락이 mutation을 부른다", async () => {
    state.notifications = [invitation("PENDING")];
    state.unreadCount = 1;
    renderBell();
    await openBell();
    expect(screen.getByText(/제품 팀/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "수락" }));
    expect(state.acceptMock).toHaveBeenCalledWith({ invitationId: "inv-1" });
    // 확정하면 그 알림도 읽는다 — 배지·dot이 줄어들도록.
    expect(state.markMock).toHaveBeenCalledWith(
      { notificationId: "n-PENDING" },
      expect.anything()
    );
  });

  it("해결된 초대는 버튼 대신 상태 라벨을 보인다", async () => {
    state.notifications = [invitation("ACCEPTED", "2026-07-24T01:00:00Z")];
    renderBell();
    await openBell();
    expect(screen.getByText("수락함")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "수락" })).toBeNull();
  });

  it("이미 처리된 초대(409)면 상단 안내를 보인다", async () => {
    state.notifications = [invitation("PENDING")];
    state.acceptError = {
      success: false,
      data: null,
      error: { code: "INVITATION_NOT_PENDING", message: "이미 처리됨" },
    };
    renderBell();
    await openBell();
    fireEvent.click(screen.getByRole("button", { name: "수락" }));
    await waitFor(() =>
      expect(screen.getByText("이미 처리된 초대입니다.")).toBeTruthy()
    );
    // 409는 인라인으로만 — 전역 토스트와 겹치면 안 된다.
    expect(toastError).not.toHaveBeenCalled();
  });

  it("409가 아닌 실패는 토스트로 띄운다", async () => {
    state.notifications = [invitation("PENDING")];
    state.acceptError = {
      success: false,
      data: null,
      error: { code: "INTERNAL_ERROR", message: "일시적 오류" },
    };
    renderBell();
    await openBell();
    fireEvent.click(screen.getByRole("button", { name: "수락" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("일시적 오류"));
    expect(screen.queryByText("이미 처리된 초대입니다.")).toBeNull();
  });

  it("미읽음 dot(읽음 표시) 버튼을 누르면 읽음 처리한다", async () => {
    state.notifications = [invitation("ACCEPTED", null)];
    renderBell();
    await openBell();
    fireEvent.click(screen.getByRole("button", { name: "읽음으로 표시" }));
    expect(state.markMock).toHaveBeenCalledWith(
      { notificationId: "n-ACCEPTED" },
      expect.anything()
    );
  });

  it("PENDING 초대도 읽음 표시 버튼으로 읽을 수 있다", async () => {
    state.notifications = [invitation("PENDING", null)];
    renderBell();
    await openBell();
    fireEvent.click(screen.getByRole("button", { name: "읽음으로 표시" }));
    expect(state.markMock).toHaveBeenCalledWith(
      { notificationId: "n-PENDING" },
      expect.anything()
    );
  });

  it("알림이 없으면 빈 상태 문구를 보인다", async () => {
    renderBell();
    await openBell();
    expect(screen.getByText("아직 알림이 없습니다.")).toBeTruthy();
  });

  it("벨을 열면 최신 알림을 다시 가져온다", async () => {
    renderBell();
    await openBell();
    expect(refetchMock).toHaveBeenCalled();
  });
});
