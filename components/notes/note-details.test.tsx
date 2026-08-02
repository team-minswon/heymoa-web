import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoteDetails } from "@/components/notes/note-details";

const NOTE_ID = "01K0000000002";
const WORKSPACE_ID = "01K0000000001";
const PROJECT_ID = "01K0000000010";
const mutateAsync = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/lib/api/generated/notes/notes", () => ({
  getGetNoteQueryKey: (noteId: string) => ["note", noteId],
  getGetNotesQueryKey: (projectId: string) => ["notes", projectId],
  useGetNoteSuspense: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          noteId: NOTE_ID,
          projectId: PROJECT_ID,
          title: "주간 제품 회의",
          createdAt: "2026-07-10T00:00:00Z",
          updatedAt: "2026-07-11T00:00:00Z",
          participants: [],
        },
      },
    },
  }),
  useUpdateNote: () => ({ mutateAsync, isPending: false }),
  useReplaceNoteParticipants: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));
vi.mock(
  "@/lib/api/generated/workspace-members/workspace-members",
  () => ({ useGetWorkspaceMembers: () => ({ data: undefined }) })
);
vi.mock("@/lib/ui/toast", () => ({ toast }));

function renderDetails() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NoteDetails noteId={NOTE_ID} workspaceId={WORKSPACE_ID} />
    </QueryClientProvider>
  );
}

describe("NoteDetails", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    toast.error.mockReset();
  });

  afterEach(cleanup);

  it("keeps the edited title and reports save failure through Sonner", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("save failed"));
    renderDetails();

    const title = screen.getByRole("textbox", { name: "회의 제목" });
    fireEvent.change(title, { target: { value: "수정 중인 회의 제목" } });
    fireEvent.click(screen.getByRole("button", { name: "변경 저장" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "저장하지 못했습니다. 입력한 내용은 유지됩니다.",
        { id: `note-save-${NOTE_ID}` }
      )
    );
    expect(title).toHaveValue("수정 중인 회의 제목");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("저장에 성공하면 노트 단건과 목록을 함께 무효화한다", async () => {
    mutateAsync.mockResolvedValueOnce({ status: 200 });
    const client = new QueryClient();
    const invalidate = vi
      .spyOn(client, "invalidateQueries")
      .mockResolvedValue(undefined);
    render(
      <QueryClientProvider client={client}>
        <NoteDetails noteId={NOTE_ID} workspaceId={WORKSPACE_ID} />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "변경 저장" }));

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["note", NOTE_ID] });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["notes", PROJECT_ID],
      });
    });
  });
});
