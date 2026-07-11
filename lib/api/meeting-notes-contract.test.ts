import { describe, expect, it } from "vitest";
import type {
  FolderResponse,
  NoteResponse,
  NoteSummaryResponse,
  WorkspaceResponse,
} from "@/lib/api/generated/models";

describe("meeting-note generated models", () => {
  it("uses TSID strings and RFC 3339 dates", () => {
    const workspace: WorkspaceResponse = {
      workspaceId: "01K0000000000",
      name: "테스트 유저의 워크스페이스",
    };
    const folder: FolderResponse = { folderId: "01K0000000001", name: "제품" };
    const note: NoteResponse = {
      noteId: "01K0000000002",
      workspaceId: workspace.workspaceId,
      title: "주간 회의",
      context: null,
      createdBy: { userId: "01K0000000003", name: "테스트 유저" },
      folders: [folder],
      createdAt: "2026-07-11T00:00:00Z",
      updatedAt: "2026-07-11T00:00:00Z",
    };
    const summary: NoteSummaryResponse = {
      ...note,
      lastRecordedAt: null,
      recordedDurationMs: 0,
    };

    expect(summary.noteId).toHaveLength(13);
  });
});
