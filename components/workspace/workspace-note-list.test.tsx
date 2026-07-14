import { describe, expect, it } from "vitest";

import { groupNotesByDate } from "@/components/workspace/workspace-note-list";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";

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
