import { beforeEach, describe, expect, it } from "vitest";
import { mockDb } from "@/lib/mocks/db";

describe("mockDb", () => {
  beforeEach(() => mockDb.reset());

  it("keeps exactly one explicit default workspace", () => {
    const created = mockDb.createWorkspace({
      name: "제품",
      description: null,
    });
    expect(mockDb.listWorkspaces().items[0].isDefault).toBe(true);
    expect(created.isDefault).toBe(false);

    mockDb.setDefaultWorkspace(created.workspaceId);
    const defaults = mockDb
      .listWorkspaces()
      .items.filter((item) => item.isDefault);
    expect(defaults).toEqual([
      expect.objectContaining({ workspaceId: created.workspaceId }),
    ]);
  });

  it("updates only the editable user display name", () => {
    const before = mockDb.getCurrentUser();
    const after = mockDb.updateCurrentUser({ name: "김민수" });
    expect(after).toMatchObject({ name: "김민수", email: before.email });
  });

  it("rejects cross-workspace folder attachment", () => {
    const other = mockDb.createWorkspace({
      name: "다른 팀",
      description: null,
    });
    const note = mockDb.createNote(other.workspaceId, {
      title: "다른 노트",
      context: null,
    });
    const defaultFolder = mockDb.listFolders(
      mockDb.listWorkspaces().items[0].workspaceId
    )[0];
    expect(() =>
      mockDb.attachFolder(note.noteId, defaultFolder.folderId)
    ).toThrow("FORBIDDEN");
  });

  it("attaches one note to multiple folders idempotently", () => {
    const note = mockDb.createNote(mockDb.workspace.workspaceId, {});
    const first = mockDb.createFolder(mockDb.workspace.workspaceId, {
      name: "제품",
    });
    const second = mockDb.createFolder(mockDb.workspace.workspaceId, {
      name: "개발",
    });
    mockDb.attachFolder(note.noteId, first.folderId);
    mockDb.attachFolder(note.noteId, first.folderId);
    mockDb.attachFolder(note.noteId, second.folderId);
    expect(mockDb.getNote(note.noteId).folders).toHaveLength(2);
  });

  it("rejects a second active session", () => {
    const note = mockDb.createNote(mockDb.workspace.workspaceId, {});
    mockDb.createSession(note.noteId);
    expect(() => mockDb.createSession(note.noteId)).toThrow(
      "ACTIVE_TRANSCRIPTION_SESSION_EXISTS"
    );
  });
});
