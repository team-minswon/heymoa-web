import { beforeEach, describe, expect, it } from "vitest";
import { mockDb } from "@/lib/mocks/db";

function firstNoteId() {
  const workspaceId = mockDb.listWorkspaces()[0].workspaceId;
  const projectId = mockDb.listProjects(workspaceId)[0].projectId;
  return mockDb.listNotes(projectId)[0].noteId;
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
    expect(mockDb.getCurrentUser()).toEqual({
      userId: "user-12345",
      name: "테스트 유저",
      email: "test@heymoa.com",
      image: null,
    });
    const workspaces = mockDb.listWorkspaces();
    expect(workspaces).toHaveLength(2);
    expect(mockDb.listProjects(workspaces[0].workspaceId)).toHaveLength(2);
    expect(mockDb.listProjects(workspaces[1].workspaceId)).toHaveLength(2);
    expect(
      workspaces.flatMap((workspace) =>
        mockDb
          .listProjects(workspace.workspaceId)
          .flatMap((project) => mockDb.listNotes(project.projectId))
      )
    ).toHaveLength(4);
  });

  it("keeps exactly one explicit default workspace", () => {
    const created = mockDb.createWorkspace({
      name: "제품",
      description: null,
    });
    expect(mockDb.listWorkspaces()[0].isDefault).toBe(true);
    expect(created.isDefault).toBe(false);

    mockDb.setDefaultWorkspace(created.workspaceId);
    const defaults = mockDb.listWorkspaces().filter((item) => item.isDefault);
    expect(defaults).toEqual([
      expect.objectContaining({ workspaceId: created.workspaceId }),
    ]);
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
      .notifications.find((item) => item.notificationId === pending!.notificationId);
    // 취소된 초대의 알림도 목록에 남고, 상태만 현재 값을 따라간다 (계약 규칙).
    expect(after?.invitation?.status).toBe("CANCELED");
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
    expect(done.overview).toBeTruthy();
    expect(done.actionItems).toBeTruthy();
    expect(done.insights).toBeTruthy();
  });

  it("refuses to pause a meeting that already ended", () => {
    const noteId = startedNoteId();
    mockDb.endMeeting(noteId);

    expect(() => mockDb.pauseMeeting(noteId)).toThrow("MEETING_NOT_IN_PROGRESS");
  });

  it("moves a meeting through pause and resume", () => {
    const noteId = startedNoteId();

    expect(mockDb.pauseMeeting(noteId).meetingStatus).toBe("PAUSED");
    expect(mockDb.resumeMeeting(noteId).meetingStatus).toBe("IN_PROGRESS");
    expect(() => mockDb.resumeMeeting(noteId)).toThrow("MEETING_NOT_PAUSED");
  });
});

describe("workspace integrations", () => {
  beforeEach(() => mockDb.reset());

  // 계약은 미연동 provider도 목록에 담는다 (connected: false). 화면이 "연결하기"
  // 버튼을 그리려면 아직 안 붙은 도구도 알아야 하기 때문이다.
  it("lists every supported provider, connected or not", () => {
    const workspaceId = mockDb.listWorkspaces()[0].workspaceId;

    expect(mockDb.listIntegrations(workspaceId).map((i) => i.provider)).toEqual([
      "LINEAR",
      "GITHUB",
    ]);
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
    const created = mockDb.createWorkspace({ name: "새 팀", description: null });

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
      .notifications.find((item) => item.invitation?.status === "PENDING")!
      .invitation!;

    mockDb.acceptInvitation(invitation.invitationId);

    expect(mockDb.listWorkspaces()).toHaveLength(before + 1);
    expect(mockDb.listMembers(invitation.workspaceId)).toHaveLength(1);
    expect(
      mockDb.listIntegrations(invitation.workspaceId).map((i) => i.provider)
    ).toEqual(["LINEAR", "GITHUB"]);
    // 기본 워크스페이스는 바뀌지 않는다 (계약).
    expect(mockDb.listWorkspaces().filter((w) => w.isDefault)).toHaveLength(1);
  });
});

describe("only the meeting starter can operate a meeting", () => {
  beforeEach(() => mockDb.reset());

  // 계약 403 NOT_MEETING_STARTER. 새로 만든 노트는 아직 아무도 녹음을 시작하지 않았으므로
  // 조작할 회의가 없다.
  it("refuses meeting commands on a note nobody started", () => {
    const projectId = mockDb.listProjects(
      mockDb.listWorkspaces()[0].workspaceId
    )[0].projectId;
    const fresh = mockDb.createNote(projectId, { title: "아직 시작 전" });

    expect(fresh.meetingStartedBy).toBeNull();
    expect(() => mockDb.pauseMeeting(fresh.noteId)).toThrow("NOT_MEETING_STARTER");
    expect(() => mockDb.endMeeting(fresh.noteId)).toThrow("NOT_MEETING_STARTER");
  });

  it("allows them once recording has started", () => {
    const projectId = mockDb.listProjects(
      mockDb.listWorkspaces()[0].workspaceId
    )[0].projectId;
    const note = mockDb.createNote(projectId, { title: "시작함" });
    const session = mockDb.createSession(note.noteId);
    mockDb.updateSessionStatus(session.sessionId, "COMPLETED");

    expect(mockDb.pauseMeeting(note.noteId).meetingStatus).toBe("PAUSED");
  });
});
