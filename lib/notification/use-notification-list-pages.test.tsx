import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationListPages } from "@/lib/notification/use-notification-list-pages";

const getNotifications = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/generated/notifications/notifications", () => ({
  getGetNotificationsQueryKey: () => ["/v1/notifications"],
  getNotifications: (...args: unknown[]) => getNotifications(...args),
}));

const item = (notificationId: string) => ({
  notificationId,
  type: "WORKSPACE_INVITATION",
  readAt: null,
  createdAt: "2026-07-01T00:00:00Z",
  invitation: null,
});
const page = (ids: string[], hasMore: boolean, unreadCount = 5) => ({
  status: 200,
  headers: new Headers(),
  data: {
    success: true,
    error: null,
    data: {
      notifications: ids.map(item),
      unreadCount,
      hasMore,
      nextCreatedAt: hasMore ? "2026-07-01T00:00:00Z" : null,
      nextNotificationId: hasMore ? ids.at(-1) : null,
    },
  },
});

function run(pages: number) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useNotificationListPages({ pages }), { wrapper });
}

describe("useNotificationListPages", () => {
  beforeEach(() => getNotifications.mockReset());

  it("쪽 수만큼 커서를 이어 읽어 한 응답으로 붙인다", async () => {
    getNotifications
      .mockResolvedValueOnce(page(["N2"], true))
      .mockResolvedValueOnce(page(["N1"], false, 4));
    const { result } = run(2);

    await waitFor(() => expect(result.current.data).toBeDefined());

    const data = result.current.data;
    expect(
      data?.status === 200 &&
        data.data.data.notifications.map((n) => n.notificationId)
    ).toEqual(["N2", "N1"]);
    expect(data?.status === 200 && data.data.data.hasMore).toBe(false);
    expect(data?.status === 200 && data.data.data.unreadCount).toBe(4);
    expect(getNotifications.mock.calls[0]?.[0]).toBeUndefined();
    expect(getNotifications.mock.calls[1]?.[0]).toEqual({
      afterCreatedAt: "2026-07-01T00:00:00Z",
      afterNotificationId: "N2",
    });
  });

  it("뒷쪽이 실패하면 읽은 곳까지만 돌려주고 더 있음을 남긴다", async () => {
    getNotifications
      .mockResolvedValueOnce(page(["N2"], true))
      .mockRejectedValueOnce(new Error("network"));
    const { result } = run(2);

    await waitFor(() => expect(result.current.data).toBeDefined());

    const data = result.current.data;
    expect(data?.status === 200 && data.data.data.notifications).toHaveLength(
      1
    );
    expect(data?.status === 200 && data.data.data.hasMore).toBe(true);
    expect(result.current.data?.partial).toBe(true);
  });
});
