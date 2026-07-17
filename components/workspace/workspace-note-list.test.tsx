import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  groupNotesByDate,
  WorkspaceNoteList,
} from "@/components/workspace/workspace-note-list";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";

const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("sonner", () => ({ toast }));

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
  };
}

describe("groupNotesByDate", () => {
  it("groups notes by recording date and sorts newest groups and rows first", () => {
    const groups = groupNotesByDate(
      [
        note("same-day-older", "2026-07-11T01:00:00Z"),
        note("older", "2026-07-10T01:00:00Z"),
        note("newer", "2026-07-11T10:00:00Z"),
      ],
      "ko-KR"
    );

    expect(
      groups.map((group) => group.notes.map((item) => item.noteId))
    ).toEqual([["newer", "same-day-older"], ["older"]]);
  });
});

describe("WorkspaceNoteList", () => {
  beforeEach(() => toast.error.mockReset());
  afterEach(cleanup);

  it("keeps load errors out of the page and exposes retry through Sonner", async () => {
    const onRetry = vi.fn();
    render(
      <WorkspaceNoteList
        workspaceId="01K0000000000"
        notes={[]}
        isPending={false}
        isError
        onRetry={onRetry}
        onCreateMeeting={vi.fn()}
        projectNames={{}}
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
