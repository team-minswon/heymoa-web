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

describe("invitation and notification handlers", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
  });
  afterAll(() => server.close());

  it("returns 409 for a duplicate pending invitation", async () => {
    const url = "http://localhost/v1/workspaces/01K0000000000/invitations";
    const payload = { email: "dup@heymoa.com", role: "MEMBER" };

    const first = await fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);

    const second = await fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe(
      "DUPLICATE_PENDING_INVITATION"
    );
  });

  it("returns 404 when accepting an invitation that does not exist", async () => {
    const response = await fetch(
      "http://localhost/v1/invitations/01K9999999999/accept",
      { method: "POST" }
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("INVITATION_NOT_FOUND");
  });

  it("serves the notification list with its unread count", async () => {
    const response = await fetch("http://localhost/v1/notifications");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.unreadCount).toBe(1);
  });
});

/** 회의 조작은 시작자만 가능하다 — 녹음을 시작해 시작자를 만든 노트를 쓴다. */
function startedNote() {
  const project = mockDb.listProjects("01K0000000000")[0];
  const note = mockDb.createNote(project.projectId, {});
  const session = mockDb.createSession(note.noteId);
  mockDb.updateSessionStatus(session.sessionId, "COMPLETED");
  return note;
}

describe("meeting and integration handlers", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
  });
  afterAll(() => server.close());

  it("returns 409 when pausing a meeting that already ended", async () => {
    const note = startedNote();
    mockDb.endMeeting(note.noteId);

    const response = await fetch(
      `http://localhost/v1/notes/${note.noteId}/meeting-pause`,
      { method: "POST" }
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("MEETING_NOT_IN_PROGRESS");
  });

  it("accepts a meeting end with 202 and queues an analysis", async () => {
    const note = startedNote();

    const response = await fetch(
      `http://localhost/v1/notes/${note.noteId}/meeting-end`,
      { method: "POST" }
    );

    expect(response.status).toBe(202);
    expect((await response.json()).data.status).toBe("PENDING");
  });

  it("serves both providers even before anything is connected", async () => {
    const response = await fetch(
      "http://localhost/v1/workspaces/01K0000000000/integrations"
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.integrations.map((i: { provider: string }) => i.provider)).toEqual([
      "LINEAR",
      "GITHUB",
    ]);
  });
});
