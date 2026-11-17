import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDb } from "@/lib/mocks/db";
import { MOCK_ACCOUNT, MOCK_USER } from "@/lib/mocks/mock-user";

function startedNoteId() {
  const noteId = "01K0000000002";
  const session = mockDb.getCurrentSession(noteId);
  if (!session) throw new Error("진행 중인 시드의 열린 세션이 없다");
  mockDb.updateSessionStatus(session.sessionId, "COMPLETED");
  return noteId;
}

describe("mockDb", () => {
  beforeEach(() => mockDb.reset());

  it("seeds the deterministic profile and balanced workspace content", () => {
    expect(mockDb.getCurrentUser()).toEqual({ ...MOCK_USER, ...MOCK_ACCOUNT });
    const workspaces = mockDb.listWorkspaces();
    expect(workspaces).toHaveLength(3);
    expect(mockDb.listProjects("01K0000000000")).toHaveLength(2);
    expect(mockDb.listProjects("01K0000000006")).toHaveLength(2);
    expect(mockDb.listProjects("01K0000000009")).toHaveLength(0);
    expect(
      workspaces.flatMap((workspace) =>
        mockDb
          .listProjects(workspace.workspaceId)
          .flatMap((project) => mockDb.listNotes(project.projectId))
      )
    ).toHaveLength(19);
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

  it("진행 중인 시드는 실제 열린 세션을 갖고 일시정지된 시드에는 없다", () => {
    const notes = mockDb
      .listWorkspaces()
      .flatMap((workspace) => mockDb.listProjects(workspace.workspaceId))
      .flatMap((project) => mockDb.listNotes(project.projectId));

    for (const note of notes) {
      const current = mockDb.getCurrentSession(note.noteId);
      if (note.meetingStatus === "IN_PROGRESS") {
        expect(current, note.noteId).not.toBeNull();
        expect(current?.status).toBe("ACTIVE");
        expect(note.activeSessionStartedAt).toBe(current?.startedAt);
      } else {
        expect(current, note.noteId).toBeNull();
      }
    }
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

  it("closes the open session when the same clientInstanceId starts again", () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});
    const first = mockDb.createSession(note.noteId, "tab-a");
    mockDb.updateSessionStatus(first.sessionId, "ACTIVE");

    expect(() => mockDb.createSession(note.noteId, "tab-b")).toThrow(
      "ACTIVE_TRANSCRIPTION_SESSION"
    );
    const second = mockDb.createSession(note.noteId, "tab-a");

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(mockDb.getSession(first.sessionId)).toMatchObject({
      status: "INTERRUPTED",
      endReason: "HEARTBEAT_TIMEOUT",
    });
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
      mockDb.updateNote(note.noteId, { title: "일시정지된 제목" })
    ).toMatchObject({
      activeSessionStartedAt: null,
      recordedDurationMs: 1000,
    });
  });

  it("derives lastRecordedAt from completed sessions, not a newer active session", () => {
    const note = mockDb
      .listNotes("01K0000000001")
      .find((candidate) => candidate.noteId === "01K0000000002");

    expect(mockDb.getCurrentSession("01K0000000002")?.status).toBe("ACTIVE");
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

  it.each(["READY", "ACTIVE"])(
    "★ %s 세션이 열린 기록 중 회의는 MEETING_RECORDING 으로 거절한다",
    (status) => {
      const [project] = mockDb.listProjects("01K0000000000");
      const note = mockDb.createNote(project.projectId, { title: "기록 중" });
      const session = mockDb.createSession(note.noteId);
      if (status === "ACTIVE") {
        mockDb.updateSessionStatus(session.sessionId, "ACTIVE");
      }

      expect(() => mockDb.endMeeting(note.noteId)).toThrow("MEETING_RECORDING");
      expect(mockDb.getNote(note.noteId).meetingStatus).toBe("IN_PROGRESS");
    }
  );

  it("★ 일시정지한 뒤 끝낸 회의의 봉인은 COMPLETE 다", () => {
    const [project] = mockDb.listProjects("01K0000000000");
    const note = mockDb.createNote(project.projectId, { title: "끝낸 회의" });
    const session = mockDb.createSession(note.noteId);
    mockDb.updateSessionStatus(session.sessionId, "ACTIVE");
    mockDb.updateSessionStatus(session.sessionId, "COMPLETED");

    mockDb.endMeeting(note.noteId);

    const { recording } = mockDb.getTranscript(note.noteId);
    expect(recording.seal).toBe("COMPLETE");
    expect(recording.audioRetained).toBe(true);
  });

  it("★ 방금 만든 노트가 시드보다 위에 선다", () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const created = mockDb.createNote(project.projectId, { title: "새 노트" });

    const [top] = mockDb.listWorkspaceNotes("01K0000000000");

    expect(top.noteId).toBe(created.noteId);
  });

  it("제목만 고쳐도 회의 목록의 시작 순서는 바뀌지 않는다", () => {
    const projectId = mockDb.listProjects("01K0000000000")[0].projectId;
    const older = mockDb.createNote(projectId, { title: "먼저 만든 노트" });
    const newer = mockDb.createNote(projectId, { title: "나중에 만든 노트" });
    mockDb.updateNote(older.noteId, { title: "제목만 수정" });

    const ids = mockDb
      .listWorkspaceNotes("01K0000000000")
      .map((note) => note.noteId);
    expect(ids.indexOf(newer.noteId)).toBeLessThan(ids.indexOf(older.noteId));
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
    expect(() => mockDb.acceptInvitationByToken("01K0000000026")).toThrowError(
      "INVITATION_EXPIRED"
    );
    expect(() => mockDb.acceptInvitationByToken("01K0000000026")).toThrowError(
      "INVITATION_NOT_PENDING"
    );
  });

  it("accepting another user's invitation by token fails with email mismatch", () => {
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
    expect(after?.invitation?.status).toBe("CANCELED");
  });
});

describe("workspace member management", () => {
  beforeEach(() => mockDb.reset());

  const WORKSPACE_ID = "01K0000000000";
  const OTHER_MEMBER_ID = "01K0000000020";

  function addSecondAdmin() {
    mockDb.changeMemberRole(WORKSPACE_ID, OTHER_MEMBER_ID, "ADMIN");
  }

  it("역할 변경은 마지막 ADMIN을 MEMBER로 내리는 것을 막는다", () => {
    expect(() =>
      mockDb.changeMemberRole(WORKSPACE_ID, MOCK_USER.userId, "MEMBER")
    ).toThrow("LAST_WORKSPACE_ADMIN");
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
    ).toThrow("NOT_FOUND");
  });

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

    expect(mockDb.getWorkspace(WORKSPACE_ID).role).toBe("MEMBER");
    expect(
      mockDb.listWorkspaces().find((w) => w.workspaceId === WORKSPACE_ID)?.role
    ).toBe("MEMBER");
  });

  it("ADMIN이 아닌 사람은 역할을 바꿀 수 없다", () => {
    addSecondAdmin();
    mockDb.changeMemberRole(WORKSPACE_ID, MOCK_USER.userId, "MEMBER");

    expect(() =>
      mockDb.changeMemberRole(WORKSPACE_ID, OTHER_MEMBER_ID, "MEMBER")
    ).toThrow("WORKSPACE_ACCESS_DENIED");
  });

  it("추방은 자기 자신을 대상으로 할 수 없다", () => {
    expect(() => mockDb.removeMember(WORKSPACE_ID, MOCK_USER.userId)).toThrow(
      "BAD_REQUEST"
    );
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
      "NOT_FOUND"
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
    expect(() =>
      mockDb.leaveWorkspace(
        WORKSPACE_ID,
        mockDb.getWorkspace(WORKSPACE_ID).name
      )
    ).toThrow("LAST_WORKSPACE_ADMIN");
  });

  it("나가면 그 워크스페이스에 맡긴 외부 에이전트 연결이 탈퇴로 회수된다", () => {
    addSecondAdmin();
    const { delegation } = mockDb.createAgentDelegation(WORKSPACE_ID, "노트북");

    mockDb.leaveWorkspace(WORKSPACE_ID, mockDb.getWorkspace(WORKSPACE_ID).name);

    const after = mockDb
      .listAgentDelegations()
      .find((item) => item.delegationId === delegation.delegationId);
    expect(after?.status).toBe("REVOKED");
    expect(after?.revokeReason).toBe("MEMBERSHIP_ENDED");
  });

  it("나가면 그 워크스페이스의 내 에이전트 대화가 지워진다", () => {
    addSecondAdmin();
    const { chatId } = mockDb.createAgentChat({ workspaceId: WORKSPACE_ID });

    mockDb.leaveWorkspace(WORKSPACE_ID, mockDb.getWorkspace(WORKSPACE_ID).name);

    expect(mockDb.findAgentChat(chatId)).toBeNull();
  });

  it("외부 에이전트 연결은 만료 시각이 지나면 조회할 때 만료됨이다", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
      const { delegation } = mockDb.createAgentDelegation(
        WORKSPACE_ID,
        "노트북"
      );
      const status = () =>
        mockDb
          .listAgentDelegations()
          .find((item) => item.delegationId === delegation.delegationId)
          ?.status;
      expect(status()).toBe("ACTIVE");

      vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));

      expect(status()).toBe("EXPIRED");
    } finally {
      vi.useRealTimers();
    }
  });

  it("나가면 워크스페이스가 목록과 조회에서도 사라진다", () => {
    addSecondAdmin();
    expect(
      mockDb.listWorkspaces().some((w) => w.workspaceId === WORKSPACE_ID)
    ).toBe(true);

    expect(() =>
      mockDb.leaveWorkspace(
        WORKSPACE_ID,
        mockDb.getWorkspace(WORKSPACE_ID).name
      )
    ).not.toThrow();

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
    expect(() => mockDb.leaveWorkspace("01K0000000030")).toThrow(
      "WORKSPACE_NOT_FOUND"
    );
  });
});

describe("참여자 전체 교체와 떠난 사람", () => {
  const WORKSPACE_ID = "01K0000000000";
  const NOTE_ID = "01K0000000020";

  it("내보낸 멤버도 요청에 실으면 참여자로 남는다", () => {
    const before = mockDb
      .getNote(NOTE_ID)
      .participants.filter((row) => row.userId);
    const departing = before.find(
      (row) => row.userId !== mockDb.getCurrentUser().userId
    )!;

    mockDb.removeMember(WORKSPACE_ID, departing.userId!);

    mockDb.replaceNoteParticipants(
      NOTE_ID,
      before.map((row) => row.userId!)
    );

    const after = mockDb.getNote(NOTE_ID).participants;
    const kept = after.find((row) => row.userId === departing.userId);
    expect(kept).toBeDefined();
    expect(kept!.participantId).toBe(departing.participantId);
  });
});

describe("meeting and analysis", () => {
  beforeEach(() => mockDb.reset());

  it("a legacy analysis request later completes", () => {
    const noteId = startedNoteId();

    mockDb.endMeeting(noteId);
    mockDb.requestAnalysis(noteId);
    expect(mockDb.getLatestAnalysis(noteId).status).toBe("PENDING");

    mockDb.advanceAnalysis(noteId);

    const done = mockDb.getLatestAnalysis(noteId);
    expect(done.status).toBe("SUCCEEDED");
    expect(done.sections.map((section) => section.kind)).toEqual([
      "OVERVIEW",
      "ACTION_ITEM",
      "DECISION",
    ]);
    const items = done.sections.flatMap((section) => section.items);
    expect(items.some((item) => item.evidence.length > 0)).toBe(true);
    expect(items.some((item) => item.evidence.length === 0)).toBe(true);
  });

  it("근거는 그 노트에 실제로 있는 세그먼트만 가리킨다", () => {
    const noteId = startedNoteId();
    const segmentIds = new Set(
      mockDb.listSegments(noteId).map((segment) => segment.segmentId)
    );
    mockDb.endMeeting(noteId);
    mockDb.requestAnalysis(noteId);
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

    expect(() => mockDb.endMeeting(note.noteId)).toThrow("CONFLICT");
  });

  it("refuses to start transcription on an ended meeting", () => {
    const noteId = startedNoteId();
    mockDb.endMeeting(noteId);

    expect(() => mockDb.createSession(noteId)).toThrow("MEETING_ALREADY_ENDED");
  });
});

describe("workspace integrations", () => {
  beforeEach(() => mockDb.reset());

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

  it("refuses ending a note nobody started", () => {
    const projectId = mockDb.listProjects(
      mockDb.listWorkspaces()[0].workspaceId
    )[0].projectId;
    const fresh = mockDb.createNote(projectId, { title: "아직 시작 전" });

    expect(fresh.meetingStartedBy).toBeNull();
    expect(() => mockDb.endMeeting(fresh.noteId)).toThrow("CONFLICT");
  });

  it("allows them once recording has started", () => {
    const projectId = mockDb.listProjects(
      mockDb.listWorkspaces()[0].workspaceId
    )[0].projectId;
    const note = mockDb.createNote(projectId, { title: "시작함" });
    const session = mockDb.createSession(note.noteId);
    mockDb.updateSessionStatus(session.sessionId, "COMPLETED");

    expect(() => mockDb.endMeeting(note.noteId)).not.toThrow();
  });
});

describe("노트 삭제", () => {
  beforeEach(() => mockDb.reset());

  it("기록 중인 회의도 지운다", () => {
    const live = mockDb
      .listNotes("01K0000000001")
      .find((row) => row.meetingStatus === "IN_PROGRESS");
    expect(live).toBeDefined();
    mockDb.deleteNote(live!.noteId);
    expect(() => mockDb.getNote(live!.noteId)).toThrow("NOTE_NOT_FOUND");
  });

  it("지우면 전사 세그먼트와 요약도 함께 사라진다", () => {
    const target = mockDb
      .listNotes("01K0000000001")
      .find((row) => row.meetingStatus !== "IN_PROGRESS");
    expect(target).toBeDefined();
    const noteId = target!.noteId;
    expect(mockDb.listSegments(noteId).length).toBeGreaterThanOrEqual(0);

    mockDb.deleteNote(noteId);

    expect(() => mockDb.getNote(noteId)).toThrow("NOTE_NOT_FOUND");
    expect(() => mockDb.listSegments(noteId)).toThrow("NOTE_NOT_FOUND");
    expect(() => mockDb.getLatestAnalysis(noteId)).toThrow();
  });

  it("워크스페이스를 나가면 그 노트의 세션 생성도 404다", () => {
    const project = mockDb.listProjects("01K0000000000")[0];
    const note = mockDb.createNote(project.projectId, {});

    mockDb.changeMemberRole("01K0000000000", "01K0000000020", "ADMIN");
    mockDb.leaveWorkspace(
      "01K0000000000",
      mockDb.getWorkspace("01K0000000000").name
    );

    expect(() => mockDb.createSession(note.noteId)).toThrow(
      "WORKSPACE_NOT_FOUND"
    );
  });

  it("워크스페이스를 나가면 그 노트 목록도 404다", () => {
    mockDb.changeMemberRole("01K0000000000", "01K0000000020", "ADMIN");
    mockDb.leaveWorkspace(
      "01K0000000000",
      mockDb.getWorkspace("01K0000000000").name
    );
    expect(() => mockDb.listWorkspaceNotes("01K0000000000")).toThrow(
      "WORKSPACE_NOT_FOUND"
    );
    expect(() => mockDb.listWorkspaceNotes("01K9999999999")).toThrow(
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

    mockDb.changeMemberRole("01K0000000000", "01K0000000020", "ADMIN");
    mockDb.leaveWorkspace(
      "01K0000000000",
      mockDb.getWorkspace("01K0000000000").name
    );

    expect(() => mockDb.getSession(session.sessionId)).toThrow(
      "WORKSPACE_NOT_FOUND"
    );
  });

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
    const created = mockDb.createAgentChat({ workspaceId: workspaceId() });
    const [top] = mockDb.listAgentChats({ workspaceId: workspaceId() });

    expect(top.chatId).toBe(created.chatId);
    expect(Date.parse(top.updatedAt)).toBeGreaterThan(Date.now() - 60_000);
  });

  it("마지막으로 쓴 대화가 첫 줄이 된다", () => {
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
    expect(titles[auto.chatId]).toBe("지난 회의에서 정한 것만 정리해줘");
    expect(titles[named.chatId]).toBe("내가 정한 제목");
  });

  it("★ 제목에서 마커를 사람 말로 되돌린다", () => {
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

  it("목록 줄이 제목의 출처(titleSource)를 싣는다 — 계약 필드다", () => {
    const chat = mockDb.createAgentChat({ workspaceId: workspaceId() });
    expect(
      mockDb
        .listAgentChats({ workspaceId: workspaceId() })
        .find((each) => each.chatId === chat.chatId)?.titleSource
    ).toBe("DEFAULT");
  });

  it("★ AI 제목은 첫 질문 제목(QUESTION)만 덮고, 사람이 지은 이름과 정렬 시각은 건드리지 않는다", () => {
    const chat = mockDb.createAgentChat({ workspaceId: workspaceId() });
    mockDb.appendAgentChatMessage(chat.chatId, {
      role: "USER",
      content: "@[주간 회의](noteId:01K0000000002) 배포 일정 정리해줘",
      scope: [],
      toolEvent: null,
    });
    const row = () =>
      mockDb
        .listAgentChats({ workspaceId: workspaceId() })
        .find((each) => each.chatId === chat.chatId)!;
    const before = row();
    expect(before.titleSource).toBe("QUESTION");

    expect(mockDb.retitleAgentChatByAi(chat.chatId)).toBe(true);
    expect(row()).toMatchObject({
      title: "주간 회의 배포 일정 정리",
      titleSource: "AI",
      updatedAt: before.updatedAt,
    });
    expect(mockDb.retitleAgentChatByAi(chat.chatId)).toBe(false);

    const named = mockDb.createAgentChat({
      workspaceId: workspaceId(),
      title: "내가 지은 이름",
    });
    expect(mockDb.retitleAgentChatByAi(named.chatId)).toBe(false);
  });

  it("최근 50개까지만 준다", () => {
    for (let i = 0; i < 55; i += 1) {
      mockDb.createAgentChat({ workspaceId: workspaceId() });
    }
    const chats = mockDb.listAgentChats({ workspaceId: workspaceId() });

    expect(chats).toHaveLength(50);
    expect(chats[0].updatedAt >= chats[49].updatedAt).toBe(true);
  });

  it("다른 워크스페이스의 대화는 안 섞이고, 없는 워크스페이스는 404다", () => {
    const [first, second] = mockDb.listWorkspaces();
    mockDb.createAgentChat({ workspaceId: first.workspaceId });

    expect(mockDb.listAgentChats({ workspaceId: second.workspaceId })).toEqual(
      []
    );
    expect(() =>
      mockDb.listAgentChats({ workspaceId: "01KNOTAMEMBER" })
    ).toThrow("WORKSPACE_NOT_FOUND");
  });
});

describe("계정 탈퇴 · 워크스페이스 삭제", () => {
  beforeEach(() => mockDb.reset());

  const TEAM = "01K0000000000";
  const SOLO = "01K0000000009";
  const SHARED_ADMIN = "01K0000000006";
  const MEMBER_ID = "01K0000000020";

  const actionOf = (workspaceId: string) =>
    mockDb.deletionPlan().workspaces.find((w) => w.workspaceId === workspaceId);

  it("혼자면 삭제, 유일 관리자 + 멤버면 넘기기(기본 가장 오래된 멤버), 다른 관리자가 있으면 나가기", () => {
    expect(actionOf(SOLO)?.action).toBe("DELETE");
    expect(actionOf(SHARED_ADMIN)?.action).toBe("LEAVE");
    expect(actionOf(TEAM)).toMatchObject({
      action: "TRANSFER_OR_DELETE",
      defaultSuccessorUserId: MEMBER_ID,
    });
    mockDb.changeMemberRole(TEAM, MEMBER_ID, "ADMIN");
    expect(actionOf(TEAM)?.action).toBe("LEAVE");
  });

  it("문구가 틀리거나 넘기기 선택이 빠지면 아무것도 바꾸지 않는다", () => {
    expect(() =>
      mockDb.deleteAccount({ confirmation: "회원탈퇴", workspaces: [] })
    ).toThrow("WITHDRAWAL_CONFIRMATION_MISMATCH");
    expect(() =>
      mockDb.deleteAccount({ confirmation: "회원 탈퇴", workspaces: [] })
    ).toThrow("DELETION_PLAN_CHANGED");
    expect(mockDb.listWorkspaces()).toHaveLength(3);
  });

  it("넘기면 승계자가 관리자가 되고 내 워크스페이스는 모두 사라진다", () => {
    mockDb.deleteAccount({
      confirmation: " 회원 탈퇴 ",
      workspaces: [
        { workspaceId: TEAM, decision: "TRANSFER", successorUserId: MEMBER_ID },
      ],
    });
    expect(mockDb.listWorkspaces()).toHaveLength(0);
  });

  it("워크스페이스 삭제와 나가기는 이름이 맞아야 한다", () => {
    expect(() => mockDb.deleteWorkspace(SOLO, "새")).toThrow(
      "WORKSPACE_NAME_MISMATCH"
    );
    expect(() => mockDb.leaveWorkspace(TEAM)).toThrow(
      "WORKSPACE_NAME_MISMATCH"
    );
    mockDb.deleteWorkspace(SOLO, "새 워크스페이스");
    expect(actionOf(SOLO)).toBeUndefined();
  });
});
