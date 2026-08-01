import { faker } from "@faker-js/faker";
import type {
  ActionItem,
  ActionItemUpdateRequest,
  GetActionItemsParams,
  GetWorkspaceNotesParams,
  NotePageResponseData,
  NoteUpdateRequest,
  NoteCreateRequest,
  GetNotesParams,
  ActionItemPageResponseData,
  CreateWorkspaceRequest,
  CurrentTranscriptionSessionNullableResponseData,
  CurrentUserResponseData,
  NoteSummary,
  NoteResponseData,
  ProjectRequest,
  ProjectResponseData,
  StartTranscriptionSessionResponseData,
  TranscriptResponseDataSegmentsItem,
  TranscriptionSessionResponseData,
  UpdateWorkspaceRequest,
  WorkspaceListResponseDataWorkspacesItem,
  WorkspaceMemberListResponseDataMembersItem,
  WorkspaceInvitationListResponseDataInvitationsItem,
  WorkspaceInvitationActionResponseData,
  WorkspaceMemberListResponseData,
  WorkspaceInvitationListResponseData,
  NotificationListResponseData,
  NotificationListResponseDataNotificationsItem,
  NotificationListResponseDataNotificationsItemInvitationStatus,
  MarkNotificationReadResponseData,
  AnalysisResultResponseData,
  ToolConnectionsResponseDataIntegrationsItem,
  AgentChatV2ResponseData,
  AgentChatMessagesResponseDataMessagesItem,
  NoteSharedChatResponseData,
  NoteSharedChatResponseDataMessagesItem,
  NoteSharedChatResponseDataLockPendingApproval,
  WorkspaceResponseData,
} from "@/lib/api/generated/models";
import { getAppDateKey } from "@/lib/format/date";
import { MOCK_USER } from "@/lib/mocks/mock-user";

// MVP2 계약이 더한 필수 필드. 목록·상세가 같은 NoteSummary 를 쓰므로 모든 노트가 들고 있어야 한다.
const NOTE_MVP2 = {
  scheduledAt: null,
  participants: [],
  analysisStatus: "NONE",
  previousNote: null,
  lastRecordedAt: null,
  context: null,
} satisfies Pick<
  NoteResponseData,
  | "scheduledAt"
  | "participants"
  | "analysisStatus"
  | "previousNote"
  | "lastRecordedAt"
  | "context"
>;

const ACTIVE_STATUSES = new Set<string>(["READY", "ACTIVE"]);

const TERMINAL_STATUSES = new Set<string>(["COMPLETED", "INTERRUPTED"]);

type AddSegmentInput = Pick<
  TranscriptResponseDataSegmentsItem,
  "text" | "startedAtMs" | "endedAtMs"
>;

type MockSession = Omit<TranscriptionSessionResponseData, "status"> & {
  status: string;
};

/** 멤버는 워크스페이스 소속이므로 응답 항목에 없는 workspaceId를 안쪽에서만 들고 있는다. */
type MockMember = WorkspaceMemberListResponseDataMembersItem & {
  workspaceId: string;
};

/**
 * 초대는 목록 응답 항목보다 넓다 — 목록은 PENDING만 보여주지만 목은 수락·거절·취소된 것도
 * 갖고 있어야 알림의 상태를 따라가게 할 수 있다 (계약: 취소된 초대의 알림도 목록에 남는다).
 */
type MockInvitation = WorkspaceInvitationListResponseDataInvitationsItem & {
  workspaceId: string;
  status: NotificationListResponseDataNotificationsItemInvitationStatus;
};

/** 계약은 미연동 provider도 목록에 담으므로(connected: false) 목도 두 provider를 항상 들고 있는다. */
/** 유저가 아직 멤버가 아닌, 초대만 와 있는 워크스페이스. 수락하면 여기 합류한다. */
const INVITED_WORKSPACE = {
  workspaceId: "01K0000000030",
  name: "디자인 팀",
} as const;

const SUPPORTED_PROVIDERS = ["LINEAR", "GITHUB"] as const;

type MockIntegration = ToolConnectionsResponseDataIntegrationsItem & {
  workspaceId: string;
};

/** 개인 챗봇 세션. 활성 세션은 스코프 대상별로 하나다 (워크스페이스 1개 + 노트당 1개). */
type MockAgentChat = AgentChatV2ResponseData & { active: boolean };

type MockAgentChatMessage = AgentChatMessagesResponseDataMessagesItem & {
  chatId: string;
};

/** 공유 챗은 노트에 하나씩 붙는다 — 새 대화도 삭제도 없다 (회의 기록의 일부). */
type MockSharedChatMessage = NoteSharedChatResponseDataMessagesItem & {
  noteId: string;
};

type StoreState = {
  user: CurrentUserResponseData;
  workspaces: WorkspaceResponseData[];
  projects: ProjectResponseData[];
  notes: NoteResponseData[];
  sessions: MockSession[];
  segments: TranscriptResponseDataSegmentsItem[];
  members: MockMember[];
  invitations: MockInvitation[];
  notifications: NotificationListResponseDataNotificationsItem[];
  analyses: AnalysisResultResponseData[];
  actionItems: ActionItem[];
  integrations: MockIntegration[];
  sharedChatLocks: Set<string>;
  /** 현재 유저가 아닌 멤버가 쥔 잠금 (noteId → 이름). 관전자 화면 재현용. */
  sharedChatForeignLocks: Map<string, string>;
  sharedChatPendingApprovals: Map<
    string,
    NoteSharedChatResponseDataLockPendingApproval
  >;
  agentChats: MockAgentChat[];
  agentChatMessages: MockAgentChatMessage[];
  sharedChatMessages: MockSharedChatMessage[];
};

let state: StoreState;
let idCounter = 100;
let timestampCounter = 0;

/** 응답에 없는 내부 전용 필드를 떼어낸다 (멤버·초대의 workspaceId 등). */
function omit<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[]
): Omit<T, K> {
  const next = { ...value };
  for (const key of keys) delete next[key];
  return next;
}

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

function nextSessionTimestamp() {
  const latest = state.sessions.reduce((latestMs, session) => {
    const candidates = [session.startedAt, session.endedAt]
      .map((value) => (value ? Date.parse(value) : Number.NaN))
      .filter(Number.isFinite);
    return Math.max(latestMs, ...candidates);
  }, Number.NEGATIVE_INFINITY);
  return new Date(Math.max(Date.now(), latest + 1_000)).toISOString();
}

/**
 * 오늘로부터 `daysAgo`일 전의 시각. 앱 타임존(KST) 날짜가 정확히 그 날이 되도록
 * UTC 01시대에 놓는다 — 자정 근처에 두면 KST 기준 날짜가 하루 밀려 묶음이 어긋난다.
 * `order`는 같은 날 안의 정렬만 벌리는 분 단위 오프셋이다.
 */
function lastRecordedAtOf(noteId: string): string | null {
  return (
    state.sessions
      .filter((session) => session.noteId === noteId && session.endedAt !== null)
      .map((session) => session.startedAt)
      .filter((value): value is string => value !== null)
      .sort((a, b) => b.localeCompare(a))[0] ?? null
  );
}

function daysAgoIso(daysAgo: number, order = 0): string {
  const todayUtcMidnight = Date.parse(`${getAppDateKey(new Date())}T00:00:00Z`);
  const at =
    todayUtcMidnight - daysAgo * 86_400_000 + 3_600_000 - order * 60_000;
  return new Date(at).toISOString();
}

function createSeedState(): StoreState {
  faker.seed(20260715);
  const user: CurrentUserResponseData = { ...MOCK_USER };
  const workspaces: WorkspaceResponseData[] = [
    {
      workspaceId: "01K0000000000",
      name: "테스트 유저의 워크스페이스",
      description: "회의 기록을 모으는 기본 공간입니다.",
      isDefault: true,
      role: "ADMIN",
    },
    // description은 계약상 nullable이다 — 설명 없는 워크스페이스를 화면이 어떻게 그리는지
    // 목이 한 번도 안 보여주면 그 레이아웃은 검증되지 않는다.
    {
      workspaceId: "01K0000000006",
      name: "제품 팀",
      description: null,
      isDefault: false,
      role: "ADMIN",
    },
  ];
  const projects: ProjectResponseData[] = [
    {
      isDefault: true,
      projectId: "01K0000000001",
      workspaceId: workspaces[0].workspaceId,
      name: "주간",
      description: "주간 회의 프로젝트",
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-01T00:00:00Z",
    },
    {
      isDefault: false,
      projectId: "01K0000000004",
      workspaceId: workspaces[0].workspaceId,
      name: "고객",
      description: "고객 인터뷰 프로젝트",
      createdAt: "2026-07-02T00:00:00Z",
      updatedAt: "2026-07-02T00:00:00Z",
    },
    {
      isDefault: true,
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
    // 설명 없는 프로젝트. 목록 행과 상세 헤더가 null을 어떻게 다루는지의 유일한 표본이다.
    {
      isDefault: false,
      projectId: "01K0000000008",
      workspaceId: workspaces[1].workspaceId,
      name: "리서치",
      description: null,
      createdAt: "2026-07-04T00:00:00Z",
      updatedAt: "2026-07-04T00:00:00Z",
    },
  ];
  const notes: NoteResponseData[] = [
    {
      ...NOTE_MVP2,
      noteId: "01K0000000002",
      projectId: projects[0].projectId,
      title: "주간 제품 회의",
      createdAt: "2026-07-10T00:00:00Z",
      updatedAt: "2026-07-11T00:00:00Z",
      meetingStatus: "IN_PROGRESS",
      meetingStartedAt: "2026-07-11T00:00:00Z",
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: { userId: MOCK_USER.userId, name: MOCK_USER.name },
    },
    {
      ...NOTE_MVP2,
      noteId: "01K0000000005",
      projectId: projects[1].projectId,
      title: "고객 인터뷰",
      // nullable 양쪽 표본. 여기만 값이 있으면 화면의 「일시 미정」 분기가 검증되지 않는다.
      scheduledAt: "2026-08-05T05:00:00Z",
      participants: [
        { userId: MOCK_USER.userId, name: MOCK_USER.name, email: MOCK_USER.email },
        { userId: "01K0000000099", name: "김서연", email: null },
      ],
      context: "지난 인터뷰에서 안 닫힌 질문 셋을 마저 확인한다.",
      createdAt: "2026-07-09T00:00:00Z",
      updatedAt: "2026-07-09T00:00:00Z",
      meetingStatus: "NOT_STARTED",
      meetingStartedAt: null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: null,
    },
    {
      ...NOTE_MVP2,
      noteId: "01K0000000028",
      projectId: projects[0].projectId,
      title: "파트너 검토 회의",
      createdAt: "2026-07-12T00:00:00Z",
      updatedAt: "2026-07-12T00:05:00Z",
      meetingStatus: "IN_PROGRESS",
      meetingStartedAt: "2026-07-12T00:00:00Z",
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: { userId: "01K0000000099", name: "김서연" },
    },
    {
      ...NOTE_MVP2,
      noteId: "01K0000000009",
      projectId: projects[2].projectId,
      // 이어짐 표본. previousNote가 늘 null이면 배지 분기를 목으로 못 본다.
      previousNote: { noteId: "01K0000000002", title: "주간 제품 회의" },
      analysisStatus: "SUCCEEDED",
      title: faker.helpers.arrayElement([
        "3분기 로드맵 정렬",
        "제품 우선순위 검토",
      ]),
      createdAt: "2026-07-08T00:00:00Z",
      updatedAt: "2026-07-08T00:00:00Z",
      meetingStatus: "NOT_STARTED",
      meetingStartedAt: null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: null,
    },
    {
      ...NOTE_MVP2,
      noteId: "01K0000000014",
      projectId: projects[3].projectId,
      title: faker.helpers.arrayElement([
        "신규 사용자 인터뷰",
        "탐색 리서치 메모",
      ]),
      createdAt: "2026-07-07T00:00:00Z",
      updatedAt: "2026-07-07T00:00:00Z",
      meetingStatus: "NOT_STARTED",
      meetingStartedAt: null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: null,
    },
    // 날짜 묶음(오늘·어제·이번 주·지난주·이번 달·연월)과 밀도 합격선(주 콘텐츠 8개 이상)을
    // 실제 화면에서 볼 수 있어야 해서 시간대를 흩어 둔다. 노트가 둘뿐이면 목록이 한 묶음으로
    // 뭉쳐 "날짜 구분이 없다"처럼 보인다.
    //
    // **날짜만 실행일 기준 상대값이다.** 고정 문자열로 두면 하루만 지나도 `오늘` 묶음이
    // 사라지고 결국 전부 한 달로 뭉쳐, 묶음을 보여주려던 시드가 제 일을 못 한다.
    // 무작위가 아니라 오늘에 맞춘 값이라 실행 안에서는 결정적이다.
    ...[
      ["01K0000000020", "온보딩 이탈 구간 리뷰", 0, 0],
      ["01K0000000021", "알림 정책 논의", 0, 1],
      ["01K0000000022", "고객 피드백 정리", 1, 0],
      ["01K0000000023", "스프린트 회고", 3, 1],
      ["01K0000000024", "로드맵 브레인스토밍", 4, 0],
      ["01K0000000025", "디자인 시스템 점검", 9, 1],
      ["01K0000000026", "분기 계획 세션", 20, 0],
      ["01K0000000027", "파트너십 킥오프", 45, 1],
    ].map(([noteId, title, daysAgo, projectIndex], index) => ({
      noteId: noteId as string,
      ...NOTE_MVP2,
      projectId: projects[projectIndex as number].projectId,
      title: title as string,
      createdAt: daysAgoIso(daysAgo as number, index),
      updatedAt: daysAgoIso(daysAgo as number, index),
      meetingStatus: "ENDED" as const,
      meetingStartedAt: null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      // 절반은 내가 시작한 회의로 둔다 — `내가 시작` 필터가 빈 목록만 보여주면 검증이 안 된다.
      meetingStartedBy:
        (projectIndex as number) === 0
          ? { userId: MOCK_USER.userId, name: MOCK_USER.name }
          : null,
    })),
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
    {
      sessionId: "01K0000000029",
      noteId: "01K0000000028",
      status: "COMPLETED",
      readyExpiresAt: "2026-07-12T00:10:00Z",
      startedAt: "2026-07-12T00:00:00Z",
      endedAt: "2026-07-12T00:05:00Z",
      endReason: "CLIENT_DISCONNECTED",
    },
    // READY/ACTIVE 세션은 시드하지 않는다 — `createSession`의 가드가 전역이라(한 유저는
    // 동시에 하나만 녹음) 시드가 하나라도 있으면 모든 세션 생성이 막힌다.
    // `startedAt`·`endedAt`·`endReason`의 null 경로는 `createSession`이 런타임에 만든다.
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
    {
      segmentId: "01K0000000030",
      transcriptionSessionId: "01K0000000029",
      sequence: 1,
      text: "파트너 요구사항을 먼저 확인하겠습니다.",
      startedAtMs: 0,
      endedAtMs: 1900,
    },
    {
      segmentId: "01K0000000031",
      transcriptionSessionId: "01K0000000029",
      sequence: 2,
      text: "다음 배포 일정과 책임자를 정리하겠습니다.",
      startedAtMs: 2300,
      endedAtMs: 4500,
    },
    {
      segmentId: "01K0000000032",
      transcriptionSessionId: "01K0000000029",
      sequence: 3,
      text: "확인한 내용은 회의록에 남기겠습니다.",
      startedAtMs: 5000,
      endedAtMs: 7100,
    },
  ];
  const members: MockMember[] = [
    {
      workspaceId: workspaces[0].workspaceId,
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: "ADMIN",
      image: user.image,
      joinedAt: "2026-07-01T00:00:00Z",
    },
    {
      workspaceId: workspaces[0].workspaceId,
      userId: "01K0000000020",
      name: "한지원",
      email: "jiwon@heymoa.com",
      role: "MEMBER",
      image: null,
      joinedAt: "2026-07-02T00:00:00Z",
    },
    {
      workspaceId: workspaces[1].workspaceId,
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: "ADMIN",
      image: user.image,
      joinedAt: "2026-07-03T00:00:00Z",
    },
  ];
  // 아직 멤버가 아닌 워크스페이스에서 온 초대여야 수락이 실제 합류를 흉내낸다.
  // 이미 들어가 있는 워크스페이스를 가리키면 수락이 멤버를 중복으로 만든다.
  // 받은 초대 하나를 대기 상태로 시드한다 — 알림 벨의 수락/거절을 데모에서 바로 밟을 수 있어야 한다.
  const invitations: MockInvitation[] = [
    {
      workspaceId: INVITED_WORKSPACE.workspaceId,
      invitationId: "01K0000000021",
      inviteeName: user.name,
      inviteeEmail: user.email,
      inviteeImage: user.image,
      inviterName: "한지원",
      role: "MEMBER",
      status: "PENDING",
      createdAt: "2026-07-11T00:00:00Z",
    },
  ];
  const notifications: NotificationListResponseDataNotificationsItem[] = [
    {
      notificationId: "01K0000000022",
      type: "WORKSPACE_INVITATION",
      readAt: null,
      createdAt: "2026-07-11T00:00:00Z",
      invitation: {
        invitationId: invitations[0].invitationId,
        status: invitations[0].status,
        role: invitations[0].role,
        workspaceId: INVITED_WORKSPACE.workspaceId,
        workspaceName: INVITED_WORKSPACE.name,
        inviterName: invitations[0].inviterName,
      },
    },
    // 이미 읽은 알림. `readAt`이 전부 null이면 벨의 읽음 표시와 안읽음 카운트 분기가
    // 한쪽만 검증된다.
    {
      notificationId: "01K0000000023",
      type: "WORKSPACE_INVITATION",
      readAt: "2026-07-11T01:00:00Z",
      createdAt: "2026-07-10T00:00:00Z",
      invitation: {
        invitationId: "01K0000000024",
        status: "ACCEPTED",
        role: "MEMBER",
        workspaceId: workspaces[1].workspaceId,
        workspaceName: workspaces[1].name,
        inviterName: "한지원",
      },
    },
  ];
  // 연동은 두 provider가 모두 미연동으로 시작한다 — 연결 흐름을 데모에서 직접 밟게 한다.
  const integrations: MockIntegration[] = workspaces.flatMap((workspace) =>
    SUPPORTED_PROVIDERS.map((provider) => ({
      workspaceId: workspace.workspaceId,
      provider,
      connected: false,
      connectedBy: null,
      connectedAt: null,
    }))
  );
  return {
    user,
    workspaces,
    projects,
    notes,
    sessions,
    segments,
    members,
    invitations,
    notifications,
    analyses: [],
    // 액션 아이템은 분석에서 나온다. 시드는 「지난 기한 / 이번 주 / 기한 없음」과
    // 담당자 유/무를 한 번씩 갖는다 — 화면의 세 묶음과 「미지정」 분기를 목으로 볼 수 있게.
    actionItems: [
      {
        actionItemId: "01K0000000060",
        noteId: notes[0].noteId,
        noteTitle: notes[0].title,
        projectId: notes[0].projectId,
        text: "결제 개편 착수 시점 확정",
        assignee: { userId: "01K0000000099", name: "김서연" },
        dueAt: daysAgoIso(2, 0),
        status: "OPEN",
        createdAt: "2026-07-11T00:10:00Z",
      },
      {
        actionItemId: "01K0000000061",
        noteId: notes[0].noteId,
        noteTitle: notes[0].title,
        projectId: notes[0].projectId,
        text: "온보딩 개선 담당 지정",
        assignee: null,
        dueAt: daysAgoIso(1, 0),
        status: "OPEN",
        createdAt: "2026-07-11T00:11:00Z",
      },
      {
        actionItemId: "01K0000000062",
        noteId: notes[1].noteId,
        noteTitle: notes[1].title,
        projectId: notes[1].projectId,
        text: "4분기 목표 지표 초안 작성",
        assignee: { userId: MOCK_USER.userId, name: MOCK_USER.name },
        dueAt: null,
        status: "OPEN",
        createdAt: "2026-07-09T00:10:00Z",
      },
      {
        actionItemId: "01K0000000063",
        noteId: notes[1].noteId,
        noteTitle: notes[1].title,
        projectId: notes[1].projectId,
        text: "인터뷰 대상 리스트 공유",
        assignee: { userId: MOCK_USER.userId, name: MOCK_USER.name },
        dueAt: daysAgoIso(-3, 0),
        status: "DONE",
        createdAt: "2026-07-09T00:12:00Z",
      },
    ],
    integrations,
    sharedChatLocks: new Set<string>(),
    sharedChatForeignLocks: new Map<string, string>(),
    sharedChatPendingApprovals: new Map(),
    agentChats: [],
    agentChatMessages: [],
    // 공유 챗봇은 여러 명이 함께 쓰는 화면이라 빈 상태만 보면 발화자·시각 표기를 검증할 수
    // 없다. 다른 멤버(`authorName`)와 내가 섞인 2왕복을 시드한다.
    sharedChatMessages: [
      {
        messageId: "01K0000000040",
        noteId: notes[0].noteId,
        role: "USER",
        content: "지금까지 나온 액션 아이템 정리해줘",
        authorName: MOCK_USER.name,
        createdAt: "2026-07-11T00:06:00Z",
        toolEvent: null,
      },
      {
        messageId: "01K0000000041",
        noteId: notes[0].noteId,
        role: "ASSISTANT",
        content:
          "지금까지 2건입니다.\n1. 온보딩 이탈 구간 분석\n2. 다음 주 사용자 테스트 진행",
        authorName: null,
        createdAt: "2026-07-11T00:06:30Z",
        toolEvent: null,
      },
      {
        messageId: "01K0000000042",
        noteId: notes[0].noteId,
        role: "USER",
        content: "두 번째 건 담당자는 정해졌어?",
        authorName: "박준호",
        createdAt: "2026-07-11T00:09:00Z",
        toolEvent: null,
      },
      {
        messageId: "01K0000000043",
        noteId: notes[0].noteId,
        role: "ASSISTANT",
        content:
          "04:22에 박준호님이 테스트 대상 20명을 제안했고, 05:12에 이서연님이 모집 마감을 금요일로 정했습니다. 담당자는 아직 정해지지 않았습니다.",
        authorName: null,
        createdAt: "2026-07-11T00:09:20Z",
        toolEvent: null,
      },
    ],
  };
}

function findInvitation(invitationId: string): MockInvitation {
  const invitation = state.invitations.find(
    (candidate) => candidate.invitationId === invitationId
  );
  return invitation ?? fail("INVITATION_NOT_FOUND");
}

/**
 * 알림은 초대의 현재 상태를 보여줘야 한다 (계약 규칙). 초대가 확정되면 알림은 사라지지 않고
 * status만 따라간다 — 취소된 초대의 알림도 목록에 남는다.
 */
function syncInvitationNotification(invitation: MockInvitation) {
  const notification = state.notifications.find(
    (candidate) =>
      candidate.invitation?.invitationId === invitation.invitationId
  );
  if (notification?.invitation)
    notification.invitation.status = invitation.status;
}

/** PENDING 초대를 확정 상태로 옮기고 알림을 맞춘다. 수락만 멤버를 늘린다. */
function resolveInvitation(
  invitationId: string,
  status: NotificationListResponseDataNotificationsItemInvitationStatus
): WorkspaceInvitationActionResponseData {
  const invitation = findInvitation(invitationId);
  if (invitation.status !== "PENDING") fail("INVITATION_NOT_PENDING");
  invitation.status = status;
  syncInvitationNotification(invitation);
  return copy({
    invitationId: invitation.invitationId,
    workspaceId: invitation.workspaceId,
    role: invitation.role,
    status,
  });
}

/** 회의 종료는 시작자만 할 수 있다 (계약 403 NOT_MEETING_STARTER). */
function requireMeetingStarter(note: NoteResponseData) {
  if (note.meetingStartedBy?.userId !== state.user.userId) {
    fail("NOT_MEETING_STARTER");
  }
}

function hasActiveSession(noteId: string) {
  return state.sessions.some(
    (session) =>
      session.noteId === noteId && ACTIVE_STATUSES.has(session.status)
  );
}

function latestAnalysis(noteId: string) {
  return [...state.analyses]
    .reverse()
    .find((analysis) => analysis.noteId === noteId);
}

function findIntegration(workspaceId: string, provider: string) {
  const integration = state.integrations.find(
    (item) => item.workspaceId === workspaceId && item.provider === provider
  );
  return integration ?? fail("INTEGRATION_NOT_FOUND");
}

/**
 * 초대만 와 있는 워크스페이스는 아직 유저의 목록에 없다. 그 워크스페이스를 가리키는
 * 조회는 존재하지 않는 것으로 취급하면 안 되므로 초대 유무도 함께 본다.
 */
/**
 * 워크스페이스가 생기면 멤버(생성자 ADMIN)와 연동 행이 함께 생겨야 한다. 시드에서만
 * 채우면 createWorkspace·초대 수락으로 생긴 워크스페이스는 멤버 목록이 비고 연동 조회가
 * 빈손이 된다.
 */
function attachWorkspaceState(workspaceId: string, role: string) {
  if (!state.members.some((m) => m.workspaceId === workspaceId)) {
    state.members.push({
      workspaceId,
      userId: state.user.userId,
      name: state.user.name,
      email: state.user.email,
      role: role as MockMember["role"],
      image: state.user.image,
      joinedAt: nextTimestamp(),
    });
  }
  for (const provider of SUPPORTED_PROVIDERS) {
    const exists = state.integrations.some(
      (item) => item.workspaceId === workspaceId && item.provider === provider
    );
    if (!exists) {
      state.integrations.push({
        workspaceId,
        provider,
        connected: false,
        connectedBy: null,
        connectedAt: null,
      });
    }
  }
}

function assertWorkspaceOrInvited(workspaceId: string) {
  const known =
    state.workspaces.some((w) => w.workspaceId === workspaceId) ||
    state.invitations.some((i) => i.workspaceId === workspaceId);
  if (!known) fail("WORKSPACE_NOT_FOUND");
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
    .filter(
      (session) =>
        session.noteId === noteId && TERMINAL_STATUSES.has(session.status)
    )
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

function expireReadySessions(noteId: string) {
  const now = Date.now();
  const note =
    state.notes.find((candidate) => candidate.noteId === noteId) ??
    fail("NOTE_NOT_FOUND");
  for (const session of state.sessions) {
    if (
      session.noteId !== noteId ||
      session.status !== "READY" ||
      Date.parse(session.readyExpiresAt) > now
    ) {
      continue;
    }
    session.status = "INTERRUPTED";
    session.endedAt = new Date(now).toISOString();
    session.endReason = "READY_TIMEOUT";
    if (note.meetingStatus === "IN_PROGRESS") note.meetingStatus = "PAUSED";
  }
}

function reset() {
  idCounter = 100;
  timestampCounter = 0;
  state = createSeedState();
}

reset();

export const mockDb = {
  reset,

  /**
   * 공유 챗은 회의가 ACTIVE일 때 한 번에 한 명만 쓴다. 게이트를 스트림 열기 전에
   * 통과시켜야 패배한 쪽이 오류로 끝난 스트림 대신 409 JSON을 받는다.
   */
  /**
   * 개인 챗봇 세션을 만든다. 같은 대상의 기존 활성 세션은 비활성으로 내린다 —
   * "새로운 대화 시작"이 그 동작이고, 다른 대상의 세션에는 영향이 없다.
   */
  createAgentChat(input: {
    scope: string;
    workspaceId?: string | null;
    noteId?: string | null;
  }): AgentChatV2ResponseData {
    const scope = input.scope as AgentChatV2ResponseData["scope"];
    const workspaceId =
      scope === "workspace" ? (input.workspaceId ?? null) : null;
    const noteId = scope === "note" ? (input.noteId ?? null) : null;
    if (scope === "workspace" && !workspaceId) fail("WORKSPACE_NOT_FOUND");
    if (scope === "note" && !noteId) fail("NOTE_NOT_FOUND");
    if (workspaceId) assertWorkspace(workspaceId);
    if (noteId) findNote(noteId);

    state.agentChats
      .filter(
        (chat) =>
          chat.active &&
          chat.scope === scope &&
          chat.workspaceId === workspaceId &&
          chat.noteId === noteId
      )
      .forEach((chat) => {
        chat.active = false;
      });

    const chat: MockAgentChat = {
      chatId: nextId(),
      scope,
      workspaceId,
      noteId,
      title: null,
      createdAt: nextTimestamp(),
      active: true,
    };
    state.agentChats.push(chat);
    return copy(omit(chat, ["active"]));
  },

  /** 새로고침 후 복원용. 활성 세션이 없으면 null이다 (계약이 nullable로 정의). */
  getActiveAgentChat(query: {
    scope: string;
    workspaceId?: string | null;
    noteId?: string | null;
  }): AgentChatV2ResponseData | null {
    const chat = state.agentChats.find(
      (candidate) =>
        candidate.active &&
        candidate.scope === query.scope &&
        candidate.workspaceId === (query.workspaceId ?? null) &&
        candidate.noteId === (query.noteId ?? null)
    );
    return chat ? copy(omit(chat, ["active"])) : null;
  },

  getAgentChatMessages(
    chatId: string
  ): AgentChatMessagesResponseDataMessagesItem[] {
    if (!state.agentChats.some((chat) => chat.chatId === chatId)) {
      fail("AGENT_CHAT_NOT_FOUND");
    }
    return copy(
      state.agentChatMessages
        .filter((message) => message.chatId === chatId)
        .map((message) => omit(message, ["chatId"]))
    );
  },

  /** 스트림이 흐르는 동안 server가 하는 tee를 목도 흉내낸다 — 히스토리가 남아야 관전자·복원이 산다. */
  appendAgentChatMessage(
    chatId: string,
    message: Omit<AgentChatMessagesResponseDataMessagesItem, "createdAt">
  ) {
    state.agentChatMessages.push({
      ...message,
      chatId,
      createdAt: nextTimestamp(),
    });
  },

  getNoteSharedChat(noteId: string): NoteSharedChatResponseData {
    findNote(noteId);
    // 남의 잠금(관전자)이 내 잠금보다 우선한다 — 관전자 화면을 재현하려면 lockedBy가
    // 현재 유저가 아니어야 한다.
    const foreignLocker = state.sharedChatForeignLocks.get(noteId) ?? null;
    const locked = foreignLocker !== null || state.sharedChatLocks.has(noteId);
    return copy({
      chatId: noteId,
      messages: state.sharedChatMessages
        .filter((message) => message.noteId === noteId)
        .map((message) => omit(message, ["noteId"])),
      lock: {
        locked,
        lockedBy:
          foreignLocker ??
          (state.sharedChatLocks.has(noteId) ? state.user.name : null),
        // 관전자는 스트림을 받지 않는다 — 승인 대기를 이 필드의 폴링으로만 본다 (계약).
        pendingApproval: state.sharedChatPendingApprovals.get(noteId) ?? null,
      },
    });
  },

  /** 관전자 화면 재현: 현재 유저가 아닌 멤버가 입력 중인 잠금을 세운다 (null이면 해제). */
  seedForeignLock(noteId: string, lockedBy: string | null) {
    if (lockedBy) state.sharedChatForeignLocks.set(noteId, lockedBy);
    else state.sharedChatForeignLocks.delete(noteId);
  },

  appendSharedChatMessage(
    noteId: string,
    message: Omit<
      NoteSharedChatResponseDataMessagesItem,
      "createdAt" | "messageId"
    >
  ) {
    state.sharedChatMessages.push({
      ...message,
      noteId,
      messageId: nextId(),
      createdAt: nextTimestamp(),
    });
  },

  acquireSharedChatLock(noteId: string) {
    const note = findNote(noteId);
    // 계약의 ACTIVE 판정은 IN_PROGRESS만이 아니라 "녹음이 시작됐는가"까지다.
    // 새 노트는 NOT_STARTED이고, 세션 생성 뒤에만 시작자가 정해진다.
    if (note.meetingStatus !== "IN_PROGRESS" || !note.meetingStartedBy) {
      fail("MEETING_NOT_ACTIVE");
    }
    // 남의 잠금(시드된 관전자 상태)도 실제로 막아야 계약(다른 멤버 입력 중이면 CHAT_LOCKED)을
    // 그대로 시연한다 — GET만 잠겼다고 하고 POST는 통과하면 목이 계약과 어긋난다.
    if (
      state.sharedChatLocks.has(noteId) ||
      state.sharedChatForeignLocks.has(noteId)
    ) {
      fail("CHAT_LOCKED");
    }
    state.sharedChatLocks.add(noteId);
  },

  releaseSharedChatLock(noteId: string) {
    state.sharedChatLocks.delete(noteId);
    state.sharedChatPendingApprovals.delete(noteId);
  },

  /** 스트림이 승인을 기다리는 동안 관전자에게 보일 대기 상태를 세운다. */
  setSharedChatPendingApproval(
    noteId: string,
    pending: NoteSharedChatResponseDataLockPendingApproval | null
  ) {
    if (pending) state.sharedChatPendingApprovals.set(noteId, pending);
    else state.sharedChatPendingApprovals.delete(noteId);
  },

  endMeeting(noteId: string): AnalysisResultResponseData {
    const note = findNote(noteId);
    if (note.meetingStatus === "NOT_STARTED") fail("MEETING_NOT_STARTED");
    if (note.meetingStatus === "ENDED") fail("MEETING_ALREADY_ENDED");
    requireMeetingStarter(note);
    // 계약: 진행 중인 전사가 있으면 409. web은 stop을 먼저 보내고 다시 호출해야 한다.
    if (hasActiveSession(noteId)) fail("ACTIVE_TRANSCRIPTION_SESSION");
    note.meetingStatus = "ENDED";
    return this.requestAnalysis(noteId);
  },

  requestAnalysis(noteId: string): AnalysisResultResponseData {
    const note = findNote(noteId);
    if (note.meetingStatus !== "ENDED") fail("MEETING_NOT_ENDED");
    const pending = latestAnalysis(noteId);
    if (
      pending &&
      (pending.status === "PENDING" || pending.status === "RUNNING")
    ) {
      fail("ANALYSIS_IN_PROGRESS");
    }
    const analysis: AnalysisResultResponseData = {
      analysisId: nextId(),
      noteId,
      status: "PENDING",
      overview: null,
      actionItems: null,
      insights: null,
      errorCode: null,
      errorMessage: null,
    };
    state.analyses.push(analysis);
    return copy(analysis);
  },

  /**
   * 대기 중인 분석을 완료로 넘긴다. 실제 서버는 heymoa-ai의 callback으로 채워지지만
   * 목에는 그걸 밀어줄 주체가 없어 폴링 데모와 테스트가 이 함수를 직접 부른다.
   */
  advanceAnalysis(noteId: string): AnalysisResultResponseData | null {
    const analysis = latestAnalysis(noteId);
    if (!analysis || analysis.status !== "PENDING") return null;
    analysis.status = "SUCCEEDED";
    analysis.overview = "## 회의 개요\n\n출시 일정과 담당을 정했습니다.";
    analysis.actionItems =
      "- 배포 체크리스트 작성 (김민수)\n- QA 일정 공유 (한지원)";
    analysis.insights = "- 일정 리스크는 QA 인력에 몰려 있습니다.";
    return copy(analysis);
  },

  getLatestAnalysis(noteId: string): AnalysisResultResponseData {
    findNote(noteId);
    return copy(latestAnalysis(noteId) ?? fail("ANALYSIS_JOB_NOT_FOUND"));
  },

  listIntegrations(
    workspaceId: string
  ): ToolConnectionsResponseDataIntegrationsItem[] {
    assertWorkspace(workspaceId);
    return copy(
      state.integrations
        .filter((item) => item.workspaceId === workspaceId)
        .map((item) => omit(item, ["workspaceId"]))
    );
  },

  connectIntegration(
    workspaceId: string,
    provider: string
  ): ToolConnectionsResponseDataIntegrationsItem {
    assertWorkspace(workspaceId);
    const integration = findIntegration(workspaceId, provider);
    if (integration.connected) fail("INTEGRATION_ALREADY_CONNECTED");
    integration.connected = true;
    integration.connectedBy = state.user.name;
    integration.connectedAt = nextTimestamp();
    return copy(omit(integration, ["workspaceId"]));
  },

  /** 연결만 끊고 행은 남긴다 — 계약이 미연동 provider도 목록에 담기 때문이다. */
  disconnectIntegration(
    workspaceId: string,
    provider: string
  ): ToolConnectionsResponseDataIntegrationsItem {
    assertWorkspace(workspaceId);
    const integration = findIntegration(workspaceId, provider);
    if (!integration.connected) fail("INTEGRATION_NOT_CONNECTED");
    integration.connected = false;
    integration.connectedBy = null;
    integration.connectedAt = null;
    return copy(omit(integration, ["workspaceId"]));
  },

  listMembers(workspaceId: string): WorkspaceMemberListResponseData["members"] {
    assertWorkspace(workspaceId);
    return copy(
      state.members
        .filter((member) => member.workspaceId === workspaceId)
        .map((member) => omit(member, ["workspaceId"]))
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
    );
  },

  listInvitations(
    workspaceId: string
  ): WorkspaceInvitationListResponseData["invitations"] {
    assertWorkspaceOrInvited(workspaceId);
    return copy(
      state.invitations
        .filter(
          (invitation) =>
            invitation.workspaceId === workspaceId &&
            invitation.status === "PENDING"
        )
        .map((invitation) => omit(invitation, ["workspaceId", "status"]))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  },

  createInvitation(
    workspaceId: string,
    input: { email: string; role: string }
  ): WorkspaceInvitationActionResponseData {
    assertWorkspace(workspaceId);
    // ponytail: 서버는 초대 대상 조회에 이메일을 정규화하지 않아 대문자가 섞이면 가입자도
    // 못 찾는다(404). 실제 가입자 레지스트리가 없으니 그 quirk를 대문자 휴리스틱으로 흉내 낸다.
    if (input.email !== input.email.toLowerCase()) fail("INVITEE_NOT_FOUND");
    const alreadyMember = state.members.some(
      (member) =>
        member.workspaceId === workspaceId && member.email === input.email
    );
    if (alreadyMember) fail("ALREADY_WORKSPACE_MEMBER");
    const alreadyInvited = state.invitations.some(
      (invitation) =>
        invitation.workspaceId === workspaceId &&
        invitation.inviteeEmail === input.email &&
        invitation.status === "PENDING"
    );
    if (alreadyInvited) fail("DUPLICATE_PENDING_INVITATION");

    const invitation: MockInvitation = {
      workspaceId,
      invitationId: nextId(),
      inviteeName: input.email.split("@")[0],
      inviteeEmail: input.email,
      inviteeImage: null,
      inviterName: state.user.name,
      role: input.role as MockInvitation["role"],
      status: "PENDING",
      createdAt: nextTimestamp(),
    };
    state.invitations.push(invitation);
    return copy({
      invitationId: invitation.invitationId,
      workspaceId,
      role: invitation.role,
      status: invitation.status,
    });
  },

  acceptInvitation(
    invitationId: string
  ): WorkspaceInvitationActionResponseData {
    const invitation = findInvitation(invitationId);
    const resolved = resolveInvitation(invitationId, "ACCEPTED");
    const isSelf = invitation.inviteeEmail === state.user.email;

    // 본인이 받은 초대를 수락하면 그 워크스페이스가 목록에 나타나야 한다 — 그게 합류다.
    // 기본 워크스페이스는 바뀌지 않는다 (계약).
    if (
      isSelf &&
      !state.workspaces.some((w) => w.workspaceId === invitation.workspaceId)
    ) {
      state.workspaces.push({
        workspaceId: invitation.workspaceId,
        name: INVITED_WORKSPACE.name,
        description: null,
        isDefault: false,
        role: invitation.role,
      });
      attachWorkspaceState(invitation.workspaceId, invitation.role);
    }

    const alreadyMember = state.members.some(
      (member) =>
        member.workspaceId === invitation.workspaceId &&
        member.email === invitation.inviteeEmail
    );
    if (!alreadyMember) {
      state.members.push({
        workspaceId: invitation.workspaceId,
        userId: isSelf ? state.user.userId : nextId(),
        name: invitation.inviteeName,
        email: invitation.inviteeEmail,
        role: invitation.role,
        image: invitation.inviteeImage,
        joinedAt: nextTimestamp(),
      });
    }
    return resolved;
  },

  declineInvitation(
    invitationId: string
  ): WorkspaceInvitationActionResponseData {
    return resolveInvitation(invitationId, "DECLINED");
  },

  cancelInvitation(
    invitationId: string
  ): WorkspaceInvitationActionResponseData {
    return resolveInvitation(invitationId, "CANCELED");
  },

  listNotifications(): NotificationListResponseData {
    return copy({
      notifications: [...state.notifications].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      ),
      unreadCount: state.notifications.filter((item) => item.readAt === null)
        .length,
    });
  },

  /** 계약은 식별자만 돌려준다 — 전체 알림을 흘리면 UI가 없는 필드에 기대게 된다. */
  markNotificationRead(
    notificationId: string
  ): MarkNotificationReadResponseData {
    const notification = state.notifications.find(
      (candidate) => candidate.notificationId === notificationId
    );
    if (!notification) fail("NOTIFICATION_NOT_FOUND");
    notification.readAt ??= nextTimestamp();
    return copy({ notificationId: notification.notificationId });
  },

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
    attachWorkspaceState(workspace.workspaceId, workspace.role);
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
      isDefault: false,
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

  listNotes(projectId: string, params: GetNotesParams = {}): NoteSummary[] {
    assertProject(projectId);
    state.notes
      .filter((note) => note.projectId === projectId)
      .forEach((note) => expireReadySessions(note.noteId));
    const from = params.from ? Date.parse(params.from) : null;
    const to = params.to ? Date.parse(params.to) : null;
    const sort = params.sort ?? "updatedAt_desc";
    const notes = state.notes
      .filter((note) => note.projectId === projectId)
      // 기간은 회의가 놓이는 시각(예정 또는 생성) 기준이다. 타임라인이 쓴다.
      .filter((note) => {
        const at = Date.parse(note.scheduledAt ?? note.createdAt);
        return (from === null || at >= from) && (to === null || at <= to);
      })
      .sort((a, b) => {
        if (sort === "scheduledAt_asc") {
          const left = a.scheduledAt ? Date.parse(a.scheduledAt) : Infinity;
          const right = b.scheduledAt ? Date.parse(b.scheduledAt) : Infinity;
          return left - right || a.noteId.localeCompare(b.noteId);
        }
        const key = sort === "startedAt_desc" ? "meetingStartedAt" : "updatedAt";
        const left = a[key] ? Date.parse(a[key] as string) : -Infinity;
        const right = b[key] ? Date.parse(b[key] as string) : -Infinity;
        return right - left || b.noteId.localeCompare(a.noteId);
      })
      .map((note) => {
        const startedAt = state.sessions
          .filter(
            (session) =>
              session.noteId === note.noteId && session.endedAt !== null
          )
          .map((session) => session.startedAt)
          .filter((value): value is string => value !== null)
          .sort((a, b) => b.localeCompare(a))[0];
        return {
          ...note,
          lastRecordedAt: startedAt ?? null,
          recordedDurationMs: getRecordedDurationMs(note.noteId),
          activeSessionStartedAt:
            state.sessions.find(
              (session) =>
                session.noteId === note.noteId && session.status === "ACTIVE"
            )?.startedAt ?? null,
        };
      });
    return copy(notes);
  },

  createNote(
    projectId: string,
    input: Partial<NoteCreateRequest>
  ): NoteResponseData {
    assertProject(projectId);
    const createdAt = nextTimestamp();
    // contextFromNoteIds의 첫 항목이 previousNoteId의 기본값이다 — 「지난 회의에서
    // 가져오기」로 고른 첫 회의가 곧 선행 회의라는 계약을 목도 지킨다.
    const previousNoteId =
      input.previousNoteId ?? input.contextFromNoteIds?.[0] ?? null;
    const note: NoteResponseData = {
      ...NOTE_MVP2,
      scheduledAt: input.scheduledAt ?? null,
      context: input.context ?? null,
      participants: (input.participantIds ?? []).map((userId) => ({
        userId,
        name:
          state.members.find((member) => member.userId === userId)?.name ??
          "알 수 없음",
        email: null,
      })),
      previousNote: previousNoteId
        ? { noteId: previousNoteId, title: findNote(previousNoteId).title }
        : null,
      noteId: nextId(),
      projectId,
      title: input.title?.trim() || "제목 없는 노트",
      createdAt,
      updatedAt: createdAt,
      meetingStatus: "NOT_STARTED",
      meetingStartedAt: null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: null,
    };
    state.notes.push(note);
    return copy(note);
  },

  getNote(noteId: string): NoteResponseData {
    expireReadySessions(noteId);
    const note = findNote(noteId);
    return copy({
      ...note,
      recordedDurationMs: getRecordedDurationMs(noteId),
      activeSessionStartedAt:
        state.sessions.find(
          (session) => session.noteId === noteId && session.status === "ACTIVE"
        )?.startedAt ?? null,
      // 목록과 같은 값을 줘야 한다. 단건만 늘 null이면 상세의 「마지막 기록」이 목에서
      // 한쪽 분기만 보인다.
      lastRecordedAt: lastRecordedAtOf(noteId),
    });
  },

  /**
   * 부분 수정. 키가 없으면 그대로 두고, 키가 있고 null이면 지운다 — 이 구분이 없으면
   * 「일시 미정으로 되돌리기」를 표현할 수 없다.
   */
  updateNote(noteId: string, input: NoteUpdateRequest): NoteResponseData {
    const note = findNote(noteId);
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) fail("BAD_REQUEST");
      note.title = title;
    }
    if (input.projectId !== undefined) {
      assertProject(input.projectId);
      note.projectId = input.projectId;
    }
    if ("scheduledAt" in input) note.scheduledAt = input.scheduledAt ?? null;
    if ("context" in input) note.context = input.context ?? null;
    if ("participantIds" in input) {
      note.participants = (input.participantIds ?? []).map((userId) => ({
        userId,
        name:
          state.members.find((member) => member.userId === userId)?.name ??
          "알 수 없음",
        email: null,
      }));
    }
    if ("previousNoteId" in input) {
      note.previousNote = input.previousNoteId
        ? {
            noteId: input.previousNoteId,
            title: findNote(input.previousNoteId).title,
          }
        : null;
    }
    note.updatedAt = nextTimestamp();
    return this.getNote(noteId);
  },

  createSession(noteId: string): StartTranscriptionSessionResponseData {
    const note = findNote(noteId);
    if (
      note.meetingStartedBy &&
      note.meetingStartedBy.userId !== state.user.userId
    ) {
      fail("NOT_MEETING_STARTER");
    }
    // 계약의 409에 `MEETING_ALREADY_ENDED`가 생겨(APP-214, server@a582684) 목도 막는다.
    // **서버는 원래부터 막고 있었다** — 없던 것은 계약뿐이었고, 그래서 목과 생성 클라이언트만
    // 그 사실을 몰랐다. 즉 위험은 "구멍이 뚫렸다"가 아니라 "막혀 있는데 로컬만 초록"이었다.
    if (note.meetingStatus === "ENDED") fail("MEETING_ALREADY_ENDED");
    expireReadySessions(noteId);
    if (state.sessions.some((session) => ACTIVE_STATUSES.has(session.status))) {
      fail("ACTIVE_TRANSCRIPTION_SESSION");
    }
    const session: MockSession = {
      sessionId: nextId(),
      noteId,
      status: "READY",
      readyExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      startedAt: null,
      endedAt: null,
      endReason: null,
    };
    // 회의 시작자는 녹음을 처음 시작한 유저다 (계약). 이후 시작자만 회의를 종료할 수 있다.
    note.meetingStartedBy ??= {
      userId: state.user.userId,
      name: state.user.name,
    };
    note.meetingStatus = "IN_PROGRESS";
    state.sessions.push(session);
    return copy(session) as unknown as StartTranscriptionSessionResponseData;
  },

  getSession(sessionId: string): TranscriptionSessionResponseData {
    const session = findSession(sessionId);
    expireReadySessions(session.noteId);
    return copy(session) as unknown as TranscriptionSessionResponseData;
  },

  getCurrentSession(
    noteId: string
  ): CurrentTranscriptionSessionNullableResponseData {
    expireReadySessions(noteId);
    const session = state.sessions.find(
      (candidate) =>
        candidate.noteId === noteId &&
        (candidate.status === "ACTIVE" ||
          (candidate.status === "READY" &&
            Date.parse(candidate.readyExpiresAt) > Date.now()))
    );
    return session
      ? {
          sessionId: session.sessionId,
          noteId: session.noteId,
          status: session.status as "READY" | "ACTIVE",
          readyExpiresAt: session.readyExpiresAt,
          startedAt: session.startedAt,
        }
      : null;
  },

  updateSessionStatus(
    sessionId: string,
    status: string
  ): TranscriptionSessionResponseData {
    const session = findSession(sessionId);
    session.status = status;
    if (status === "ACTIVE" && !session.startedAt) {
      session.startedAt = nextSessionTimestamp();
      findNote(session.noteId).meetingStartedAt ??= session.startedAt;
    }
    if (TERMINAL_STATUSES.has(status)) {
      session.endedAt = nextSessionTimestamp();
      const note = findNote(session.noteId);
      if (note.meetingStatus !== "ENDED") note.meetingStatus = "PAUSED";
    }
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

  // ── MVP2 ────────────────────────────────────────────────────────────────
  /**
   * 워크스페이스 전역 회의 목록. 프로젝트 단위 목록만으로는 「모든 회의」를 못 그린다.
   * 커서는 정렬 키의 마지막 값을 그대로 쓴다 — 목이라 불투명할 필요가 없다.
   */
  listWorkspaceNotes(
    workspaceId: string,
    params: GetWorkspaceNotesParams = {}
  ): NotePageResponseData {
    assertWorkspace(workspaceId);
    const projectIds = new Set(
      state.projects
        .filter((project) => project.workspaceId === workspaceId)
        .map((project) => project.projectId)
    );
    const q = params.q?.trim().toLowerCase();
    const statuses = params.meetingStatus;
    let rows = state.projects
      .filter((project) => projectIds.has(project.projectId))
      .flatMap((project) => mockDb.listNotes(project.projectId));
    if (params.projectId) {
      rows = rows.filter((note) => note.projectId === params.projectId);
    }
    if (statuses?.length) {
      rows = rows.filter((note) =>
        (statuses as string[]).includes(note.meetingStatus)
      );
    }
    if (q) {
      rows = rows.filter((note) => {
        const project = state.projects.find(
          (candidate) => candidate.projectId === note.projectId
        );
        return (
          note.title.toLowerCase().includes(q) ||
          (project?.name.toLowerCase().includes(q) ?? false) ||
          note.participants.some((person) =>
            person.name.toLowerCase().includes(q)
          )
        );
      });
    }
    const sort = params.sort ?? "updatedAt_desc";
    rows.sort((a, b) => {
      if (sort === "scheduledAt_asc") {
        // 일시 미정은 늘 뒤로. null을 빈 문자열로 두면 가장 앞으로 와서 「예정」이 거짓말을 한다.
        const left = a.scheduledAt ? Date.parse(a.scheduledAt) : Infinity;
        const right = b.scheduledAt ? Date.parse(b.scheduledAt) : Infinity;
        return left - right || a.noteId.localeCompare(b.noteId);
      }
      const key = sort === "startedAt_desc" ? "meetingStartedAt" : "updatedAt";
      const left = a[key] ? Date.parse(a[key] as string) : -Infinity;
      const right = b[key] ? Date.parse(b[key] as string) : -Infinity;
      return right - left || b.noteId.localeCompare(a.noteId);
    });
    const limit = params.limit ?? 30;
    // 커서가 가리키던 행이 사라지면(삭제·필터 변경) findIndex가 -1이다. 여기에 1을 더하면
    // 첫 페이지로 되감겨 무한히 같은 페이지를 준다 — 못 찾으면 끝난 것으로 본다.
    const at = params.cursor
      ? rows.findIndex((note) => note.noteId === params.cursor)
      : -1;
    if (params.cursor && at === -1) return copy({ notes: [], nextCursor: null });
    const from = at + 1;
    const page = rows.slice(from, from + limit);
    return copy({
      notes: page,
      nextCursor:
        from + limit < rows.length ? (page.at(-1)?.noteId ?? null) : null,
    });
  },

  deleteNote(noteId: string) {
    const note = findNote(noteId);
    // 기록 중 삭제는 전사 세션과 경합한다. 계약이 409로 막는 자리다.
    if (note.meetingStatus === "IN_PROGRESS") fail("MEETING_IN_PROGRESS");
    state.notes = state.notes.filter((row) => row.noteId !== noteId);
    state.actionItems = state.actionItems.filter((row) => row.noteId !== noteId);
  },

  readAllNotifications(): NotificationListResponseData {
    const readAt = nextTimestamp();
    for (const notification of state.notifications) notification.readAt ??= readAt;
    return mockDb.listNotifications();
  },

  listActionItems(
    workspaceId: string,
    params: GetActionItemsParams = {}
  ): ActionItemPageResponseData {
    assertWorkspace(workspaceId);
    const projectIds = new Set(
      state.projects
        .filter((project) => project.workspaceId === workspaceId)
        .map((project) => project.projectId)
    );
    const q = params.q?.trim().toLowerCase();
    let rows = state.actionItems.filter((item) =>
      projectIds.has(item.projectId)
    );
    const status = params.status ?? "OPEN";
    if (status !== "ALL") rows = rows.filter((item) => item.status === status);
    if (params.projectId) {
      rows = rows.filter((item) => item.projectId === params.projectId);
    }
    if (params.assigneeId === "UNASSIGNED") {
      rows = rows.filter((item) => item.assignee === null);
    } else if (params.assigneeId) {
      rows = rows.filter(
        (item) => item.assignee?.userId === params.assigneeId
      );
    }
    if (params.dueBefore) {
      const before = params.dueBefore;
      // 문자열 비교는 +09:00 오프셋을 잘못 정렬한다. 시각으로 판정한다.
      const boundary = Date.parse(before);
      rows = rows.filter(
        (item) => item.dueAt !== null && Date.parse(item.dueAt) < boundary
      );
    }
    if (q) rows = rows.filter((item) => item.text.toLowerCase().includes(q));
    // 기한 없음은 늘 뒤로 — 목록이 「언제까지」로 묶이기 때문이다.
    rows.sort(
      (a, b) =>
        (a.dueAt ? Date.parse(a.dueAt) : Infinity) -
          (b.dueAt ? Date.parse(b.dueAt) : Infinity) ||
        a.actionItemId.localeCompare(b.actionItemId)
    );
    const limit = params.limit ?? 50;
    const at = params.cursor
      ? rows.findIndex((item) => item.actionItemId === params.cursor)
      : -1;
    if (params.cursor && at === -1) {
      return copy({ actionItems: [], nextCursor: null });
    }
    const from = at + 1;
    const page = rows.slice(from, from + limit);
    return copy({
      actionItems: page,
      nextCursor:
        from + limit < rows.length ? (page.at(-1)?.actionItemId ?? null) : null,
    });
  },

  updateActionItem(
    actionItemId: string,
    input: ActionItemUpdateRequest
  ): ActionItem {
    const item = state.actionItems.find(
      (row) => row.actionItemId === actionItemId
    );
    if (!item) fail("ACTION_ITEM_NOT_FOUND");
    if (input.status !== undefined) item.status = input.status;
    if ("dueAt" in input) item.dueAt = input.dueAt ?? null;
    if ("assigneeId" in input) {
      const member = state.members.find(
        (row) => row.userId === input.assigneeId
      );
      item.assignee = input.assigneeId
        ? { userId: input.assigneeId, name: member?.name ?? "알 수 없음" }
        : null;
    }
    return copy(item);
  },
};
