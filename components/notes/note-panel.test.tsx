import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NotePanel } from "@/components/notes/note-panel";

vi.mock("@/components/notes/note-details", () => ({
  NoteDetails: () => <p>정보 내용</p>,
}));
vi.mock("@/components/notes/transcript-view", () => ({
  TranscriptView: () => <p>전사 내용</p>,
}));
vi.mock("@/lib/api/generated/note/note", () => ({
  getListWorkspaceNotesQueryKey: () => ["notes"],
  useGetNote: () => ({
    data: {
      status: 200,
      data: {
        success: true,
        data: {
          noteId: "01K0000000002",
          title: "주간 제품 회의",
          folders: [{ folderId: "01K0000000001", name: "주간" }],
        },
      },
    },
  }),
  useDeleteNote: () => ({ mutateAsync: vi.fn() }),
}));

describe("NotePanel", () => {
  it("changes only the controlled tab", () => {
    const onTabChange = vi.fn();
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <NotePanel
          workspaceId="01K0000000000"
          noteId="01K0000000002"
          tab="transcript"
          onTabChange={onTabChange}
          onClose={vi.fn()}
        />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("tab", { name: "노트 정보" }));
    expect(onTabChange).toHaveBeenCalledWith("details");
    expect(screen.getByText("주간 제품 회의")).toBeInTheDocument();
    expect(screen.getByText("주간")).toBeInTheDocument();
  });
});
