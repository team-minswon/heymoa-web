import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDb } from "@/lib/mocks/db";
import { MOCK_USER } from "@/lib/mocks/mock-user";

/**
 * 아직 진행 중인 회의 노트. **위치가 아니라 상태로 고른다** — 시드에 종료된 노트가 늘면
 * `[0]`이 그쪽으로 바뀌어 회의 조작 테스트가 통째로 깨진다(실제로 겪었다).
 */
function firstNoteId() {
  const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
  const noteId = mockDb
    .listProjects(workspaceId)
    .flatMap((project) => mockDb.listNotes(project.projectId))
    .find(
      (candidate) =>
        candidate.meetingStatus === "IN_PROGRESS" &&
        candidate.meetingStartedBy?.userId === MOCK_USER.userId
    )?.noteId;
  if (!noteId) throw new Error("진행 중인 노트가 시드에 없다");
  return noteId;
}

/**
 * 회의 조작(종료·중지·재개)은 시작자만 할 수 있다. 녹음을 시작해야 시작자가 정해지므로
 * 그 상태의 노트를 만들어 쓴다. 세션은 바로 끝내 활성 전사 검사에 걸리지 않게 한다.
 */
function startedNoteId() {
  const noteId = firstNoteId();
  const session = mockDb.createSession(noteId);
  mockDb.updateSessionStatus(session.sessionId, "COMPLETED");
  return noteId;
}

describe("mockDb", () => {
  beforeEach(() => mockDb.reset());

  it("seeds the deterministic profile and balanced workspace content", () => {
    expect(mockDb.getCurrentUser()).toEqual(MOCK_USER);
    const workspaces = mockDb.listWorkspaces();
    expect(workspaces).toHaveLength(3);
    // **id로 짚는다** — `listWorkspaces()`가 내리는 순서는 이 테스트의 관심이 아니고,
    // 위치로 짚으면 워크스페이스를 하나 더 시드할 때마다 이 줄이 엉뚱하게 깨진다.
    expect(mockDb.listProjects("01K0000000000")).toHaveLength(2);
    expect(mockDb.listProjects("01K0000000006")).toHaveLength(2);
    // 셋째는 **비어 있는 것이 내용이다** — 새로 만든 워크스페이스는 항상 프로젝트 0으로
    // 시작하고, 그 온보딩 화면의 유일한 표본이다.
    expect(mockDb.listProjects("01K0000000009")).toHaveLength(0);
    expect(
      workspaces.flatMap((workspace) =>
        mockDb
          .listProjects(workspace.workspaceId)
          .flatMap((project) => mockDb.listNotes(project.projectId))
      )
    // 13 + 후보 e2e 전용 셋 — 커버리지 추종(0008)·정리 실패(0006)·합성 원장(0007).
    ).toHaveLength(16);
  });

  it("does not seed IN_PROGRESS without a meeting starter", () => {
    const notes = mockDb
      .listWorkspaces()
      .flatMap((workspace) => mockDb.listProjects(workspace.workspaceId))
      .flatMap((project) => mockDb.listNotes(project.projectId));

    expect(
      notes.filter(
        (note) =>
          note.meetingStatus === "IN_PROGRESS" && note.meetingStartedBy === null
      )
    ).toEqual([]);
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

  it("transitions a new note through recording, pause, and cumulative sessions", () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});

    expect(note.meetingStatus).toBe("NOT_STARTED");

    const first = mockDb.createSession(note.noteId);
    expect(mockDb.getNote(note.noteId).meetingStatus).toBe("IN_PROGRESS");
    mockDb.updateSessionStatus(first.sessionId, "ACTIVE");
    mockDb.updateSessionStatus(first.sessionId, "COMPLETED");

    expect(mockDb.getNote(note.noteId).meetingStatus).toBe("PAUSED");
    expect(
      mockDb
        .listNotes(project.projectId)
        .find((candidate) => candidate.noteId === note.noteId)
    ).toMatchObject({
      recordedDurationMs: 1000,
      activeSessionStartedAt: null,
    });

    const second = mockDb.createSession(note.noteId);
    mockDb.updateSessionStatus(second.sessionId, "ACTIVE");
    mockDb.updateSessionStatus(second.sessionId, "COMPLETED");

    expect(
      mockDb
        .listNotes(project.projectId)
        .find((candidate) => candidate.noteId === note.noteId)
        ?.recordedDurationMs
    ).toBe(2000);
  });

  it("replaces an expired READY session after current returns null", () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    const expired = mockDb.createSession(note.noteId);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.parse(expired.readyExpiresAt) + 1));

    try {
      mockDb.getCurrentSession(note.noteId);
      expect(mockDb.getSession(expired.sessionId)).toMatchObject({
        status: "INTERRUPTED",
        endReason: "READY_TIMEOUT",
      });
      expect(mockDb.getNote(note.noteId).meetingStatus).toBe("PAUSED");
      const replacement = mockDb.createSession(note.noteId);

      expect(replacement.sessionId).not.toBe(expired.sessionId);
    } finally {
      vi.useRealTimers();
    }
  });

  it("terminalizes an expired READY session before replacing it", () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    const expired = mockDb.createSession(note.noteId);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.parse(expired.readyExpiresAt) + 1));

    try {
      mockDb.createSession(note.noteId);

      expect(mockDb.getSession(expired.sessionId)).toMatchObject({
        status: "INTERRUPTED",
        endReason: "READY_TIMEOUT",
      });
      expect(mockDb.getNote(note.noteId).meetingStatus).toBe("IN_PROGRESS");
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    [
      "note detail",
      (projectId: string, noteId: string) => mockDb.getNote(noteId),
    ],
    [
      "note list",
      (projectId: string, noteId: string) =>
        mockDb
          .listNotes(projectId)
          .find((candidate) => candidate.noteId === noteId),
    ],
    [
      "session detail",
      (_projectId: string, _noteId: string, sessionId: string) =>
        mockDb.getSession(sessionId),
    ],
  ])("expires READY from a direct %s read", (_name, read) => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    const session = mockDb.createSession(note.noteId);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.parse(session.readyExpiresAt) + 1));

    try {
      const result = read(project.projectId, note.noteId, session.sessionId);

      expect(result).toMatchObject(
        _name === "session detail"
          ? { status: "INTERRUPTED", endReason: "READY_TIMEOUT" }
          : { meetingStatus: "PAUSED", activeSessionStartedAt: null }
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns derived timing snapshots after a note update", () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    const session = mockDb.createSession(note.noteId);
    mockDb.updateSessionStatus(session.sessionId, "ACTIVE");

    expect(
      mockDb.updateNote(note.noteId, { title: "기록 중 제목" })
    ).toMatchObject({
      activeSessionStartedAt: expect.any(String),
      recordedDurationMs: 0,
    });

    mockDb.updateSessionStatus(session.sessionId, "COMPLETED");
    expect(
      mockDb.updateNote(note.noteId, { title: "중지된 제목" })
    ).toMatchObject({
      activeSessionStartedAt: null,
      recordedDurationMs: 1000,
    });
  });

  it("derives lastRecordedAt from completed sessions, not a newer active session", () => {
    const session = mockDb.createSession("01K0000000002");
    mockDb.updateSessionStatus(session.sessionId, "ACTIVE");

    const note = mockDb
      .listNotes("01K0000000001")
      .find((candidate) => candidate.noteId === "01K0000000002");

    expect(note?.lastRecordedAt).toBe("2026-07-11T00:00:00Z");
  });

  it("keeps every persisted transcript offset non-null", () => {
    const segments = mockDb.listSegments("01K0000000002");
    expect(segments).toHaveLength(3);
    expect(
      segments.every(
        (segment) =>
          Number.isInteger(segment.startedAtMs) &&
          Number.isInteger(segment.endedAtMs)
      )
    ).toBe(true);
  });

  it("seeds an in-progress meeting started by another user with a transcript", () => {
    const foreignNote = mockDb
      .listWorkspaces()
      .flatMap((workspace) => mockDb.listProjects(workspace.workspaceId))
      .flatMap((project) => mockDb.listNotes(project.projectId))
      .find(
        (note) =>
          note.meetingStartedBy?.userId !== undefined &&
          note.meetingStartedBy.userId !== MOCK_USER.userId &&
          mockDb.getNote(note.noteId).meetingStatus === "IN_PROGRESS"
      );

    expect(foreignNote).toBeDefined();
    expect(mockDb.listSegments(foreignNote!.noteId)).toHaveLength(3);
  });
});

describe("invitations, members and notifications", () => {
  beforeEach(() => mockDb.reset());

  it("accepting an invitation adds a member and clears the pending row", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
    const before = mockDb.listMembers(workspaceId).length;

    const invitation = mockDb.createInvitation(workspaceId, {
      email: "new@heymoa.com",
      role: "MEMBER",
    });
    expect(mockDb.listInvitations(workspaceId)).toHaveLength(1);

    mockDb.acceptInvitation(invitation.invitationId);

    expect(mockDb.listMembers(workspaceId)).toHaveLength(before + 1);
    expect(mockDb.listInvitations(workspaceId)).toEqual([]);
  });

  it("normalizes mixed-case invite emails like the server does", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;

    mockDb.createInvitation(workspaceId, {
      email: " Sora@Heymoa.app ",
      role: "MEMBER",
    });

    expect(mockDb.listInvitations(workspaceId)[0].inviteeEmail).toBe(
      "sora@heymoa.app"
    );
  });

  it("accepting an expired invitation by token fails and marks it EXPIRED", () => {
    // 01K0000000026 — 만료 지난 PENDING 시드
    expect(() => mockDb.acceptInvitationByToken("01K0000000026")).toThrowError(
      "INVITATION_EXPIRED"
    );
    expect(() => mockDb.acceptInvitationByToken("01K0000000026")).toThrowError(
      "INVITATION_NOT_PENDING"
    );
  });

  it("accepting another user's invitation by token fails with email mismatch", () => {
    // 01K0000000025 — stranger@heymoa.dev 대상 시드
    expect(() => mockDb.acceptInvitationByToken("01K0000000025")).toThrowError(
      "INVITATION_EMAIL_MISMATCH"
    );
  });

  it("declining an invitation leaves the member list untouched", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
    const before = mockDb.listMembers(workspaceId).length;
    const invitation = mockDb.createInvitation(workspaceId, {
      email: "nope@heymoa.com",
      role: "MEMBER",
    });

    mockDb.declineInvitation(invitation.invitationId);

    expect(mockDb.listMembers(workspaceId)).toHaveLength(before);
    expect(mockDb.listInvitations(workspaceId)).toEqual([]);
  });

  it("rejects a duplicate pending invitation for the same email", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
    mockDb.createInvitation(workspaceId, {
      email: "dup@heymoa.com",
      role: "MEMBER",
    });

    expect(() =>
      mockDb.createInvitation(workspaceId, {
        email: "dup@heymoa.com",
        role: "MEMBER",
      })
    ).toThrow("DUPLICATE_PENDING_INVITATION");
  });

  it("rejects inviting someone who is already a member", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
    const existing = mockDb.listMembers(workspaceId)[0];

    expect(() =>
      mockDb.createInvitation(workspaceId, {
        email: existing.email,
        role: "MEMBER",
      })
    ).toThrow("ALREADY_WORKSPACE_MEMBER");
  });

  it("reading a notification lowers the unread count", () => {
    const first = mockDb.listNotifications();
    expect(first.unreadCount).toBeGreaterThan(0);

    mockDb.markNotificationRead(first.notifications[0].notificationId);

    expect(mockDb.listNotifications().unreadCount).toBe(first.unreadCount - 1);
  });

  it("keeps the notification in sync with the invitation it points at", () => {
    const pending = mockDb
      .listNotifications()
      .notifications.find((item) => item.invitation?.status === "PENDING");
    const invitationId = pending!.invitation!.invitationId;

    mockDb.cancelInvitation(invitationId);

    const after = mockDb
      .listNotifications()
      .notifications.find(
        (item) => item.notificationId === pending!.notificationId
      );
    // 취소된 초대의 알림도 목록에 남고, 상태만 현재 값을 따라간다 (계약 규칙).
    expect(after?.invitation?.status).toBe("CANCELED");
  });
});

describe("workspace member management", () => {
  beforeEach(() => mockDb.reset());

  const WORKSPACE_ID = "01K0000000000"; // 시드: 나(ADMIN) + 한지원(01K0000000020, MEMBER)
  const OTHER_MEMBER_ID = "01K0000000020";

  /** 자신을 강등·추방·탈퇴시켜도 마지막 ADMIN 규칙에 걸리지 않도록 관리자를 하나 더 만든다. */
  function addSecondAdmin() {
    mockDb.changeMemberRole(WORKSPACE_ID, OTHER_MEMBER_ID, "ADMIN");
  }

  it("역할 변경은 마지막 ADMIN을 MEMBER로 내리는 것을 막는다", () => {
    expect(() =>
      mockDb.changeMemberRole(WORKSPACE_ID, MOCK_USER.userId, "MEMBER")
    ).toThrow("LAST_WORKSPACE_ADMIN");
    // 실패했으니 역할은 그대로다.
    expect(
      mockDb
        .listMembers(WORKSPACE_ID)
        .find((m) => m.userId === MOCK_USER.userId)?.role
    ).toBe("ADMIN");
  });

  it("같은 역할로 바꾸는 것은 그냥 성공한다 (no-op)", () => {
    expect(() =>
      mockDb.changeMemberRole(WORKSPACE_ID, MOCK_USER.userId, "ADMIN")
    ).not.toThrow();
  });

  it("두 번째 ADMIN이 있으면 한쪽을 내려도 통과한다", () => {
    addSecondAdmin();

    expect(() =>
      mockDb.changeMemberRole(WORKSPACE_ID, MOCK_USER.userId, "MEMBER")
    ).not.toThrow();
    expect(
      mockDb
        .listMembers(WORKSPACE_ID)
        .find((m) => m.userId === MOCK_USER.userId)?.role
    ).toBe("MEMBER");
  });

  it("역할 변경 대상이 멤버가 아니면 404 코드로 던진다", () => {
    expect(() =>
      mockDb.changeMemberRole(WORKSPACE_ID, "01K9999999999", "ADMIN")
    ).toThrow("WORKSPACE_MEMBER_NOT_FOUND");
  });

  // 서버 WorkspaceAccessHandler는 requireMember(404) → 역할 확인(403) 순이다. 즉 403은
  // "멤버지만 ADMIN이 아니다"일 때만 나오고, 멤버가 아니면 워크스페이스의 존재 자체를 숨긴다.
  it.each([
    ["없는 워크스페이스", "01K9999999999"],
    ["초대만 받고 합류하지 않은 워크스페이스", "01K0000000030"],
  ])("%s는 403이 아니라 404다", (_label, workspaceId) => {
    expect(() =>
      mockDb.changeMemberRole(workspaceId, OTHER_MEMBER_ID, "ADMIN")
    ).toThrow("WORKSPACE_NOT_FOUND");
    expect(() => mockDb.removeMember(workspaceId, OTHER_MEMBER_ID)).toThrow(
      "WORKSPACE_NOT_FOUND"
    );
  });

  it("계약에 없는 역할은 400이고 멤버를 바꾸지 않는다", () => {
    expect(() =>
      mockDb.changeMemberRole(WORKSPACE_ID, OTHER_MEMBER_ID, "OWNER")
    ).toThrow("BAD_REQUEST");
    expect(
      mockDb.listMembers(WORKSPACE_ID).find((m) => m.userId === OTHER_MEMBER_ID)
        ?.role
    ).toBe("MEMBER");
  });

  it("본인을 강등하면 워크스페이스 응답의 역할도 따라간다", () => {
    addSecondAdmin();

    mockDb.changeMemberRole(WORKSPACE_ID, MOCK_USER.userId, "MEMBER");

    // 멤버 명단과 워크스페이스 응답은 같은 멤버십을 두 벌로 들고 있다. 한쪽만 고치면
    // 멤버 탭은 MEMBER인데 사이드바·권한 분기는 ADMIN으로 남는다.
    expect(mockDb.getWorkspace(WORKSPACE_ID).role).toBe("MEMBER");
    expect(
      mockDb.listWorkspaces().find((w) => w.workspaceId === WORKSPACE_ID)?.role
    ).toBe("MEMBER");
  });

  it("ADMIN이 아닌 사람은 역할을 바꿀 수 없다", () => {
    addSecondAdmin();
    mockDb.changeMemberRole(WORKSPACE_ID, MOCK_USER.userId, "MEMBER"); // 나를 MEMBER로

    expect(() =>
      mockDb.changeMemberRole(WORKSPACE_ID, OTHER_MEMBER_ID, "MEMBER")
    ).toThrow("WORKSPACE_ACCESS_DENIED");
  });

  it("추방은 자기 자신을 대상으로 할 수 없다", () => {
    expect(() => mockDb.removeMember(WORKSPACE_ID, MOCK_USER.userId)).toThrow(
      "BAD_REQUEST"
    );
    // 실패했으니 멤버 목록은 그대로다.
    expect(
      mockDb
        .listMembers(WORKSPACE_ID)
        .some((m) => m.userId === MOCK_USER.userId)
    ).toBe(true);
  });

  it("추방은 멤버 목록에서 대상을 지운다", () => {
    const before = mockDb.listMembers(WORKSPACE_ID).length;

    mockDb.removeMember(WORKSPACE_ID, OTHER_MEMBER_ID);

    expect(mockDb.listMembers(WORKSPACE_ID)).toHaveLength(before - 1);
    expect(
      mockDb.listMembers(WORKSPACE_ID).some((m) => m.userId === OTHER_MEMBER_ID)
    ).toBe(false);
  });

  it("추방 대상이 멤버가 아니면 404 코드로 던진다", () => {
    expect(() => mockDb.removeMember(WORKSPACE_ID, "01K9999999999")).toThrow(
      "WORKSPACE_MEMBER_NOT_FOUND"
    );
  });

  it("ADMIN이 아닌 사람은 추방할 수 없다", () => {
    addSecondAdmin();
    mockDb.changeMemberRole(WORKSPACE_ID, MOCK_USER.userId, "MEMBER");

    expect(() => mockDb.removeMember(WORKSPACE_ID, OTHER_MEMBER_ID)).toThrow(
      "WORKSPACE_ACCESS_DENIED"
    );
  });

  it("나가기는 마지막 ADMIN을 막는다", () => {
    expect(() => mockDb.leaveWorkspace(WORKSPACE_ID)).toThrow(
      "LAST_WORKSPACE_ADMIN"
    );
  });

  it("나가면 워크스페이스가 목록과 조회에서도 사라진다", () => {
    addSecondAdmin();
    expect(
      mockDb.listWorkspaces().some((w) => w.workspaceId === WORKSPACE_ID)
    ).toBe(true);

    expect(() => mockDb.leaveWorkspace(WORKSPACE_ID)).not.toThrow();

    // 멤버 행만 지우면 목록·조회가 떠난 공간을 계속 반환한다 — 합류(초대 수락)가 두 곳에
    // 넣으므로 탈퇴도 두 곳에서 빼야 한다.
    expect(
      mockDb.listWorkspaces().some((w) => w.workspaceId === WORKSPACE_ID)
    ).toBe(false);
    expect(() => mockDb.getWorkspace(WORKSPACE_ID)).toThrow(
      "WORKSPACE_NOT_FOUND"
    );
    expect(() => mockDb.listMembers(WORKSPACE_ID)).toThrow(
      "WORKSPACE_NOT_FOUND"
    );
  });

  it("멤버가 아닌 워크스페이스는 나가기에서 WORKSPACE_NOT_FOUND다 (추방과 다른 코드)", () => {
    // 01K0000000030 — 초대만 와 있고 아직 합류하지 않은 워크스페이스.
    expect(() => mockDb.leaveWorkspace("01K0000000030")).toThrow(
      "WORKSPACE_NOT_FOUND"
    );
  });
});

describe("참여자 전체 교체와 떠난 사람", () => {
  const WORKSPACE_ID = "01K0000000000";
  const NOTE_ID = "01K0000000020";

  /**
   * 서버는 **이미 이 회의의 참여자면 멤버가 아니어도** 전체 교체에 실어 유지할 수 있다.
   * 목이 멤버 목록만 훑으면 그 사람이 조용히 빠지고 화자 연결까지 풀린다 — 목과 서버가
   * 갈라지면 화면 테스트가 전부 거짓으로 통과한다.
   */
  it("내보낸 멤버도 요청에 실으면 참여자로 남는다", () => {
    const before = mockDb.getNote(NOTE_ID).participants.filter((row) => row.userId);
    const departing = before.find((row) => row.userId !== mockDb.getCurrentUser().userId)!;

    mockDb.removeMember(WORKSPACE_ID, departing.userId!);

    mockDb.replaceNoteParticipants(
      NOTE_ID,
      before.map((row) => row.userId!)
    );

    const after = mockDb.getNote(NOTE_ID).participants;
    const kept = after.find((row) => row.userId === departing.userId);
    expect(kept).toBeDefined();
    // 참여 기록 id 가 그대로여야 화자 연결이 산다 (APP-480)
    expect(kept!.participantId).toBe(departing.participantId);
  });
});

describe("meeting and analysis", () => {
  beforeEach(() => mockDb.reset());

  it("ending a meeting queues an analysis that later completes", () => {
    const noteId = startedNoteId();

    mockDb.endMeeting(noteId);
    expect(mockDb.getLatestAnalysis(noteId).status).toBe("PENDING");

    mockDb.advanceAnalysis(noteId);

    const done = mockDb.getLatestAnalysis(noteId);
    expect(done.status).toBe("SUCCEEDED");
    expect(done.sections.map((section) => section.kind)).toEqual([
      "OVERVIEW",
      "ACTION_ITEM",
      "DECISION",
    ]);
    // 근거 0개 항목도 남는다(설계 D2) — 목이 한쪽만 심으면 칩 없는 분기가 안 그려진다.
    const items = done.sections.flatMap((section) => section.items);
    expect(items.some((item) => item.evidence.length > 0)).toBe(true);
    expect(items.some((item) => item.evidence.length === 0)).toBe(true);
  });

  it("근거는 그 노트에 실제로 있는 세그먼트만 가리킨다", () => {
    const noteId = "01K0000000002";
    const segmentIds = new Set(
      mockDb.listSegments(noteId).map((segment) => segment.segmentId)
    );
    mockDb.endMeeting(noteId);
    const done = mockDb.advanceAnalysis(noteId)!;

    const evidence = done.sections
      .flatMap((section) => section.items)
      .flatMap((item) => item.evidence);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.every((row) => segmentIds.has(row.segmentId))).toBe(true);
  });

  it("refuses to end a meeting that already ended", () => {
    const noteId = startedNoteId();
    mockDb.endMeeting(noteId);

    expect(() => mockDb.endMeeting(noteId)).toThrow("MEETING_ALREADY_ENDED");
  });

  it("refuses to end a meeting that has not started before checking its starter", () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});

    expect(() => mockDb.endMeeting(note.noteId)).toThrow("MEETING_NOT_STARTED");
  });

  // 계약의 409에 MEETING_ALREADY_ENDED가 생겼다(APP-214, server@a582684). 서버는 원래부터
  // 막고 있었고 없던 것이 계약뿐이었다 — 그래서 목만 그 사실을 몰라 로컬이 초록이었다.
  it("refuses to start transcription on an ended meeting", () => {
    const noteId = startedNoteId();
    mockDb.endMeeting(noteId);

    expect(() => mockDb.createSession(noteId)).toThrow("MEETING_ALREADY_ENDED");
  });
});

describe("workspace integrations", () => {
  beforeEach(() => mockDb.reset());

  // 계약은 미연동 provider도 목록에 담는다 (connected: false). 화면이 "연결하기"
  // 버튼을 그리려면 아직 안 붙은 도구도 알아야 하기 때문이다.
  it("lists every supported provider, connected or not", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;

    expect(mockDb.listIntegrations(workspaceId).map((i) => i.provider)).toEqual(
      ["LINEAR", "GITHUB"]
    );
    expect(
      mockDb.listIntegrations(workspaceId).every((i) => i.connected === false)
    ).toBe(true);
  });

  it("connecting records who connected it and when", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;

    mockDb.connectIntegration(workspaceId, "LINEAR");

    const linear = mockDb
      .listIntegrations(workspaceId)
      .find((item) => item.provider === "LINEAR");
    expect(linear?.connected).toBe(true);
    expect(linear?.connectedBy).toBe("테스트 유저");
    expect(linear?.connectedAt).toBeTruthy();
  });

  it("disconnecting clears the connection but keeps the row", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
    mockDb.connectIntegration(workspaceId, "LINEAR");

    mockDb.disconnectIntegration(workspaceId, "LINEAR");

    const linear = mockDb
      .listIntegrations(workspaceId)
      .find((item) => item.provider === "LINEAR");
    expect(linear?.connected).toBe(false);
    expect(linear?.connectedBy).toBeNull();
    expect(linear?.connectedAt).toBeNull();
  });
});

describe("workspaces gained after seeding", () => {
  beforeEach(() => mockDb.reset());

  it("gives a created workspace its owner and integration rows", () => {
    const created = mockDb.createWorkspace({
      name: "새 팀",
      description: null,
    });

    expect(mockDb.listMembers(created.workspaceId)).toHaveLength(1);
    expect(mockDb.listMembers(created.workspaceId)[0].role).toBe("ADMIN");
    expect(
      mockDb.listIntegrations(created.workspaceId).map((i) => i.provider)
    ).toEqual(["LINEAR", "GITHUB"]);
  });

  it("joins the invited workspace when the invitation is accepted", () => {
    const before = mockDb.listWorkspaces().length;
    const invitation = mockDb
      .listNotifications()
      .notifications.find(
        (item) => item.invitation?.status === "PENDING"
      )!.invitation!;

    mockDb.acceptInvitation(invitation.invitationId);

    expect(mockDb.listWorkspaces()).toHaveLength(before + 1);
    expect(mockDb.listMembers(invitation.workspaceId)).toHaveLength(1);
    expect(
      mockDb.listIntegrations(invitation.workspaceId).map((i) => i.provider)
    ).toEqual(["LINEAR", "GITHUB"]);
  });
});

describe("only the meeting starter can operate a meeting", () => {
  beforeEach(() => mockDb.reset());

  // 새 노트는 NOT_STARTED라 회의 종료 자체가 409 MEETING_NOT_STARTED다.
  it("refuses ending a note nobody started", () => {
    const projectId = mockDb.listProjects(
      mockDb.listWorkspaces()[0].workspaceId
    )[0].projectId;
    const fresh = mockDb.createNote(projectId, { title: "아직 시작 전" });

    expect(fresh.meetingStartedBy).toBeNull();
    expect(() => mockDb.endMeeting(fresh.noteId)).toThrow(
      "MEETING_NOT_STARTED"
    );
  });

  it("allows them once recording has started", () => {
    const projectId = mockDb.listProjects(
      mockDb.listWorkspaces()[0].workspaceId
    )[0].projectId;
    const note = mockDb.createNote(projectId, { title: "시작함" });
    const session = mockDb.createSession(note.noteId);
    mockDb.updateSessionStatus(session.sessionId, "COMPLETED");

    expect(mockDb.endMeeting(note.noteId)).toBeTruthy();
  });
});

describe("노트 삭제", () => {
  beforeEach(() => mockDb.reset());

  it("기록 중인 회의는 못 지운다", () => {
    const live = mockDb
      .listNotes("01K0000000001")
      .find((row) => row.meetingStatus === "IN_PROGRESS");
    expect(live).toBeDefined();
    expect(() => mockDb.deleteNote(live!.noteId)).toThrow(
      "MEETING_IN_PROGRESS"
    );
  });

  it("지우면 전사 세그먼트와 요약도 함께 사라진다", () => {
    const target = mockDb
      .listNotes("01K0000000001")
      .find((row) => row.meetingStatus !== "IN_PROGRESS");
    expect(target).toBeDefined();
    const noteId = target!.noteId;
    // 서버는 FK CASCADE가 지운다(APP-335 V18). 목이 안 지우면 "지웠는데 요약이 남는" 상태가
    // 목에서만 만들어져 화면 검증이 거짓이 된다.
    expect(mockDb.listSegments(noteId).length).toBeGreaterThanOrEqual(0);

    mockDb.deleteNote(noteId);

    expect(() => mockDb.getNote(noteId)).toThrow("NOTE_NOT_FOUND");
    expect(() => mockDb.listSegments(noteId)).toThrow("NOTE_NOT_FOUND");
    expect(() => mockDb.getLatestAnalysis(noteId)).toThrow();
  });

  /**
   * 서버는 세션 조회에도 멤버십을 본다 — 노트 → 프로젝트 → 워크스페이스를 따라가
   * 비멤버에게는 존재를 숨기려고 404 `WORKSPACE_NOT_FOUND`를 준다
   * (`NoteAccessHandler.requireProjectMember` → `WorkspaceNotFoundException`).
   *
   * 목이 200을 주면 **추방 뒤 녹음을 끊는 경로가 목에서만 안 돈다.** 화면 검증이 거짓이 된다.
   */
  // 권한 승인과 세션 생성 POST 사이에도 추방될 수 있다. 서버는 생성에도 멤버십을 보는데,
  // 목이 201을 주면 **시작 중 추방 처리 경로가 개발 환경에서만 안 돈다.**
  it("워크스페이스를 나가면 그 노트의 세션 생성도 404다", () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});

    mockDb.changeMemberRole("01K0000000000", "01K0000000020", "ADMIN");
    mockDb.leaveWorkspace("01K0000000000");

    expect(() => mockDb.createSession(note.noteId)).toThrow(
      "WORKSPACE_NOT_FOUND"
    );
  });

  it("워크스페이스를 나가면 그 노트의 세션 조회도 404다", () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    const session = mockDb.createSession(note.noteId);
    expect(mockDb.getSession(session.sessionId)).toMatchObject({
      sessionId: session.sessionId,
    });

    // 나 혼자 ADMIN이면 나갈 수 없다(`LAST_WORKSPACE_ADMIN`). 다른 멤버를 올리고 나간다.
    mockDb.changeMemberRole("01K0000000000", "01K0000000020", "ADMIN");
    mockDb.leaveWorkspace("01K0000000000");

    expect(() => mockDb.getSession(session.sessionId)).toThrow(
      "WORKSPACE_NOT_FOUND"
    );
  });

  /**
   * 워크스페이스와 프로젝트가 어긋난 조합은 **403이 아니라 404다.** 서버가
   * `findByWorkspaceIdAndProjectId(...)` 한 번으로 찾고 없으면 `ProjectNotFoundException`을
   * 던진다(조회·수정·삭제 셋 다 같다).
   *
   * 목이 `FORBIDDEN`을 주면 `/w/B/notes/<A의 노트>` 딥링크를 판정하는 화면이 목에서만
   * 다르게 동작한다 — 코드로 가리기 때문이다.
   */
  it("다른 워크스페이스의 프로젝트를 조회하면 404다", () => {
    const mine = mockDb.listProjects("01K0000000000")[0];

    expect(() => mockDb.getProject("01K0000000006", mine.projectId)).toThrow(
      "PROJECT_NOT_FOUND"
    );
    expect(mockDb.getProject("01K0000000000", mine.projectId)).toMatchObject({
      projectId: mine.projectId,
    });
  });
});

describe("대화가 여럿 산다", () => {
  beforeEach(() => mockDb.reset());

  function workspaceId() {
    return mockDb.listWorkspaces()[0].workspaceId;
  }

  it("새 대화가 앞 대화를 안 죽인다 — 목록에 한 줄이 늘 뿐이다", () => {
    // 시드에 이미 나이 든 대화들이 있다(날짜 묶음을 목에서 보려고). 늘어난 두 줄이
    // **맨 위에** 서는지만 본다 — 그것이 「안 죽인다」의 내용이다.
    const before = mockDb.listAgentChats({ workspaceId: workspaceId() }).length;
    const first = mockDb.createAgentChat({ workspaceId: workspaceId() });
    const second = mockDb.createAgentChat({ workspaceId: workspaceId() });

    const listed = mockDb
      .listAgentChats({ workspaceId: workspaceId() })
      .map((c) => c.chatId);
    expect(listed).toHaveLength(before + 2);
    expect(listed.slice(0, 2)).toEqual([second.chatId, first.chatId]);
  });

  it("★ 방금 만든 대화가 시드보다 위에 선다", () => {
    // 시드는 「지금」에서 거꾸로 잡은 시각이고 목의 기본 시계는 2026-07-11 에 굳어 있다.
    // 둘을 섞으면 방금 만든 대화가 목록 **맨 아래**에 「44일 전」으로 선다.
    const created = mockDb.createAgentChat({ workspaceId: workspaceId() });
    const [top] = mockDb.listAgentChats({ workspaceId: workspaceId() });

    expect(top.chatId).toBe(created.chatId);
    expect(Date.parse(top.updatedAt)).toBeGreaterThan(Date.now() - 60_000);
  });

  it("마지막으로 쓴 대화가 첫 줄이 된다", () => {
    // **생성 시각으로만 정렬하면 여기서 거짓말이 된다.** 옛 대화에 다시 쓰면 그것이
    // 마지막으로 쓴 대화이고, 새로고침한 화면이 돌아갈 곳도 거기다.
    const older = mockDb.createAgentChat({ workspaceId: workspaceId() });
    mockDb.createAgentChat({ workspaceId: workspaceId() });

    mockDb.appendAgentChatMessage(older.chatId, {
      role: "USER",
      content: "다시 물어봅니다",
      scope: [],
      toolEvent: null,
    });

    expect(
      mockDb.listAgentChats({ workspaceId: workspaceId() })[0].chatId
    ).toBe(older.chatId);
  });

  it("첫 USER 메시지가 기본 제목을 채우고, 사용자가 정한 제목은 안 덮는다", () => {
    const auto = mockDb.createAgentChat({ workspaceId: workspaceId() });
    const named = mockDb.createAgentChat({
      workspaceId: workspaceId(),
      title: "내가 정한 제목",
    });
    expect(auto.title).toBe("새 대화");

    for (const chatId of [auto.chatId, named.chatId]) {
      mockDb.appendAgentChatMessage(chatId, {
        role: "USER",
        content: "지난  회의에서\n정한 것만 정리해줘",
        scope: [],
        toolEvent: null,
      });
      // 두 번째 USER 메시지는 제목을 못 바꾼다 — 이미 기본값이 아니다.
      mockDb.appendAgentChatMessage(chatId, {
        role: "USER",
        content: "그리고 이건 제목이 되면 안 됩니다",
        scope: [],
        toolEvent: null,
      });
    }

    const titles = Object.fromEntries(
      mockDb
        .listAgentChats({ workspaceId: workspaceId() })
        .map((chat) => [chat.chatId, chat.title])
    );
    // 줄바꿈과 이중 공백이 한 줄로 접힌다 — 목록은 한 줄이다.
    expect(titles[auto.chatId]).toBe("지난 회의에서 정한 것만 정리해줘");
    expect(titles[named.chatId]).toBe("내가 정한 제목");
  });

  it("★ 제목에서 마커를 사람 말로 되돌린다", () => {
    // 안 걷으면 목록에 `@[주간 회의](noteId:…) 액션 정리해줘` 가 그대로 뜬다.
    // 실제 서버(`AgentChat.fillTitleFromFirstMessage`)가 하는 일과 같아야 한다.
    const chat = mockDb.createAgentChat({ workspaceId: workspaceId() });
    mockDb.appendAgentChatMessage(chat.chatId, {
      role: "USER",
      content: "@[알림 정책 논의 (2차)](noteId:01K0000000021) 액션 정리해줘",
      scope: [],
      toolEvent: null,
    });

    expect(
      mockDb
        .listAgentChats({ workspaceId: workspaceId() })
        .find((each) => each.chatId === chat.chatId)?.title
    ).toBe("알림 정책 논의 (2차) 액션 정리해줘");
  });

  it("제목을 컬럼 상한에서 자른다", () => {
    const chat = mockDb.createAgentChat({ workspaceId: workspaceId() });
    mockDb.appendAgentChatMessage(chat.chatId, {
      role: "USER",
      content: "가".repeat(300),
      scope: [],
      toolEvent: null,
    });

    expect(
      mockDb.listAgentChats({ workspaceId: workspaceId() })[0].title
    ).toHaveLength(200);
  });

  it("최근 50개까지만 준다", () => {
    // 상한이 없으면 51번째가 실서버에서 처음 사라진다 — 목이 관대하면 안 보인다.
    for (let i = 0; i < 55; i += 1) {
      mockDb.createAgentChat({ workspaceId: workspaceId() });
    }
    const chats = mockDb.listAgentChats({ workspaceId: workspaceId() });

    expect(chats).toHaveLength(50);
    // 잘리는 쪽은 **오래된 쪽**이다.
    expect(chats[0].updatedAt >= chats[49].updatedAt).toBe(true);
  });

  it("다른 워크스페이스의 대화는 안 섞이고, 없는 워크스페이스는 404다", () => {
    const [first, second] = mockDb.listWorkspaces();
    mockDb.createAgentChat({ workspaceId: first.workspaceId });

    expect(mockDb.listAgentChats({ workspaceId: second.workspaceId })).toEqual(
      []
    );
    // 멤버가 아니면 존재를 은닉한다 (생성과 같은 규칙).
    expect(() =>
      mockDb.listAgentChats({ workspaceId: "01KNOTAMEMBER" })
    ).toThrow("WORKSPACE_NOT_FOUND");
  });
});
