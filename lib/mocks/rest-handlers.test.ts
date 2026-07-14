import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";

import { mockDb } from "@/lib/mocks/db";
import { restHandlers } from "@/lib/mocks/rest-handlers";

const server = setupServer(...restHandlers);

describe("REST mock handlers", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
  });
  afterAll(() => server.close());

  it("returns the session details", async () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    const session = mockDb.createSession(note.noteId);

    const response = await fetch(
      `http://localhost/v1/transcription-sessions/${session.sessionId}`
    );
    const body = await response.json();

    expect(body.data).toMatchObject({
      sessionId: session.sessionId,
      noteId: note.noteId,
    });
  });

  it("creates a bodyless session and rejects a second active session", async () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    const url = `http://localhost/v1/notes/${note.noteId}/transcription-sessions`;

    const response = await fetch(url, { method: "POST" });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true,
      error: null,
    });

    const conflict = await fetch(url, { method: "POST" });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      success: false,
      error: { code: "ACTIVE_TRANSCRIPTION_SESSION" },
    });
  });
});
