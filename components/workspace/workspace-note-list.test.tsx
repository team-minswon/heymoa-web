import { describe, expect, it } from "vitest";

import { groupNotesByDate } from "@/components/workspace/workspace-note-list";
import type { NoteSummaryResponse } from "@/lib/api/generated/models";

function note(
  noteId: string,
  createdAt: string,
  lastRecordedAt: string | null = null
): NoteSummaryResponse {
  return {
    noteId,
    workspaceId: "01K0000000000",
    title: noteId,
    context: null,
    createdBy: { userId: "01K0000000003", name: "김민수" },
    folders: [],
    createdAt,
    updatedAt: createdAt,
    lastRecordedAt,
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

    expect(groups.map((group) => group.notes.map((item) => item.noteId))).toEqual([
      ["newer", "same-day-older"],
      ["older"],
    ]);
  });
});
