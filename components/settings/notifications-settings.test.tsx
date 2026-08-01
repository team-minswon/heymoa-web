import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationsSettings } from "@/components/settings/notifications-settings";

const mutate = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  isPending: false,
  variables: undefined as { data: Record<string, boolean> } | undefined,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/api/generated/users/users", () => ({
  getGetNotificationPreferencesQueryKey: () => ["notification-preferences"],
  useGetNotificationPreferencesSuspense: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          meetingStarted: true,
          analysisCompleted: true,
          analysisFailed: true,
          sharedChatMessage: false,
          workspaceInvitation: true,
          weeklyDigest: false,
        },
      },
    },
  }),
  useUpdateNotificationPreferences: () => ({
    mutate,
    isPending: state.isPending,
    variables: state.variables,
  }),
}));

function renderSettings() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsSettings />
    </QueryClientProvider>
  );
}

describe("NotificationsSettings", () => {
  afterEach(() => {
    cleanup();
    mutate.mockReset();
    state.isPending = false;
    state.variables = undefined;
  });

  it("draws the six events in their two groups", () => {
    renderSettings();

    expect(screen.getByText("앱 안에서")).toBeInTheDocument();
    expect(screen.getByText("메일로")).toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(6);
  });

  it("saves the whole set on every toggle, not just the changed key", () => {
    renderSettings();

    // 계약이 전체 치환이라 한 키만 보내면 나머지 다섯이 기본값으로 덮인다.
    fireEvent.click(screen.getAllByRole("switch")[3]);

    expect(mutate).toHaveBeenCalledWith({
      data: {
        meetingStarted: true,
        analysisCompleted: true,
        analysisFailed: true,
        sharedChatMessage: true,
        workspaceInvitation: true,
        weeklyDigest: false,
      },
    });
  });

  it("shows the pressed value while the save is in flight", () => {
    // 서버 값을 그리면 눌린 스위치가 한 번 되돌아갔다가 응답이 와서 다시 넘어간다.
    state.isPending = true;
    state.variables = {
      data: {
        meetingStarted: false,
        analysisCompleted: true,
        analysisFailed: true,
        sharedChatMessage: false,
        workspaceInvitation: true,
        weeklyDigest: false,
      },
    };
    renderSettings();

    expect(screen.getAllByRole("switch")[0]).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });
});
