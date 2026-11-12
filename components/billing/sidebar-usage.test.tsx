/** 사이드바 사용량(APP-1596). 조회 훅을 바꿔 끼워 단계별 글·색·막대와 누르면 요금제를 여는지만 본다. */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarUsage } from "@/components/billing/sidebar-usage";

const query = vi.hoisted(() => ({
  usage: undefined as Record<string, unknown> | undefined,
}));
vi.mock("@/lib/api/generated/billing/billing", () => ({
  useGetRecordingUsage: () => ({
    data: query.usage
      ? { status: 200, data: { success: true, data: query.usage } }
      : undefined,
  }),
}));

const free = (used: number, remainingSamples: number) => ({
  enforced: true,
  unlimited: false,
  allowanceMinutes: 1200,
  usedMinutes: used,
  remainingMinutes: Math.max(0, 1200 - used),
  remainingSamples,
});
const renderIt = (onOpen = vi.fn()) => {
  render(
    <ul>
      <SidebarUsage workspaceId="01K0000000000" onOpen={onOpen} />
    </ul>
  );
  return onOpen;
};
const bar = () => screen.getByRole("progressbar").firstElementChild;

describe("SidebarUsage", () => {
  afterEach(() => {
    cleanup();
    query.usage = undefined;
  });

  it("불러오기 전·집행 대상이 아닌 공간에는 아무것도 그리지 않는다", () => {
    renderIt();
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    query.usage = { enforced: false, usedMinutes: null };
    renderIt();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("80% 미만은 쓴 양 / 한도와 기본색 막대이고, 누르면 요금제를 연다", () => {
    query.usage = free(720, 480 * 960000);
    const onOpen = renderIt();
    expect(screen.getByText("12시간 / 20시간")).toBeInTheDocument();
    expect(screen.getByText("이번 달 녹음")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "60"
    );
    expect(bar()).toHaveClass("bg-[var(--el-ink)]");
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("80% 이상은 남은 시간을 주의색으로", () => {
    query.usage = free(1020, 180 * 960000);
    renderIt();
    expect(screen.getByText("3시간 남음")).toHaveClass(
      "text-[var(--el-warning-strong)]"
    );
    expect(bar()).toHaveClass("bg-[var(--el-warning-strong)]");
  });

  it("다 쓰면 한도를 다 썼다고 위험색으로", () => {
    query.usage = free(1200, 0);
    renderIt();
    expect(screen.getByText("이번 달 한도를 다 썼습니다")).toHaveClass(
      "text-[var(--el-error-strong)]"
    );
    expect(bar()).toHaveClass("bg-[var(--el-error)]");
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100"
    );
  });

  it("Pro 는 막대 없이 한 줄", () => {
    query.usage = { enforced: true, unlimited: true, usedMinutes: 330 };
    renderIt();
    expect(screen.getByText("Pro · 이번 달 5시간 30분")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
