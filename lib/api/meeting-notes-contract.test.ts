import { describe, expect, it } from "vitest";
import type {
  ProjectResponseData,
  NoteResponseData,
  WorkspaceResponseData,
} from "@/lib/api/generated/models";

describe("meeting-note generated models", () => {
  it("uses TSID strings and RFC 3339 dates", () => {
    const workspace: WorkspaceResponseData = {
      workspaceId: "01K0000000000",
      name: "테스트 유저의 워크스페이스",
      description: null,
      isDefault: true,
      role: "ADMIN" as const,
    };
    const project: ProjectResponseData = {
      projectId: "01K0000000001",
      workspaceId: workspace.workspaceId,
      name: "제품",
      description: null,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-01T00:00:00Z",
    };
    const note: NoteResponseData = {
      noteId: "01K0000000002",
      projectId: project.projectId,
      title: "주간 회의",
      createdAt: "2026-07-11T00:00:00Z",
      updatedAt: "2026-07-11T00:00:00Z",
    };

    expect(note.noteId).toHaveLength(13);
  });
});
