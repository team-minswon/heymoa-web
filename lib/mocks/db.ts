import { faker } from "@faker-js/faker";
import type {
  CreateWorkspaceRequest,
  CurrentUserResponseData,
  NoteListResponseDataNotesItem,
  NoteRequest,
  NoteResponseData,
  ProjectRequest,
  ProjectResponseData,
  StartTranscriptionSessionResponseData,
  TranscriptResponseDataSegmentsItem,
  TranscriptionSessionResponseData,
  UpdateWorkspaceRequest,
  WorkspaceListResponseDataWorkspacesItem,
  WorkspaceResponseData,
} from "@/lib/api/generated/models";

const ACTIVE_STATUSES = new Set<string>(["READY", "ACTIVE"]);

const TERMINAL_STATUSES = new Set<string>(["COMPLETED", "INTERRUPTED"]);

type AddSegmentInput = Pick<
  TranscriptResponseDataSegmentsItem,
  "text" | "startedAtMs" | "endedAtMs"
>;

type MockSession = Omit<TranscriptionSessionResponseData, "status"> & {
  status: string;
};

type StoreState = {
  user: CurrentUserResponseData;
  workspaces: WorkspaceResponseData[];
  projects: ProjectResponseData[];
  notes: NoteResponseData[];
  sessions: MockSession[];
  segments: TranscriptResponseDataSegmentsItem[];
};

let state: StoreState;
let idCounter = 100;
let timestampCounter = 0;

function copy<T>(value: T): T {
  return structuredClone(value);
}

function fail(code: string): never {
  throw new Error(code);
}

function nextId() {
  const id = `01K${String(idCounter).padStart(10, "0")}`;
  idCounter += 1;
  return id;
}

function nextTimestamp() {
  const value = new Date(
    Date.parse("2026-07-11T09:00:00Z") + timestampCounter * 1000
  ).toISOString();
  timestampCounter += 1;
  return value;
}

function createSeedState(): StoreState {
  faker.seed(20260715);
  const user: CurrentUserResponseData = {
    userId: "user-12345",
    name: "테스트 유저",
    email: "test@heymoa.com",
    image: "https://images.heymoa.test/users/test-user.png",
  };
  const workspaces: WorkspaceResponseData[] = [
    {
      workspaceId: "01K0000000000",
      name: "테스트 유저의 워크스페이스",
      description: "회의 기록을 모으는 기본 공간입니다.",
      isDefault: true,
      role: "ADMIN",
    },
    {
      workspaceId: "01K0000000006",
      name: "제품 팀",
      description: "제품 팀의 회의 기록입니다.",
      isDefault: false,
      role: "ADMIN",
    },
  ];
  const projects: ProjectResponseData[] = [
    {
      projectId: "01K0000000001",
      workspaceId: workspaces[0].workspaceId,
      name: "주간",
      description: "주간 회의 프로젝트",
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-01T00:00:00Z",
    },
    {
      projectId: "01K0000000004",
      workspaceId: workspaces[0].workspaceId,
      name: "고객",
      description: "고객 인터뷰 프로젝트",
      createdAt: "2026-07-02T00:00:00Z",
      updatedAt: "2026-07-02T00:00:00Z",
    },
    {
      projectId: "01K0000000007",
      workspaceId: workspaces[1].workspaceId,
      name: "로드맵",
      description: faker.helpers.arrayElement([
        "제품 로드맵과 우선순위를 정리합니다.",
        "분기별 제품 계획을 논의합니다.",
      ]),
      createdAt: "2026-07-03T00:00:00Z",
      updatedAt: "2026-07-03T00:00:00Z",
    },
    {
      projectId: "01K0000000008",
      workspaceId: workspaces[1].workspaceId,
      name: "리서치",
      description: faker.helpers.arrayElement([
        "사용자 조사 기록을 모읍니다.",
        "시장과 고객 인사이트를 공유합니다.",
      ]),
      createdAt: "2026-07-04T00:00:00Z",
      updatedAt: "2026-07-04T00:00:00Z",
    },
  ];
  const notes: NoteResponseData[] = [
    {
      noteId: "01K0000000002",
      projectId: projects[0].projectId,
      title: "주간 제품 회의",
      createdAt: "2026-07-10T00:00:00Z",
      updatedAt: "2026-07-11T00:00:00Z",
    },
    {
      noteId: "01K0000000005",
      projectId: projects[1].projectId,
      title: "고객 인터뷰",
      createdAt: "2026-07-09T00:00:00Z",
      updatedAt: "2026-07-09T00:00:00Z",
    },
    {
      noteId: "01K0000000009",
      projectId: projects[2].projectId,
      title: faker.helpers.arrayElement([
        "3분기 로드맵 정렬",
        "제품 우선순위 검토",
      ]),
      createdAt: "2026-07-08T00:00:00Z",
      updatedAt: "2026-07-08T00:00:00Z",
    },
    {
      noteId: "01K0000000014",
      projectId: projects[3].projectId,
      title: faker.helpers.arrayElement([
        "신규 사용자 인터뷰",
        "탐색 리서치 메모",
      ]),
      createdAt: "2026-07-07T00:00:00Z",
      updatedAt: "2026-07-07T00:00:00Z",
    },
  ];
  const sessions: MockSession[] = [
    {
      sessionId: "01K0000000010",
      noteId: notes[0].noteId,
      status: "COMPLETED",
      readyExpiresAt: "2026-07-11T00:10:00Z",
      startedAt: "2026-07-11T00:00:00Z",
      endedAt: "2026-07-11T00:02:00Z",
      endReason: "CLIENT_DISCONNECTED",
    },
  ];
  const segments: TranscriptResponseDataSegmentsItem[] = [
    {
      segmentId: "01K0000000011",
      transcriptionSessionId: sessions[0].sessionId,
      sequence: 1,
      text: "이번 주 제품 진행 상황을 공유하겠습니다.",
      startedAtMs: 0,
      endedAtMs: 1800,
    },
    {
      segmentId: "01K0000000012",
      transcriptionSessionId: sessions[0].sessionId,
      sequence: 2,
      text: "첫 번째 안건은 온보딩 개선입니다.",
      startedAtMs: 2200,
      endedAtMs: 4300,
    },
    {
      segmentId: "01K0000000013",
      transcriptionSessionId: sessions[0].sessionId,
      sequence: 3,
      text: "다음 주까지 사용자 테스트를 진행합니다.",
      startedAtMs: 5000,
      endedAtMs: 7100,
    },
  ];
  return { user, workspaces, projects, notes, sessions, segments };
}

function assertWorkspace(workspaceId: string) {
  return (
    state.workspaces.find(
      (workspace) => workspace.workspaceId === workspaceId
    ) ?? fail("WORKSPACE_NOT_FOUND")
  );
}

function assertProject(projectId: string) {
  return (
    state.projects.find((project) => project.projectId === projectId) ??
    fail("PROJECT_NOT_FOUND")
  );
}

function findNote(noteId: string) {
  const note = state.notes.find((candidate) => candidate.noteId === noteId);
  return note ?? fail("NOTE_NOT_FOUND");
}

function findSession(sessionId: string): MockSession {
  const session = state.sessions.find(
    (candidate) => candidate.sessionId === sessionId
  );
  return session ?? fail("TRANSCRIPTION_SESSION_NOT_FOUND");
}

function getRecordedDurationMs(noteId: string) {
  return state.sessions
    .filter((session) => session.noteId === noteId)
    .reduce((total, session) => {
      const startedAt = session.startedAt
        ? Date.parse(session.startedAt)
        : Number.NaN;
      const endedAt = session.endedAt
        ? Date.parse(session.endedAt)
        : Number.NaN;
      const duration =
        Number.isFinite(startedAt) && Number.isFinite(endedAt)
          ? Math.max(0, endedAt - startedAt)
          : 0;
      return total + duration;
    }, 0);
}

function reset() {
  idCounter = 100;
  timestampCounter = 0;
  state = createSeedState();
}

reset();

export const mockDb = {
  get workspace() {
    return copy(
      state.workspaces.find((workspace) => workspace.isDefault) ??
        state.workspaces[0]
    );
  },

  reset,

  getCurrentUser(): CurrentUserResponseData {
    return copy(state.user);
  },

  listWorkspaces(): WorkspaceListResponseDataWorkspacesItem[] {
    const items = [...state.workspaces].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name, "ko");
    });
    return copy(items);
  },

  createWorkspace(input: CreateWorkspaceRequest): WorkspaceResponseData {
    const name = input.name.trim();
    if (!name) fail("BAD_REQUEST");
    const workspace: WorkspaceResponseData = {
      workspaceId: nextId(),
      name,
      description: input.description ?? null,
      isDefault: false,
      role: "ADMIN",
    };
    state.workspaces.push(workspace);
    return copy(workspace);
  },

  getWorkspace(workspaceId: string): WorkspaceResponseData {
    return copy(assertWorkspace(workspaceId));
  },

  updateWorkspace(
    workspaceId: string,
    input: UpdateWorkspaceRequest
  ): WorkspaceResponseData {
    const workspace = assertWorkspace(workspaceId);
    const name = input.name.trim();
    if (!name) fail("BAD_REQUEST");
    workspace.name = name;
    workspace.description = input.description ?? null;
    return copy(workspace);
  },

  setDefaultWorkspace(workspaceId: string): { workspaceId: string } {
    assertWorkspace(workspaceId);
    state.workspaces.forEach((workspace) => {
      workspace.isDefault = workspace.workspaceId === workspaceId;
    });
    return { workspaceId };
  },

  listProjects(workspaceId: string): ProjectResponseData[] {
    assertWorkspace(workspaceId);
    return copy(
      state.projects
        .filter((project) => project.workspaceId === workspaceId)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"))
    );
  },

  createProject(
    workspaceId: string,
    input: ProjectRequest
  ): ProjectResponseData {
    assertWorkspace(workspaceId);
    const name = input.name.trim();
    if (!name) fail("BAD_REQUEST");
    const createdAt = nextTimestamp();
    const project: ProjectResponseData = {
      projectId: nextId(),
      workspaceId,
      name,
      description: input.description ?? null,
      createdAt,
      updatedAt: createdAt,
    };
    state.projects.push(project);
    return copy(project);
  },

  getProject(workspaceId: string, projectId: string): ProjectResponseData {
    assertWorkspace(workspaceId);
    const project = assertProject(projectId);
    if (project.workspaceId !== workspaceId) fail("FORBIDDEN");
    return copy(project);
  },

  updateProject(
    workspaceId: string,
    projectId: string,
    input: ProjectRequest
  ): ProjectResponseData {
    assertWorkspace(workspaceId);
    const project = assertProject(projectId);
    if (project.workspaceId !== workspaceId) fail("FORBIDDEN");
    const name = input.name.trim();
    if (!name) fail("BAD_REQUEST");
    project.name = name;
    project.description = input.description ?? null;
    project.updatedAt = nextTimestamp();
    return copy(project);
  },

  deleteProject(workspaceId: string, projectId: string) {
    assertWorkspace(workspaceId);
    const project = assertProject(projectId);
    if (project.workspaceId !== workspaceId) fail("FORBIDDEN");
    if (state.notes.some((note) => note.projectId === projectId)) {
      fail("PROJECT_HAS_NOTES");
    }
    state.projects = state.projects.filter((p) => p.projectId !== projectId);
  },

  listNotes(projectId: string): NoteListResponseDataNotesItem[] {
    assertProject(projectId);
    const notes = state.notes
      .filter((note) => note.projectId === projectId)
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) ||
          b.noteId.localeCompare(a.noteId)
      )
      .map((note) => {
        const startedAt = state.sessions
          .filter((session) => session.noteId === note.noteId)
          .map((session) => session.startedAt)
          .filter((value): value is string => value !== null)
          .sort((a, b) => b.localeCompare(a))[0];
        return {
          ...note,
          lastRecordedAt: startedAt ?? null,
          recordedDurationMs: getRecordedDurationMs(note.noteId),
        };
      });
    return copy(notes);
  },

  createNote(projectId: string, input: NoteRequest): NoteResponseData {
    assertProject(projectId);
    const createdAt = nextTimestamp();
    const note: NoteResponseData = {
      noteId: nextId(),
      projectId,
      title: input.title?.trim() || "제목 없는 노트",
      createdAt,
      updatedAt: createdAt,
    };
    state.notes.push(note);
    return copy(note);
  },

  getNote(noteId: string): NoteResponseData {
    return copy(findNote(noteId));
  },

  updateNote(noteId: string, input: NoteRequest): NoteResponseData {
    const note = findNote(noteId);
    const title = input.title.trim();
    if (!title) fail("BAD_REQUEST");
    note.title = title;
    note.updatedAt = nextTimestamp();
    return copy(note);
  },

  createSession(noteId: string): StartTranscriptionSessionResponseData {
    findNote(noteId);
    if (state.sessions.some((session) => ACTIVE_STATUSES.has(session.status))) {
      fail("ACTIVE_TRANSCRIPTION_SESSION");
    }
    const session: MockSession = {
      sessionId: nextId(),
      noteId,
      status: "READY",
      readyExpiresAt: nextTimestamp(),
      startedAt: null,
      endedAt: null,
      endReason: null,
    };
    state.sessions.push(session);
    return copy(session) as unknown as StartTranscriptionSessionResponseData;
  },

  getSession(sessionId: string): TranscriptionSessionResponseData {
    return copy(
      findSession(sessionId)
    ) as unknown as TranscriptionSessionResponseData;
  },

  getActiveSession(): TranscriptionSessionResponseData | null {
    const session = state.sessions.find((candidate) =>
      ACTIVE_STATUSES.has(candidate.status)
    );
    return session
      ? (copy(session) as unknown as TranscriptionSessionResponseData)
      : null;
  },

  updateSessionStatus(
    sessionId: string,
    status: string
  ): TranscriptionSessionResponseData {
    const session = findSession(sessionId);
    session.status = status;
    if (status === "ACTIVE" && !session.startedAt) {
      session.startedAt = nextTimestamp();
    }
    if (TERMINAL_STATUSES.has(status)) session.endedAt = nextTimestamp();
    return copy(session) as unknown as TranscriptionSessionResponseData;
  },

  listSegments(noteId: string): TranscriptResponseDataSegmentsItem[] {
    findNote(noteId);
    const noteSessions = state.sessions
      .filter((session) => session.noteId === noteId)
      .sort((a, b) => {
        const aStart = a.startedAt ?? "";
        const bStart = b.startedAt ?? "";
        return aStart.localeCompare(bStart);
      });
    const sessionOrder = new Map(
      noteSessions.map((session, index) => [session.sessionId, index])
    );
    const segments = state.segments
      .filter((segment) => sessionOrder.has(segment.transcriptionSessionId))
      .sort(
        (a, b) =>
          (sessionOrder.get(a.transcriptionSessionId) ?? 0) -
            (sessionOrder.get(b.transcriptionSessionId) ?? 0) ||
          a.sequence - b.sequence
      );
    return copy(segments);
  },

  addSegment(
    sessionId: string,
    input: AddSegmentInput
  ): TranscriptResponseDataSegmentsItem {
    findSession(sessionId);
    const sequence =
      Math.max(
        0,
        ...state.segments
          .filter((segment) => segment.transcriptionSessionId === sessionId)
          .map((segment) => segment.sequence)
      ) + 1;
    const segment: TranscriptResponseDataSegmentsItem = {
      segmentId: nextId(),
      transcriptionSessionId: sessionId,
      sequence,
      ...input,
    };
    state.segments.push(segment);
    return copy(segment);
  },
};
