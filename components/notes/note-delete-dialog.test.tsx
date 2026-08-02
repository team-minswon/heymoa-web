import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteDeleteDialog } from "@/components/notes/note-delete-dialog";

const deleteNote = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/generated/notes/notes", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useDeleteNote: () => ({ mutateAsync: deleteNote, isPending: false }),
}));

const removeQueries = vi.hoisted(() => vi.fn());
const setQueryData = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useQueryClient: () => ({
      removeQueries,
      setQueryData,
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/toast", () => ({ toast: { success: toastSuccess } }));

function renderDialog(onDeleted?: () => void) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NoteDeleteDialog
        noteId="01K0000000002"
        projectId="01K0000000001"
        title="주간 제품 회의"
        open
        onOpenChange={() => {}}
        onDeleted={onDeleted}
      />
    </QueryClientProvider>
  );
}

describe("NoteDeleteDialog", () => {
  afterEach(() => {
    cleanup();
    deleteNote.mockReset();
    toastSuccess.mockReset();
    removeQueries.mockReset();
    setQueryData.mockReset();
  });

  it("무엇이 함께 사라지는지와 되돌릴 수 없음을 문구로 말한다", () => {
    renderDialog();

    expect(screen.getByText("「주간 제품 회의」을 삭제할까요?")).toBeInTheDocument();
    // "삭제됩니다"만 쓰면 전사·요약·대화까지 사라지는 것을 알 수 없다.
    expect(
      screen.getByText(
        "전사와 요약, 챗봇 대화가 함께 사라집니다. 되돌릴 수 없습니다."
      )
    ).toBeInTheDocument();
  });

  it("204면 목록을 무효화하고 성공을 알린 뒤 호출자에게 넘긴다", async () => {
    deleteNote.mockResolvedValue({ status: 204 });
    const onDeleted = vi.fn();
    renderDialog(onDeleted);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(deleteNote).toHaveBeenCalledWith({ noteId: "01K0000000002" });
      expect(toastSuccess).toHaveBeenCalledWith("회의를 삭제했습니다.");
      expect(onDeleted).toHaveBeenCalled();
    });
  });

  it("그 노트를 키에 담은 캐시를 전부 버린다", async () => {
    // 단건만 지우면 전사·요약·공유 채팅이 각자 키로 살아남아 뒤로가기에서 되살아난다.
    deleteNote.mockResolvedValue({ status: 204 });
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(removeQueries).toHaveBeenCalled());
    const { predicate } = removeQueries.mock.calls[0][0];
    expect(predicate({ queryKey: ["/v1/notes/01K0000000002"] })).toBe(true);
    expect(predicate({ queryKey: ["/v1/notes/01K0000000002/transcript"] })).toBe(
      true
    );
    // 개인 챗봇 활성 세션은 noteId가 객체 안에 있다.
    expect(
      predicate({
        queryKey: [
          "/v1/agent-chats/active",
          { scope: "note", noteId: "01K0000000002" },
        ],
      })
    ).toBe(true);
    expect(predicate({ queryKey: ["/v1/notes/01K0000000009"] })).toBe(false);
  });

  it("목록 캐시에서 행을 먼저 뺀 뒤 재검증한다", async () => {
    // invalidateQueries는 재조회가 실패해도 resolve하고 옛 데이터를 남긴다.
    deleteNote.mockResolvedValue({ status: 204 });
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(setQueryData).toHaveBeenCalled());
    const [key, updater] = setQueryData.mock.calls[0];
    expect(key).toEqual(["/v1/projects/01K0000000001/notes"]);
    const next = updater({
      status: 200,
      data: {
        success: true,
        data: { notes: [{ noteId: "01K0000000002" }, { noteId: "01K0000000009" }] },
      },
    });
    expect(next.data.data.notes).toEqual([{ noteId: "01K0000000009" }]);
  });

  it("후처리가 끝날 때까지 버튼을 다시 열지 않는다", async () => {
    // isPending은 DELETE가 끝나면 바로 풀린다. 그때 다시 누르면 지운 노트로 또 나간다.
    deleteNote.mockResolvedValue({ status: 204 });
    renderDialog();
    const button = screen.getByRole("button", { name: "삭제" });

    fireEvent.click(button);

    await waitFor(() => expect(deleteNote).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    expect(deleteNote).toHaveBeenCalledTimes(1);
  });

  it("실패는 삼키지 않고 거절을 소비한다", async () => {
    // catch가 없으면 unhandled rejection이 된다. 토스트는 MutationCache가 띄운다.
    deleteNote.mockRejectedValue(new Error("MEETING_IN_PROGRESS"));
    const onDeleted = vi.fn();
    renderDialog(onDeleted);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(deleteNote).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("204가 아니면 성공으로 다루지 않는다", async () => {
    // 실패 토스트는 MutationCache가 전역으로 띄운다 — 여기서 또 부르면 두 개가 겹친다.
    deleteNote.mockResolvedValue({ status: 409 });
    const onDeleted = vi.fn();
    renderDialog(onDeleted);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(deleteNote).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
