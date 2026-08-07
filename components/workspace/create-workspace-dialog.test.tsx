import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const mutation = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

// **진짜 `useMutation`으로 목을 만든다.** 잠금이 `isPending`에 걸려 있고 무효화·이동이
// `onSuccess` 안에 있어서, 옵션을 무시하는 평면 객체로는 그 둘 다 안 돌아간다.
vi.mock("@/lib/api/generated/workspaces/workspaces", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  return {
    getGetWorkspacesQueryKey: () => ["/v1/workspaces"],
    useCreateWorkspace: (options?: {
      mutation?: Record<string, unknown>;
    }) =>
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

/** 부모가 실제로 `open`을 쥔다 — 닫힘이 prop으로 되돌아와야 초기화 경로가 지나간다. */
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

  /**
   * **거절이 오류 경계로 올라가면 안 된다.** React 19는 거절된 form action을 가장 가까운
   * 경계로 올리는데, 워크스페이스 0개인 사람에게는 이것이 유일한 생성 흐름이라 이름 400
   * 하나에 랜딩이 통째로 오류 화면이 된다(APP-402 codex 리뷰).
   */
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

  /** 사이드바는 노트 전체 화면이 열리면 부모의 `open`을 직접 false로 바꾼다 — 이 경로가
   *  콜백을 안 지나므로, 초기화가 콜백에 묶여 있으면 이름이 남는다(codex 리뷰). */
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

  /**
   * POST가 끝나도 목록 무효화가 남아 있어 `createWorkspace.isPending`은 먼저 false가 된다.
   * 그 구간에 만들기가 다시 열리면 **워크스페이스가 둘 생긴다**(codex 리뷰). 속성이 아니라
   * 실제 위험으로 검증한다 — 두 번 눌러도 요청은 한 번이어야 한다.
   */
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
