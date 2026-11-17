import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const mutation = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/api/generated/workspaces/workspaces", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  return {
    getGetWorkspacesQueryKey: () => ["/v1/workspaces"],
    useCreateWorkspace: (options?: { mutation?: Record<string, unknown> }) =>
      useMutation({
        mutationFn: (variables: unknown) => mutation.mutateAsync(variables),
        ...options?.mutation,
      }),
  };
});

function renderDialog(onOpenChange = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CreateWorkspaceDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>
  );
  return onOpenChange;
}

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <QueryClientProvider client={new QueryClient()}>
      <button type="button" onClick={() => setOpen(true)}>
        다시 열기
      </button>
      <CreateWorkspaceDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onClose?.();
        }}
      />
    </QueryClientProvider>
  );
}

function submitName(name: string) {
  fireEvent.change(screen.getByLabelText("워크스페이스 이름"), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole("button", { name: "만들기" }));
}

describe("CreateWorkspaceDialog", () => {
  afterEach(cleanup);

  beforeEach(() => {
    router.push.mockReset();
    mutation.mutateAsync.mockReset();
  });

  it("만들면 새 워크스페이스로 이동한다", async () => {
    mutation.mutateAsync.mockResolvedValue({
      status: 201,
      data: { success: true, data: { workspaceId: "01K0000000009" } },
    });
    const onOpenChange = renderDialog();

    submitName("제품 팀");

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/w/01K0000000009")
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // React 19 는 거절된 form action 을 가장 가까운 오류 경계로 올립니다.
  it("생성이 실패해도 다이얼로그에 머문다", async () => {
    mutation.mutateAsync.mockRejectedValue(new Error("BAD_REQUEST"));
    const onOpenChange = renderDialog();

    submitName("제품 팀");

    await waitFor(() => expect(mutation.mutateAsync).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("워크스페이스 이름")).toHaveValue("제품 팀");
  });

  it("취소하고 다시 열면 이름이 비어 있다", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.change(screen.getByLabelText("워크스페이스 이름"), {
      target: { value: "잘못 친 이름" },
    });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onClose).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "다시 열기" }));
    expect(screen.getByLabelText("워크스페이스 이름")).toHaveValue("");
  });

  it("부모가 직접 닫아도 이름이 비워진다", () => {
    const { rerender } = render(
      <QueryClientProvider client={new QueryClient()}>
        <CreateWorkspaceDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    fireEvent.change(screen.getByLabelText("워크스페이스 이름"), {
      target: { value: "잘못 친 이름" },
    });

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <CreateWorkspaceDialog open={false} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <CreateWorkspaceDialog open onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );

    expect(screen.getByLabelText("워크스페이스 이름")).toHaveValue("");
  });

  it("제출 중에 다시 눌러도 요청은 한 번만 나간다", async () => {
    mutation.mutateAsync.mockReturnValue(new Promise(() => {}));
    renderDialog();

    submitName("제품 팀");
    await waitFor(() => expect(mutation.mutateAsync).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "만들기" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(mutation.mutateAsync).toHaveBeenCalledOnce();
  });
});
