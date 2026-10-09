import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGuestListPages } from "@/lib/workspace/use-guest-list-pages";

const getWorkspaceGuests = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspaceGuestsQueryKey: (id: string) => [
    `/v1/workspaces/${id}/guests`,
  ],
  getWorkspaceGuests: (...args: unknown[]) => getWorkspaceGuests(...args),
}));

const guest = (guestId: string, displayName: string) => ({
  guestId,
  displayName,
  noteCount: 1,
  createdAt: "2026-07-01T00:00:00Z",
});
const page = (
  guests: ReturnType<typeof guest>[],
  hasMore: boolean,
  totalCount = 3
) => ({
  status: 200,
  headers: new Headers(),
  data: {
    success: true,
    error: null,
    data: {
      guests,
      totalCount,
      hasMore,
      nextDisplayName: hasMore ? guests.at(-1)?.displayName : null,
      nextGuestId: hasMore ? guests.at(-1)?.guestId : null,
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
  return renderHook(() => useGuestListPages({ workspaceId: "W1", pages }), {
    wrapper,
  });
}

describe("useGuestListPages", () => {
  beforeEach(() => getWorkspaceGuests.mockReset());

  it("쪽 수만큼 커서를 이어 읽어 한 응답으로 붙이고 전체 수는 마지막 쪽 값이다", async () => {
    getWorkspaceGuests
      .mockResolvedValueOnce(page([guest("G1", "가")], true))
      .mockResolvedValueOnce(page([guest("G2", "나")], false));
    const { result } = run(2);

    await waitFor(() => expect(result.current.data).toBeDefined());

    const data = result.current.data;
    expect(
      data?.status === 200 && data.data.data.guests.map((g) => g.guestId)
    ).toEqual(["G1", "G2"]);
    expect(data?.status === 200 && data.data.data.totalCount).toBe(3);
    expect(data?.status === 200 && data.data.data.hasMore).toBe(false);
    // 둘째 요청은 첫 쪽의 다음 커서를 그대로 단다.
    expect(getWorkspaceGuests.mock.calls[1]?.[1]).toEqual({
      limit: "30",
      afterDisplayName: "가",
      afterGuestId: "G1",
    });
  });

  it("뒷쪽이 실패하면 읽은 곳까지만 돌려주고 더 있음을 남긴다", async () => {
    getWorkspaceGuests
      .mockResolvedValueOnce(page([guest("G1", "가")], true))
      .mockRejectedValueOnce(new Error("network"));
    const { result } = run(2);

    await waitFor(() => expect(result.current.data).toBeDefined());

    const data = result.current.data;
    expect(data?.status === 200 && data.data.data.guests).toHaveLength(1);
    expect(data?.status === 200 && data.data.data.hasMore).toBe(true);
    // 뒷쪽을 못 읽었음을 알린다 — 읽은 곳까지만 든 목록으로 「그 사람이 없다」를 말하면 안 된다.
    expect((data as { partial?: boolean }).partial).toBe(true);
  });
});
