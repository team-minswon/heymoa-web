import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, within, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteWorkspaceCard } from "@/components/settings/delete-workspace-card";

const mutateAsync = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/api/generated/workspaces/workspaces", () => ({
  getGetWorkspacesQueryKey: () => ["workspaces"],
  useDeleteWorkspace: () => ({ mutateAsync, isPending: false }),
}));

function renderCard(isDefault = false) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DeleteWorkspaceCard
        workspaceId="01K0000000007"
        name="제품 팀"
        isDefault={isDefault}
      />
    </QueryClientProvider>
  );
}

describe("DeleteWorkspaceCard", () => {
  afterEach(() => {
    cleanup();
    mutateAsync.mockReset();
    replace.mockReset();
    toast.error.mockReset();
  });

  it("asks before deleting and leaves the workspace on success", async () => {
    mutateAsync.mockResolvedValueOnce({ status: 204 });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("제품 팀");

    // 확인 버튼은 다이얼로그 안의 것이다 — 행의 「삭제」와 이름이 같다.
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("explains why the default workspace cannot be deleted instead of hiding it", () => {
    // 버튼만 감추면 「여긴 왜 삭제가 없지」가 된다 — 계약이 409로 막는 이유를 적는다.
    renderCard(true);

    expect(
      screen.getByText(/기본 워크스페이스라 삭제할 수 없습니다/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "삭제" })
    ).toBeNull();
  });
});
