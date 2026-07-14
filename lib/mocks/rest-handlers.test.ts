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
});
