import { beforeEach, describe, expect, it } from "vitest";
import { mockDb } from "@/lib/mocks/db";

describe("mockDb", () => {
  beforeEach(() => mockDb.reset());

  it("keeps exactly one explicit default workspace", () => {
    const created = mockDb.createWorkspace({
      name: "제품",
      description: null,
    });
    expect(mockDb.listWorkspaces()[0].isDefault).toBe(true);
    expect(created.isDefault).toBe(false);

    mockDb.setDefaultWorkspace(created.workspaceId);
    const defaults = mockDb
      .listWorkspaces()
      .filter((item) => item.isDefault);
    expect(defaults).toEqual([
      expect.objectContaining({ workspaceId: created.workspaceId }),
    ]);
  });

  it("rejects note creation in a non-existent project", () => {
    expect(() =>
      mockDb.createNote("non-existent-project", { title: "새 노트" })
    ).toThrow("PROJECT_NOT_FOUND");
  });

  it("rejects project deletion when it contains notes", () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    mockDb.createNote(project.projectId, { title: "제품 주간 보고" });
    expect(() =>
      mockDb.deleteProject("01K0000000000", project.projectId)
    ).toThrow("PROJECT_HAS_NOTES");
  });

  it("rejects a second active session", () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    mockDb.createSession(note.noteId);
    expect(() => mockDb.createSession(note.noteId)).toThrow(
      "ACTIVE_TRANSCRIPTION_SESSION"
    );
  });
});
