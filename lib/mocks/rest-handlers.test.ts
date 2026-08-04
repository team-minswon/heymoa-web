import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { setupServer } from "msw/node";

import { mockDb } from "@/lib/mocks/db";
import { restHandlers } from "@/lib/mocks/rest-handlers";

const server = setupServer(...restHandlers);

describe("REST mock handlers", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    vi.useRealTimers();
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

    const noteAfterStart = await fetch(
      `http://localhost/v1/notes/${note.noteId}`
    );
    expect((await noteAfterStart.json()).data.meetingStatus).toBe(
      "IN_PROGRESS"
    );

    const conflict = await fetch(url, { method: "POST" });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      success: false,
      error: { code: "ACTIVE_TRANSCRIPTION_SESSION" },
    });
  });

  it("returns null for an expired READY current session", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-11T09:00:00Z"));
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    mockDb.createSession(note.noteId);
    vi.setSystemTime(new Date("2026-07-11T09:10:00Z"));

    const response = await fetch(
      `http://localhost/v1/notes/${note.noteId}/transcription-sessions/current`
    );

    expect((await response.json()).data).toBeNull();
  });

  it("returns a derived timing snapshot from the note PATCH response", async () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    const session = mockDb.createSession(note.noteId);
    mockDb.updateSessionStatus(session.sessionId, "ACTIVE");

    const response = await fetch(`http://localhost/v1/notes/${note.noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "기록 중 제목" }),
    });

    expect((await response.json()).data).toMatchObject({
      activeSessionStartedAt: expect.any(String),
      recordedDurationMs: 0,
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

  it("creates an invitation from a mixed-case email by normalizing it", async () => {
    const response = await fetch(
      "http://localhost/v1/workspaces/01K0000000000/invitations",
      {
        method: "POST",
        body: JSON.stringify({ email: "Sora@Heymoa.app", role: "MEMBER" }),
      }
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
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

describe("workspace member management handlers", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    mockDb.reset();
  });
  afterAll(() => server.close());

  const WORKSPACE_ID = "01K0000000000"; // 시드: 나(ADMIN) + 한지원(01K0000000020, MEMBER)
  const OTHER_MEMBER_ID = "01K0000000020";
  const currentUserId = () => mockDb.getCurrentUser().userId;

  it("역할 변경은 204 무본문으로 성공한다", async () => {
    const response = await fetch(
      `http://localhost/v1/workspaces/${WORKSPACE_ID}/members/${OTHER_MEMBER_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "ADMIN" }),
      }
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(
      mockDb
        .listMembers(WORKSPACE_ID)
        .find((m) => m.userId === OTHER_MEMBER_ID)?.role
    ).toBe("ADMIN");
  });

  it("마지막 ADMIN을 MEMBER로 내리면 409 LAST_WORKSPACE_ADMIN을 한국어 문구와 함께 돌려준다", async () => {
    const response = await fetch(
      `http://localhost/v1/workspaces/${WORKSPACE_ID}/members/${currentUserId()}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "MEMBER" }),
      }
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatchObject({
      code: "LAST_WORKSPACE_ADMIN",
      message: "워크스페이스에는 관리자가 최소 한 명 있어야 합니다.",
    });
  });

  // 웹은 생성 타입에 묶여 "OWNER"를 못 보내지만, 목이 계약보다 관대하면 그 차이가 서버에
  // 붙는 날에야 드러난다. 핸들러의 타입 단언은 런타임에 아무것도 막지 않는다.
  it("계약에 없는 역할은 400 BAD_REQUEST다", async () => {
    const response = await fetch(
      `http://localhost/v1/workspaces/${WORKSPACE_ID}/members/${OTHER_MEMBER_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "OWNER" }),
      }
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
    expect(
      mockDb
        .listMembers(WORKSPACE_ID)
        .find((m) => m.userId === OTHER_MEMBER_ID)?.role
    ).toBe("MEMBER");
  });

  // 생성 훅의 `data`가 optional이라 본문 없는 PATCH가 실제로 날아올 수 있다. 파싱이
  // 오류 변환 밖에서 일어나면 MSW가 500과 스택 트레이스를 주고, 그건 계약에 없는 응답이다.
  it("본문이 없거나 깨진 PATCH도 500이 아니라 400 봉투다", async () => {
    for (const body of [undefined, "{"]) {
      const response = await fetch(
        `http://localhost/v1/workspaces/${WORKSPACE_ID}/members/${OTHER_MEMBER_ID}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
        }
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("BAD_REQUEST");
    }
  });

  it("없는 워크스페이스는 403이 아니라 404 WORKSPACE_NOT_FOUND다", async () => {
    const response = await fetch(
      `http://localhost/v1/workspaces/01K9999999999/members/${OTHER_MEMBER_ID}`,
      { method: "DELETE" }
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("추방은 자기 자신을 대상으로 하면 400을 돌려준다", async () => {
    const response = await fetch(
      `http://localhost/v1/workspaces/${WORKSPACE_ID}/members/${currentUserId()}`,
      { method: "DELETE" }
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("BAD_REQUEST");
  });

  it("추방은 204 무본문으로 성공하고 멤버 목록에서 사라진다", async () => {
    const response = await fetch(
      `http://localhost/v1/workspaces/${WORKSPACE_ID}/members/${OTHER_MEMBER_ID}`,
      { method: "DELETE" }
    );

    expect(response.status).toBe(204);
    expect(
      mockDb.listMembers(WORKSPACE_ID).some((m) => m.userId === OTHER_MEMBER_ID)
    ).toBe(false);
  });

  // /members/me가 /members/:userId보다 먼저 등록돼야 한다 — 등록 순서가 뒤집히면 이 요청이
  // :userId 라우트에 userId="me"로 잡혀 removeMember를 타고, 있지도 않은 "me" 멤버를 찾다가
  // 404 WORKSPACE_MEMBER_NOT_FOUND로 잘못 응답한다. 이 테스트는 그 회귀를 잡는다.
  it("나가기(/members/me)는 :userId 라우트에 먹히지 않고 별도로 처리된다", async () => {
    // 마지막 ADMIN이면 나가기 자체가 409라 라우팅 문제를 가린다 — 관리자를 하나 더 만든다.
    await fetch(
      `http://localhost/v1/workspaces/${WORKSPACE_ID}/members/${OTHER_MEMBER_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "ADMIN" }),
      }
    );

    const response = await fetch(
      `http://localhost/v1/workspaces/${WORKSPACE_ID}/members/me`,
      { method: "DELETE" }
    );

    expect(response.status).toBe(204);
    // 나간 뒤에는 멤버 목록을 조회할 수 없다(워크스페이스가 사라진다) — 목록으로 확인한다.
    expect(
      mockDb.listWorkspaces().some((w) => w.workspaceId === WORKSPACE_ID)
    ).toBe(false);
  });

  it("나가기에서 마지막 ADMIN은 409, 비멤버는 404 WORKSPACE_NOT_FOUND다", async () => {
    const lastAdmin = await fetch(
      `http://localhost/v1/workspaces/${WORKSPACE_ID}/members/me`,
      { method: "DELETE" }
    );
    expect(lastAdmin.status).toBe(409);
    expect((await lastAdmin.json()).error.code).toBe("LAST_WORKSPACE_ADMIN");

    // 01K0000000030 — 초대만 와 있고 아직 합류하지 않은 워크스페이스.
    const notMember = await fetch(
      "http://localhost/v1/workspaces/01K0000000030/members/me",
      { method: "DELETE" }
    );
    expect(notMember.status).toBe(404);
    expect((await notMember.json()).error.code).toBe("WORKSPACE_NOT_FOUND");
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

  it("rejects a transcription session started by another meeting starter", async () => {
    const foreignNote = mockDb
      .listWorkspaces()
      .flatMap((workspace) => mockDb.listProjects(workspace.workspaceId))
      .flatMap((project) => mockDb.listNotes(project.projectId))
      .find(
        (note) =>
          note.meetingStartedBy?.userId !== undefined &&
          note.meetingStartedBy.userId !== mockDb.getCurrentUser().userId &&
          mockDb.getNote(note.noteId).meetingStatus === "IN_PROGRESS"
      );

    expect(foreignNote).toBeDefined();
    const response = await fetch(
      `http://localhost/v1/notes/${foreignNote!.noteId}/transcription-sessions`,
      { method: "POST" }
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toMatchObject({
      success: false,
      data: null,
      error: {
        code: "NOT_MEETING_STARTER",
        message: "회의 시작자만 조작할 수 있습니다.",
      },
    });
  });

  it("returns 409 when ending a meeting that already ended", async () => {
    const note = startedNote();
    mockDb.endMeeting(note.noteId);

    const response = await fetch(
      `http://localhost/v1/notes/${note.noteId}/meeting-end`,
      { method: "POST" }
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("MEETING_ALREADY_ENDED");
  });

  it("returns 409 MEETING_NOT_STARTED before the starter permission error", async () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});

    const response = await fetch(
      `http://localhost/v1/notes/${note.noteId}/meeting-end`,
      { method: "POST" }
    );

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("MEETING_NOT_STARTED");
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

  // 세션을 못 만드는 이유는 "노트가 없다"가 아니라 충돌이다. 404로 흘리면 화면이
  // 노트 404 경로(빈 상태 + 재시도)로 갈라진다. 문구는 계약의 409 예시 그대로여야
  // `errorMessageOf`가 서버 문구를 그리는 것과 어긋나지 않는다.
  it("종료된 회의의 전사 시작을 409 MEETING_ALREADY_ENDED로 거절한다", async () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    const session = mockDb.createSession(note.noteId);
    mockDb.updateSessionStatus(session.sessionId, "COMPLETED");
    mockDb.endMeeting(note.noteId);

    const response = await fetch(
      `http://localhost/v1/notes/${note.noteId}/transcription-sessions`,
      { method: "POST" }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatchObject({
      code: "MEETING_ALREADY_ENDED",
      message: "이미 종료된 회의입니다.",
    });
  });

  it("serves both providers even before anything is connected", async () => {
    const response = await fetch(
      "http://localhost/v1/workspaces/01K0000000000/integrations"
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(
      body.data.integrations.map((i: { provider: string }) => i.provider)
    ).toEqual(["LINEAR", "GITHUB"]);
  });
});
