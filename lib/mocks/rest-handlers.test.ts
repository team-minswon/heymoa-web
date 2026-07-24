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

  it("생성은 201로 답한다", async () => {
    // 화면이 `status === 201`로 성공을 가른다. 생성 mock 래퍼는 200만 줄 수 있어
    // 목에서 워크스페이스가 만들어지지 않았다.
    const response = await fetch("http://localhost/v1/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "새 워크스페이스", description: null }),
    });

    expect(response.status).toBe(201);
    expect((await response.json()).success).toBe(true);
  });

  it("기본 워크스페이스는 path가 아니라 본문의 workspaceId로 바뀐다", async () => {
    const target = mockDb.listWorkspaces().at(-1)!;

    const response = await fetch(
      "http://localhost/v1/users/me/default-workspace",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: target.workspaceId }),
      }
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data.workspaceId).toBe(target.workspaceId);
  });

  it("한 operation의 실패가 여럿이면 던진 코드를 그대로 쓴다", async () => {
    // createProject는 잘못된 본문이면 400, 없는 워크스페이스면 404다.
    // 기본값으로 덮으면 계약과 어긋난다.
    const response = await fetch(
      "http://localhost/v1/workspaces/01KZZZZZZZZZZ/projects",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "새 프로젝트" }),
      }
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("없는 노트는 200 success:false가 아니라 404다", async () => {
    // 계약의 성공 응답은 error가 null로 못박혀 있다 — 실패는 4xx + AppErrorResponse다.
    const response = await fetch("http://localhost/v1/notes/01KZZZZZZZZZZ");

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOTE_NOT_FOUND");
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
    const body = await second.json();
    expect(body.error.code).toBe("DUPLICATE_PENDING_INVITATION");
    // 실서버처럼 한국어 메시지를 담아야 web이 errorMessageOf로 서버 문구를 그린다.
    expect(body.error.message).toBe("이미 대기 중인 초대가 있습니다.");
  });

  it("returns 404 INVITEE_NOT_FOUND for a mixed-case email", async () => {
    const response = await fetch(
      "http://localhost/v1/workspaces/01K0000000000/invitations",
      {
        method: "POST",
        body: JSON.stringify({ email: "Sora@Heymoa.app", role: "MEMBER" }),
      }
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("INVITEE_NOT_FOUND");
    expect(body.error.message).toBe("초대할 사용자를 찾을 수 없습니다.");
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

  it("남의 잠금을 심으면 lockedBy가 현재 유저가 아니게 된다 (관전자 재현)", async () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});

    const seed = await fetch(
      `http://localhost/v1/notes/${note.noteId}/_mock/foreign-lock`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockedBy: "홍길동" }),
      }
    );
    expect(seed.status).toBe(204);

    const chat = await fetch(
      `http://localhost/v1/notes/${note.noteId}/chat/messages`
    );
    const body = await chat.json();
    expect(body.data.lock).toMatchObject({ locked: true, lockedBy: "홍길동" });

    // 명시적 null은 잠금을 해제한다 — `??`로 기본값을 씌워 해제를 막으면 안 된다.
    const clear = await fetch(
      `http://localhost/v1/notes/${note.noteId}/_mock/foreign-lock`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockedBy: null }),
      }
    );
    expect(clear.status).toBe(204);
    const after = await (
      await fetch(`http://localhost/v1/notes/${note.noteId}/chat/messages`)
    ).json();
    expect(after.data.lock).toMatchObject({ locked: false, lockedBy: null });
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
