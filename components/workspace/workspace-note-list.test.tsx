import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  sortNotesByRecency,
  WorkspaceNoteList,
} from "@/components/workspace/workspace-note-list";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";

const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("sonner", () => ({ toast }));
// note-list-row는 자체 테스트가 있다 — 목록의 정렬·에러 처리만 본다.
vi.mock("@/components/workspace/note-list-row", () => ({
  NoteListRow: ({ note }: { note: NoteListResponseDataNotesItem }) => (
    <div data-testid="row">{note.title}</div>
  ),
}));

function note(
  noteId: string,
  updatedAt: string
): NoteListResponseDataNotesItem {
  return {
    noteId,
    projectId: "01K0000000001",
    title: noteId,
    createdAt: updatedAt,
    updatedAt,
    lastRecordedAt: null,
    recordedDurationMs: 0,
    meetingStartedBy: null,
  };
}

describe("sortNotesByRecency", () => {
  it("sorts newest updatedAt first (flat, no date grouping)", () => {
    const sorted = sortNotesByRecency([
      note("older", "2026-07-10T01:00:00Z"),
      note("newest", "2026-07-11T10:00:00Z"),
      note("middle", "2026-07-11T01:00:00Z"),
    ]);
    expect(sorted.map((n) => n.noteId)).toEqual(["newest", "middle", "older"]);
  });
});

describe("WorkspaceNoteList", () => {
  beforeEach(() => toast.error.mockReset());
  afterEach(cleanup);

  it("renders a flat recency-ordered list", () => {
    render(
      <WorkspaceNoteList
        workspaceId="01K0000000000"
        notes={[
          note("older", "2026-07-10T01:00:00Z"),
          note("newest", "2026-07-11T10:00:00Z"),
        ]}
        isPending={false}
        isError={false}
        onRetry={vi.fn()}
      />
    );

    const rows = screen.getAllByTestId("row");
    expect(rows.map((r) => r.textContent)).toEqual(["newest", "older"]);
  });

  it("keeps load errors out of the page and exposes retry through Sonner", async () => {
    const onRetry = vi.fn();
    render(
      <WorkspaceNoteList
        workspaceId="01K0000000000"
        notes={[]}
        isPending={false}
        isError
        onRetry={onRetry}
      />
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "노트를 불러오지 못했습니다.",
        expect.objectContaining({
          id: "workspace-notes-01K0000000000",
          action: expect.objectContaining({ label: "다시 시도" }),
        })
      )
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const options = toast.error.mock.calls[0][1];
    options.action.onClick();
    expect(onRetry).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});
