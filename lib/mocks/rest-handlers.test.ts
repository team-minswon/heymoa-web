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

  it("returns the current active session instead of a module-load snapshot", async () => {
    const note = mockDb.createNote(mockDb.workspace.workspaceId, {});
    const session = mockDb.createSession(note.noteId);

    const response = await fetch(
      "http://localhost/v1/transcription-sessions/active"
    );
    const body = await response.json();

    expect(body.data.session).toMatchObject({
      sessionId: session.sessionId,
      noteId: note.noteId,
    });
  });
});
