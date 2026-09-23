import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NoteDeleteDialog } from "@/components/notes/note-delete-dialog";

const deleteNote = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/generated/notes/notes", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useDeleteNote: () => ({ mutateAsync: deleteNote, isPending: false }),
}));

/**
 * **queryClient 를 손으로 흉내 내지 않는다.** 예전에는 `setQueryData`·`removeQueries` 를
 * `vi.fn()` 으로 갈아끼우고 「무엇을 어떤 인자로 불렀나」를 단언했다. 그러면 구현을 그대로
 * 되읽는 거울이 되고, 실제로 목록 키가 둘로 늘었을 때 **초록인 채 지나갔다.**
 *
 * 진짜 캐시를 세우고 **그 안에 무엇이 남았는지**를 본다.
 */

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/toast", () => ({ toast: { success: toastSuccess } }));

const PROJECT_NOTES_KEY = ["/v1/projects/01K0000000001/notes"];
const WORKSPACE_NOTES_KEY = ["/v1/workspaces/01K0000000000/notes"];

/** 두 목록에 같은 두 행을 세운다. 지운 뒤 **양쪽 다** 한 행만 남아야 한다. */
function listPayload() {
  return {
    status: 200,
    data: {
      success: true,
      data: { notes: [{ noteId: "01K0000000002" }, { noteId: "01K0000000009" }] },
    },
  };
}

function notesIn(client: QueryClient, key: readonly unknown[]) {
  const cached = client.getQueryData(key) as
    | { data?: { data?: { notes?: { noteId: string }[] } } }
    | undefined;
  return cached?.data?.data?.notes?.map((note) => note.noteId);
}

function renderDialog(onDeleted?: () => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(PROJECT_NOTES_KEY, listPayload());
  client.setQueryData(WORKSPACE_NOTES_KEY, listPayload());
  client.setQueryData(["/v1/notes/01K0000000002"], { status: 200 });
  client.setQueryData(
    ["/v1/notes/01K0000000002/transcript", { cursor: "01K0000000050" }],
    { status: 200 }
  );
  client.setQueryData(["/v1/notes/01K0000000009"], { status: 200 });
  render(
    <QueryClientProvider client={client}>
      <NoteDeleteDialog
        noteId="01K0000000002"
        title="주간 제품 회의"
        open
        onOpenChange={() => {}}
        onDeleted={onDeleted}
      />
    </QueryClientProvider>
  );
  return client;
}

describe("NoteDeleteDialog", () => {
  afterEach(() => {
    cleanup();
    deleteNote.mockReset();
    toastSuccess.mockReset();
  });

  it("무엇이 함께 사라지는지와 되돌릴 수 없음을 문구로 말한다", () => {
    renderDialog();

    expect(screen.getByText("「주간 제품 회의」을 삭제할까요?")).toBeInTheDocument();
    // "삭제됩니다"만 쓰면 전사·요약·대화까지 사라지는 것을 알 수 없다.
    expect(
      screen.getByText(
        "스크립트와 요약, 챗봇 대화가 함께 사라집니다. 되돌릴 수 없습니다."
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
    const client = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() =>
      expect(client.getQueryData(["/v1/notes/01K0000000002"])).toBeUndefined()
    );
    // noteId 가 객체 안에 있는 키도 같이 사라져야 한다 — 최상위 문자열 검사로는 안 걸린다.
    expect(
      client.getQueryData([
        "/v1/notes/01K0000000002/transcript",
        { cursor: "01K0000000050" },
      ])
    ).toBeUndefined();
    // 남의 노트는 그대로다.
    expect(client.getQueryData(["/v1/notes/01K0000000009"])).toBeDefined();
  });

  it("★ 목록 둘 다에서 행을 먼저 뺀다", async () => {
    // `invalidateQueries` 는 재조회가 실패해도 resolve 하고 옛 데이터를 남긴다. 그래서
    // 재검증 전에 행을 직접 뺀다 — **그리고 목록은 둘이다** (APP-685). 프로젝트 것만 빼면
    // 「모든 노트」 화면에 지운 회의가 그대로 서 있다.
    deleteNote.mockResolvedValue({ status: 204 });
    const client = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() =>
      expect(notesIn(client, PROJECT_NOTES_KEY)).toEqual(["01K0000000009"])
    );
    expect(notesIn(client, WORKSPACE_NOTES_KEY)).toEqual(["01K0000000009"]);
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
