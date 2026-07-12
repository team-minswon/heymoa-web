import { beforeEach, describe, expect, it } from "vitest";
import { mockDb } from "@/lib/mocks/db";

describe("mockDb", () => {
  beforeEach(() => mockDb.reset());

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
