import type {
  CreateWorkspaceRequest,
  CreateNoteRequest,
  CurrentUserResponse,
  FolderNameRequest,
  FolderResponse,
  NoteCursorPageResponse,
  NoteResponse,
  NoteSummaryResponse,
  TranscriptSegmentCursorPageResponse,
  TranscriptSegmentResponse,
  TranscriptionSessionCursorPageResponse,
  TranscriptionSessionResponse,
  TranscriptionSessionStatus,
  UpdateNoteRequest,
  UpdateCurrentUserRequest,
  UpdateWorkspaceRequest,
  UserSummary,
  WorkspaceResponse,
} from "@/lib/api/generated/models";

const ACTIVE_STATUSES = new Set<TranscriptionSessionStatus>([
  "CONNECTING",
  "STREAMING",
  "PAUSED",
  "FINALIZING",
]);

const TERMINAL_STATUSES = new Set<TranscriptionSessionStatus>([
  "COMPLETED",
  "INTERRUPTED",
  "FAILED",
]);

type PageOptions = {
  cursor?: string | null;
  limit?: number;
};

type NotePageOptions = PageOptions & {
  folderId?: string | null;
};

type AddSegmentInput = Pick<
  TranscriptSegmentResponse,
  "text" | "startedAtMs" | "endedAtMs"
>;

type StoreState = {
  user: CurrentUserResponse;
  workspaces: WorkspaceResponse[];
  folders: Array<FolderResponse & { workspaceId: string }>;
  notes: NoteResponse[];
  sessions: TranscriptionSessionResponse[];
  segments: TranscriptSegmentResponse[];
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
  const user: CurrentUserResponse = {
    userId: "01K0000000003",
    name: "테스트 유저",
    email: "test@heymoa.com",
  };
  const workspaces: WorkspaceResponse[] = [
    {
      workspaceId: "01K0000000000",
      name: "테스트 유저의 워크스페이스",
      description: "회의 기록을 모으는 기본 공간입니다.",
      isDefault: true,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-01T00:00:00Z",
    },
    {
      workspaceId: "01K0000000006",
      name: "제품 팀",
      description: "제품 팀의 회의 기록입니다.",
      isDefault: false,
      createdAt: "2026-07-02T00:00:00Z",
      updatedAt: "2026-07-02T00:00:00Z",
    },
  ];
  const folders: StoreState["folders"] = [
    {
      folderId: "01K0000000001",
      workspaceId: workspaces[0].workspaceId,
      name: "주간",
    },
    {
      folderId: "01K0000000004",
      workspaceId: workspaces[0].workspaceId,
      name: "고객",
    },
  ];
  const notes: NoteResponse[] = [
    {
      noteId: "01K0000000002",
      workspaceId: workspaces[0].workspaceId,
      title: "주간 제품 회의",
      context: "이번 주 제품 진행 상황을 공유합니다.",
      createdBy: { userId: user.userId, name: user.name },
      folders: [folders[0]],
      createdAt: "2026-07-10T00:00:00Z",
      updatedAt: "2026-07-11T00:00:00Z",
    },
    {
      noteId: "01K0000000005",
      workspaceId: workspaces[0].workspaceId,
      title: "고객 인터뷰",
      context: null,
      createdBy: { userId: user.userId, name: user.name },
      folders: [folders[1]],
      createdAt: "2026-07-09T00:00:00Z",
      updatedAt: "2026-07-09T00:00:00Z",
    },
  ];
  const sessions: TranscriptionSessionResponse[] = [
    {
      sessionId: "01K0000000010",
      noteId: notes[0].noteId,
      status: "COMPLETED",
      recordedDurationMs: 120000,
      startedBy: { userId: user.userId, name: user.name },
      startedAt: "2026-07-11T00:00:00Z",
      endedAt: "2026-07-11T00:02:00Z",
    },
  ];
  const segments: TranscriptSegmentResponse[] = [
    {
      segmentId: "01K0000000011",
      sessionId: sessions[0].sessionId,
      sequence: 1,
      text: "이번 주 제품 진행 상황을 공유하겠습니다.",
      startedAtMs: 0,
      endedAtMs: 1800,
    },
    {
      segmentId: "01K0000000012",
      sessionId: sessions[0].sessionId,
      sequence: 2,
      text: "첫 번째 안건은 온보딩 개선입니다.",
      startedAtMs: 2200,
      endedAtMs: 4300,
    },
    {
      segmentId: "01K0000000013",
      sessionId: sessions[0].sessionId,
      sequence: 3,
      text: "다음 주까지 사용자 테스트를 진행합니다.",
      startedAtMs: 5000,
      endedAtMs: 7100,
    },
  ];
  return { user, workspaces, folders, notes, sessions, segments };
}

function assertWorkspace(workspaceId: string) {
  return (
    state.workspaces.find(
      (workspace) => workspace.workspaceId === workspaceId
    ) ?? fail("WORKSPACE_NOT_FOUND")
  );
}

function userSummary(): UserSummary {
  return { userId: state.user.userId, name: state.user.name };
}

function findNote(noteId: string) {
  const note = state.notes.find((candidate) => candidate.noteId === noteId);
  return note ?? fail("NOTE_NOT_FOUND");
}

function findFolder(folderId: string) {
  const folder = state.folders.find(
    (candidate) => candidate.folderId === folderId
  );
  return folder ?? fail("FOLDER_NOT_FOUND");
}

function findSession(sessionId: string) {
  const session = state.sessions.find(
    (candidate) => candidate.sessionId === sessionId
  );
  return session ?? fail("TRANSCRIPTION_SESSION_NOT_FOUND");
}

function paginate<T extends object>(
  items: T[],
  options: PageOptions,
  cursorFor: (item: T) => string
) {
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const start = options.cursor
    ? Math.max(
        0,
        items.findIndex((item) => cursorFor(item) === options.cursor) + 1
      )
    : 0;
  const pageItems = items.slice(start, start + limit);
  const hasMore = start + pageItems.length < items.length;
  return {
    items: pageItems,
    nextCursor:
      hasMore && pageItems.length > 0
        ? cursorFor(pageItems[pageItems.length - 1])
        : null,
  };
}

function noteSummary(note: NoteResponse): NoteSummaryResponse {
  const sessions = state.sessions.filter(
    (session) => session.noteId === note.noteId
  );
  const lastRecordedAt =
    sessions
      .map((session) => session.startedAt)
      .sort((a, b) => b.localeCompare(a))[0] ?? null;
  const recordedDurationMs = sessions.reduce((total, session) => {
    return total + session.recordedDurationMs;
  }, 0);
  return { ...note, lastRecordedAt, recordedDurationMs };
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

  getCurrentUser(): CurrentUserResponse {
    return copy(state.user);
  },

  updateCurrentUser(input: UpdateCurrentUserRequest): CurrentUserResponse {
    const name = input.name.trim();
    if (!name) fail("BAD_REQUEST");
    state.user.name = name;
    return copy(state.user);
  },

  listWorkspaces() {
    const items = [...state.workspaces].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name, "ko");
    });
    return { items: copy(items) };
  },

  createWorkspace(input: CreateWorkspaceRequest): WorkspaceResponse {
    const name = input.name.trim();
    if (!name) fail("BAD_REQUEST");
    const createdAt = nextTimestamp();
    const workspace: WorkspaceResponse = {
      workspaceId: nextId(),
      name,
      description: input.description,
      isDefault: false,
      createdAt,
      updatedAt: createdAt,
    };
    state.workspaces.push(workspace);
    return copy(workspace);
  },

  getWorkspace(workspaceId: string): WorkspaceResponse {
    return copy(assertWorkspace(workspaceId));
  },

  updateWorkspace(
    workspaceId: string,
    input: UpdateWorkspaceRequest
  ): WorkspaceResponse {
    const workspace = assertWorkspace(workspaceId);
    const name = input.name.trim();
    if (!name) fail("BAD_REQUEST");
    workspace.name = name;
    workspace.description = input.description;
    workspace.updatedAt = nextTimestamp();
    return copy(workspace);
  },

  setDefaultWorkspace(workspaceId: string): WorkspaceResponse {
    assertWorkspace(workspaceId);
    const updatedAt = nextTimestamp();
    state.workspaces.forEach((workspace) => {
      workspace.isDefault = workspace.workspaceId === workspaceId;
      if (workspace.isDefault) workspace.updatedAt = updatedAt;
    });
    return copy(assertWorkspace(workspaceId));
  },

  listNotes(
    workspaceId: string,
    options: NotePageOptions = {}
  ): NoteCursorPageResponse {
    assertWorkspace(workspaceId);
    const notes = state.notes
      .filter(
        (note) =>
          note.workspaceId === workspaceId &&
          (!options.folderId ||
            note.folders.some((folder) => folder.folderId === options.folderId))
      )
      .map(noteSummary)
      .sort((a, b) => {
        const aKey = a.lastRecordedAt ?? a.createdAt;
        const bKey = b.lastRecordedAt ?? b.createdAt;
        return bKey.localeCompare(aKey) || b.noteId.localeCompare(a.noteId);
      });
    return copy(
      paginate(notes, options, (note) =>
        encodeURIComponent(
          `${note.lastRecordedAt ?? note.createdAt}|${note.noteId}`
        )
      )
    );
  },

  createNote(workspaceId: string, input: CreateNoteRequest): NoteResponse {
    assertWorkspace(workspaceId);
    const createdAt = nextTimestamp();
    const note: NoteResponse = {
      noteId: nextId(),
      workspaceId,
      title: input.title?.trim() || "제목 없는 노트",
      context: input.context ?? null,
      createdBy: userSummary(),
      folders: [],
      createdAt,
      updatedAt: createdAt,
    };
    state.notes.push(note);
    return copy(note);
  },

  getNote(noteId: string): NoteResponse {
    return copy(findNote(noteId));
  },

  updateNote(noteId: string, input: UpdateNoteRequest): NoteResponse {
    const note = findNote(noteId);
    note.title = input.title.trim();
    note.context = input.context;
    note.updatedAt = nextTimestamp();
    return copy(note);
  },

  deleteNote(noteId: string) {
    findNote(noteId);
    const sessionIds = state.sessions
      .filter((session) => session.noteId === noteId)
      .map((session) => session.sessionId);
    state.notes = state.notes.filter((note) => note.noteId !== noteId);
    state.sessions = state.sessions.filter(
      (session) => session.noteId !== noteId
    );
    state.segments = state.segments.filter(
      (segment) => !sessionIds.includes(segment.sessionId)
    );
  },

  listFolders(workspaceId: string): FolderResponse[] {
    assertWorkspace(workspaceId);
    return copy(
      state.folders
        .filter((folder) => folder.workspaceId === workspaceId)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"))
        .map(({ folderId, name }) => ({ folderId, name }))
    );
  },

  createFolder(workspaceId: string, input: FolderNameRequest): FolderResponse {
    assertWorkspace(workspaceId);
    const name = input.name.trim();
    if (
      state.folders.some(
        (folder) => folder.workspaceId === workspaceId && folder.name === name
      )
    ) {
      fail("FOLDER_NAME_ALREADY_EXISTS");
    }
    const folder = { folderId: nextId(), workspaceId, name };
    state.folders.push(folder);
    return copy({ folderId: folder.folderId, name: folder.name });
  },

  updateFolder(folderId: string, input: FolderNameRequest): FolderResponse {
    const folder = findFolder(folderId);
    const name = input.name.trim();
    if (
      state.folders.some(
        (candidate) =>
          candidate.folderId !== folderId &&
          candidate.name === name &&
          candidate.workspaceId === folder.workspaceId
      )
    ) {
      fail("FOLDER_NAME_ALREADY_EXISTS");
    }
    folder.name = name;
    state.notes.forEach((note) => {
      note.folders.forEach((attached) => {
        if (attached.folderId === folderId) attached.name = name;
      });
    });
    return copy({ folderId: folder.folderId, name: folder.name });
  },

  deleteFolder(folderId: string) {
    findFolder(folderId);
    state.folders = state.folders.filter(
      (folder) => folder.folderId !== folderId
    );
    state.notes.forEach((note) => {
      note.folders = note.folders.filter(
        (folder) => folder.folderId !== folderId
      );
    });
  },

  attachFolder(noteId: string, folderId: string): NoteResponse {
    const note = findNote(noteId);
    const folder = findFolder(folderId);
    if (note.workspaceId !== folder.workspaceId) fail("FORBIDDEN");
    if (!note.folders.some((attached) => attached.folderId === folderId)) {
      note.folders.push({ folderId: folder.folderId, name: folder.name });
      note.updatedAt = nextTimestamp();
    }
    return copy(note);
  },

  detachFolder(noteId: string, folderId: string): NoteResponse {
    const note = findNote(noteId);
    const folder = findFolder(folderId);
    if (note.workspaceId !== folder.workspaceId) fail("FORBIDDEN");
    note.folders = note.folders.filter(
      (folder) => folder.folderId !== folderId
    );
    note.updatedAt = nextTimestamp();
    return copy(note);
  },

  createSession(noteId: string): TranscriptionSessionResponse {
    findNote(noteId);
    if (state.sessions.some((session) => ACTIVE_STATUSES.has(session.status))) {
      fail("ACTIVE_TRANSCRIPTION_SESSION_EXISTS");
    }
    const session: TranscriptionSessionResponse = {
      sessionId: nextId(),
      noteId,
      status: "CONNECTING",
      recordedDurationMs: 0,
      startedBy: userSummary(),
      startedAt: nextTimestamp(),
      endedAt: null,
    };
    state.sessions.push(session);
    return copy(session);
  },

  listSessions(
    noteId: string,
    options: PageOptions = {}
  ): TranscriptionSessionCursorPageResponse {
    findNote(noteId);
    const sessions = state.sessions
      .filter((session) => session.noteId === noteId)
      .sort(
        (a, b) =>
          b.startedAt.localeCompare(a.startedAt) ||
          b.sessionId.localeCompare(a.sessionId)
      );
    return copy(
      paginate(
        sessions,
        options,
        (session) => `${session.startedAt}|${session.sessionId}`
      )
    );
  },

  getSession(sessionId: string): TranscriptionSessionResponse {
    return copy(findSession(sessionId));
  },

  getActiveSession(): TranscriptionSessionResponse | null {
    const session = state.sessions.find((candidate) =>
      ACTIVE_STATUSES.has(candidate.status)
    );
    return session ? copy(session) : null;
  },

  updateSessionStatus(
    sessionId: string,
    status: TranscriptionSessionStatus,
    recordedDurationMs?: number
  ): TranscriptionSessionResponse {
    const session = findSession(sessionId);
    session.status = status;
    if (recordedDurationMs !== undefined) {
      session.recordedDurationMs = Math.max(0, recordedDurationMs);
    }
    if (TERMINAL_STATUSES.has(status)) session.endedAt = nextTimestamp();
    return copy(session);
  },

  listSegments(
    noteId: string,
    options: PageOptions = {}
  ): TranscriptSegmentCursorPageResponse {
    findNote(noteId);
    const noteSessions = state.sessions
      .filter((session) => session.noteId === noteId)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const sessionOrder = new Map(
      noteSessions.map((session, index) => [session.sessionId, index])
    );
    const segments = state.segments
      .filter((segment) => sessionOrder.has(segment.sessionId))
      .sort(
        (a, b) =>
          (sessionOrder.get(a.sessionId) ?? 0) -
            (sessionOrder.get(b.sessionId) ?? 0) || a.sequence - b.sequence
      );
    return copy(
      paginate(
        segments,
        options,
        (segment) => `${segment.sessionId}|${segment.sequence}`
      )
    );
  },

  addSegment(
    sessionId: string,
    input: AddSegmentInput
  ): TranscriptSegmentResponse {
    findSession(sessionId);
    const sequence =
      Math.max(
        0,
        ...state.segments
          .filter((segment) => segment.sessionId === sessionId)
          .map((segment) => segment.sequence)
      ) + 1;
    const segment: TranscriptSegmentResponse = {
      segmentId: nextId(),
      sessionId,
      sequence,
      ...input,
    };
    state.segments.push(segment);
    return copy(segment);
  },

  deleteSegment(segmentId: string) {
    if (!state.segments.some((segment) => segment.segmentId === segmentId)) {
      fail("TRANSCRIPT_SEGMENT_NOT_FOUND");
    }
    state.segments = state.segments.filter(
      (segment) => segment.segmentId !== segmentId
    );
  },
};
