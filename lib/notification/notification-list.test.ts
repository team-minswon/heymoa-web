import { describe, expect, it } from "vitest";

import {
  countNewer,
  dayLabel,
  nextCursor,
  type NotificationItem,
} from "@/lib/notification/notification-list";

const item = (id: string, createdAt: string) =>
  ({ notificationId: id, createdAt }) as NotificationItem;

describe("notification-list", () => {
  it("dayLabel 은 서울 날짜로 오늘·어제·「10월 14일(수)」", () => {
    const now = new Date("2026-10-22T03:00:00Z"); // 서울 12시
    expect(dayLabel("2026-10-21T16:00:00Z", now)).toBe("오늘"); // 서울 22일 01시
    expect(dayLabel("2026-10-21T03:00:00Z", now)).toBe("어제");
    expect(dayLabel("2026-10-14T03:00:00Z", now)).toBe("10월 14일(수)");
  });

  it("countNewer 는 보던 목록 맨 위보다 새것만 센다", () => {
    const shown = [
      item("B", "2026-10-22T02:00:00Z"),
      item("A", "2026-10-22T01:00:00Z"),
    ];
    const head = [item("C", "2026-10-22T03:00:00Z"), ...shown];
    expect(countNewer(head, shown)).toBe(1);
    expect(countNewer(shown, [])).toBe(2);
  });

  it("nextCursor 는 커서 둘을 함께 싣고, 끝이면 없다", () => {
    const page = {
      notifications: [],
      unreadCount: 0,
      hasMore: true,
      nextCreatedAt: "2026-10-22T01:00:00Z",
      nextNotificationId: "A",
      serverTime: "2026-10-22T03:00:00Z",
    };
    expect(nextCursor(page)).toEqual({
      afterCreatedAt: "2026-10-22T01:00:00Z",
      afterNotificationId: "A",
    });
    expect(nextCursor({ ...page, hasMore: false })).toBeUndefined();
  });
});
