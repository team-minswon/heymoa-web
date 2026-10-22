import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationRow } from "@/components/notification/notification-row";
import type { NotificationItem } from "@/lib/notification/notification-list";

const base: NotificationItem = {
  notificationId: "N1",
  type: "WORKSPACE_INVITATION",
  readAt: null,
  createdAt: "2026-10-22T02:00:00Z",
  invitation: null,
  payload: null,
};

function row(readAt: string | null) {
  return (
    <ul>
      <NotificationRow
        notification={{ ...base, readAt }}
        view={{ title: "알림", workspaceName: "제품 팀" }}
        timeLabel="오전 11:00"
        highlighted={false}
        onRead={() => {}}
      />
    </ul>
  );
}

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: reduce } as MediaQueryList)
  );
}

const phase = () =>
  screen.getByRole("listitem").getAttribute("data-read-phase");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("읽음 전환", () => {
  it("읽으면 점과 내용이 점 칸만큼 왼쪽으로 밀린 뒤 끝나는 프레임에 점 칸을 뺀다", () => {
    vi.useFakeTimers();
    setReducedMotion(false);
    const { rerender } = render(row(null));
    expect(phase()).toBe("unread");
    rerender(row("2026-10-22T03:00:00Z"));
    expect(phase()).toBe("leaving");
    const dot = screen.getByRole("button", { name: "읽음으로 표시" });
    expect(dot.style.transform).toBe("translateX(-17px)");
    expect(dot.style.opacity).toBe("0");
    act(() => vi.advanceTimersByTime(180));
    expect(phase()).toBe("read");
    expect(screen.queryByRole("button", { name: "읽음으로 표시" })).toBeNull();
  });

  it("움직임 줄이기면 애니메이션 없이 바로 사라진다", () => {
    setReducedMotion(true);
    const { rerender } = render(row(null));
    rerender(row("2026-10-22T03:00:00Z"));
    expect(phase()).toBe("read");
    expect(screen.queryByRole("button", { name: "읽음으로 표시" })).toBeNull();
  });

  it("다시 안 읽음이 되면 점이 왼쪽에서 들어온다", async () => {
    setReducedMotion(false);
    const { rerender } = render(row("2026-10-22T03:00:00Z"));
    rerender(row(null));
    expect(phase()).toBe("entering");
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    expect(phase()).toBe("unread");
  });
});
