import { faker } from "@faker-js/faker";
import type {
  CreateWorkspaceRequest,
  CurrentTranscriptionSessionNullableResponseData,
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
  TranscriptResponseData,
  TranscriptResponseDataDiarization,
  TranscriptResponseDataGapsItem,
} from "@/lib/api/generated/models";
import { getAppDateKey } from "@/lib/format/date";
import { MOCK_USER } from "@/lib/mocks/mock-user";

const ACTIVE_STATUSES = new Set<string>(["READY", "ACTIVE"]);

const TERMINAL_STATUSES = new Set<string>(["COMPLETED", "INTERRUPTED"]);

type AddSegmentInput = Pick<
  TranscriptResponseDataSegmentsItem,
  "text" | "startedAtMs" | "endedAtMs"
>;

type MockSession = Omit<TranscriptionSessionResponseData, "status"> & {
  status: string;
};

/**
 * 목이 저장하는 발화. 응답 타입에는 `transcriptionSessionId`가 없다 — 그 필드가 있는 동안
 * web 이 세션 경계로 타임라인을 이어 붙였다. 소속은 안쪽에서만 들고 있고, 응답으로 나갈 때
 * 회의 축 좌표로 바뀐다.
 */
type StoredSegment = TranscriptResponseDataSegmentsItem & {
  transcriptionSessionId: string;
};

/**
 * 세션마다 회의 축의 원점.
 *
 * ```
 * note_offset_ms(N) = Σ (session_i.ended_at − session_i.started_at)  for i < N
 * ```
 *
 * **세션 길이만 더하고 사이는 안 더한다** — 중지는 회의 축에서 제외다. 서버의 V25
 * 마이그레이션이 쓰는 것과 같은 식이다.
 */
function noteOffsetsMs(sessions: MockSession[]) {
  const offsets = new Map<string, number>();
  let accumulated = 0;
  for (const session of sessions) {
    offsets.set(session.sessionId, accumulated);
    if (session.startedAt && session.endedAt) {
      accumulated += Math.max(
        0,
        Date.parse(session.endedAt) - Date.parse(session.startedAt)
      );
    }
  }
  return offsets;
}

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

/**
 * 워크스페이스를 떠난 시작자의 아바타. 멤버 목록에 없어 참여자에서 이미지를 빌릴 수 없는
 * 유일한 표본이라, 계약이 `meetingStartedBy.image`를 싣는지가 여기서만 눈에 보인다.
 * `MOCK_AVATAR`와 같은 이유로 원격 URL이 아닌 인라인 data URI다 (오프라인에서 안 흔들린다).
 */
const EX_MEMBER_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#c7d3d8"/><circle cx="32" cy="25" r="11" fill="#6b7f88"/><path d="M8 64c0-13 11-21 24-21s24 8 24 21z" fill="#6b7f88"/></svg>'
  );

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
  segments: StoredSegment[];
  /** 화자 분리 결과. 목이 시나리오로 심는다 — 아직 만드는 흐름이 없다(APP-419·420). */
  diarizations: Map<string, TranscriptResponseDataDiarization>;
  /** 세션 사이가 아닌 공백(CAPTURE·UPLOAD). 서버가 오브젝트에서 유도하는 것을 목이 심는다. */
  extraGaps: Map<string, TranscriptResponseDataGapsItem[]>;
  members: MockMember[];
  invitations: MockInvitation[];
  notifications: NotificationListResponseDataNotificationsItem[];
  analyses: AnalysisResultResponseData[];
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

/**
 * 시드 화자를 **실제 참여자에서** 만든다.
 *
 * 이름을 손으로 박으면 참여자 시드가 바뀔 때 조용히 어긋난다 — 실제로 없는 사람 이름이
 * 화자에 붙어 있었고, 그 상태로는 「연결을 옮기면 앞 화자에서 떨어진다」가 테스트되지 않는다.
 */
function seededDiarizations(
  notes: NoteResponseData[]
): Map<string, TranscriptResponseDataDiarization> {
  const note = notes.find((row) => row.noteId === "01K0000000020");
  const first = note?.participants[0];
  if (!first) return new Map();
  return new Map([
    [
      note.noteId,
      {
        status: "MAPPED",
        speakers: [
          {
            label: "A",
            speakingMs: 940_000,
            segmentCount: 2,
            representativeSegmentId: "01K0000000061",
            assignedUserId: first.userId,
            assignedName: first.name,
            confirmed: true,
          },
          {
            label: "B",
            speakingMs: 610_000,
            segmentCount: 1,
            representativeSegmentId: "01K0000000062",
            assignedUserId: null,
            assignedName: null,
            confirmed: false,
          },
        ],
      },
    ],
  ]);
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
      role: "ADMIN",
    },
    // description은 계약상 nullable이다 — 설명 없는 워크스페이스를 화면이 어떻게 그리는지
    // 목이 한 번도 안 보여주면 그 레이아웃은 검증되지 않는다.
    {
      workspaceId: "01K0000000006",
      name: "제품 팀",
      description: null,
      role: "ADMIN",
    },
    // **프로젝트가 하나도 없는 워크스페이스.** 새로 만든 워크스페이스는 항상 이 상태로
    // 시작하는데 목에 표본이 없어서 온보딩 화면을 아무도 못 봤다. 노트도 프로젝트도
    // 시드하지 않는다 — 비어 있는 것이 이 표본의 내용이다.
    {
      workspaceId: "01K0000000009",
      name: "새 워크스페이스",
      description: null,
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
    // 설명 없는 프로젝트. 목록 행과 상세 헤더가 null을 어떻게 다루는지의 유일한 표본이다.
    {
      projectId: "01K0000000008",
      workspaceId: workspaces[1].workspaceId,
      name: "리서치",
      description: null,
      createdAt: "2026-07-04T00:00:00Z",
      updatedAt: "2026-07-04T00:00:00Z",
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
    {
      workspaceId: workspaces[2].workspaceId,
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: "ADMIN",
      image: user.image,
      joinedAt: "2026-07-05T00:00:00Z",
    },
  ];

  // 서버는 참여자를 이름 오름차순으로 내린다. 목도 같은 순서를 지켜야 아바타 순서가
  // 화면 검증에서 뒤집히지 않는다.
  /**
   * **노트가 속한 워크스페이스의 멤버만** 참여자로 넣는다. 서버가 그 워크스페이스 멤버만
   * 받으므로(`NOT_WORKSPACE_MEMBER`), 다른 워크스페이스 사람을 시드해 두면 그 노트에서
   * 참여자를 한 명 추가하는 순간 보이지도 않는 ID까지 함께 PUT되어 400으로 막힌다.
   * 메뉴에 없으니 지울 수도 없어 그 노트만 영영 편집 불가가 된다.
   *
   * members는 (워크스페이스, 유저) 쌍이라 같은 사람이 여러 줄이다 — userId로 한 번만 집는다.
   */
  const participantsOf = (
    projectId: string,
    ...userIds: string[]
  ): NoteResponseData["participants"] => {
    const workspaceId = projects.find(
      (project) => project.projectId === projectId
    )?.workspaceId;
    return userIds
      .map((userId) =>
        members.find(
          (member) =>
            member.userId === userId && member.workspaceId === workspaceId
        )
      )
      .filter((member) => member !== undefined)
      .map(({ userId, name, email, image }) => ({ userId, name, email, image }))
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId)
      );
  };
  /**
   * 회의 시작자. 계약이 참여자와 **같은 네 필드**를 내리므로 목도 같은 모양으로 시드한다 —
   * 예전에는 시작자만 userId·name이라 화면이 이미지를 참여자 목록에서 빌려 왔고, 그
   * 우회가 사라졌다. 여기서 email·image를 빠뜨리면 목만 옛 계약으로 남는다.
   *
   * 시작자는 워크스페이스 멤버가 아닐 수 있다(회의 뒤 나간 사람). 그 경우는 호출부가
   * 직접 적는다 — members에 없다고 null을 돌려주면 시작자가 통째로 사라진다.
   */
  const starterOf = (userId: string): NoteResponseData["meetingStartedBy"] => {
    const member = members.find((candidate) => candidate.userId === userId);
    if (!member) return null;
    const { name, email, image } = member;
    return { userId, name, email, image };
  };
  const notes: NoteResponseData[] = [
    {
      noteId: "01K0000000002",
      projectId: projects[0].projectId,
      title: "주간 제품 회의",
      createdAt: "2026-07-10T00:00:00Z",
      updatedAt: "2026-07-11T00:00:00Z",
      meetingStatus: "IN_PROGRESS",
      meetingStartedAt: "2026-07-11T00:00:00Z",
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: starterOf(MOCK_USER.userId),
      participants: participantsOf(
        projects[0].projectId,
        MOCK_USER.userId,
        "01K0000000020"
      ),
    },
    {
      noteId: "01K0000000005",
      projectId: projects[1].projectId,
      title: "고객 인터뷰",
      createdAt: "2026-07-09T00:00:00Z",
      updatedAt: "2026-07-09T00:00:00Z",
      meetingStatus: "NOT_STARTED",
      meetingStartedAt: null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: null,
      participants: participantsOf(projects[1].projectId, MOCK_USER.userId),
    },
    {
      noteId: "01K0000000028",
      projectId: projects[0].projectId,
      title: "파트너 검토 회의",
      createdAt: "2026-07-12T00:00:00Z",
      updatedAt: "2026-07-12T00:05:00Z",
      meetingStatus: "IN_PROGRESS",
      meetingStartedAt: "2026-07-12T00:00:00Z",
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      // 워크스페이스 멤버 목록에 없는 시작자다 — 회의 뒤 나간 사람. 참여자에서 이미지를
      // 빌려 올 수 없는 유일한 표본이라, 시작자 아바타 회귀는 이 노트에서만 눈에 띈다.
      // **image를 null로 두면 이 표본이 무의미해진다** — 고쳐도 이니셜만 보이기 때문이다.
      meetingStartedBy: {
        userId: "01K0000000099",
        name: "김서연",
        email: "seoyeon@heymoa.com",
        image: EX_MEMBER_AVATAR,
      },
      participants: participantsOf(
        projects[0].projectId,
        MOCK_USER.userId,
        "01K0000000020"
      ),
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
      meetingStatus: "NOT_STARTED",
      meetingStartedAt: null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: null,
      participants: [],
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
      meetingStatus: "NOT_STARTED",
      meetingStartedAt: null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: null,
      // projects[3]은 두 번째 워크스페이스라 그 워크스페이스 멤버(나)만 들어간다.
      participants: participantsOf(projects[3].projectId, MOCK_USER.userId),
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
      projectId: projects[projectIndex as number].projectId,
      title: title as string,
      createdAt: daysAgoIso(daysAgo as number, index),
      updatedAt: daysAgoIso(daysAgo as number, index),
      meetingStatus: "ENDED" as const,
      meetingStartedAt: null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      // 절반은 내가 시작한 회의로 둔다 — 행의 시작자 아바타가 「나」인 경우도 표본에 있어야 한다.
      //
      // 나머지 절반은 다시 둘로 가른다. **셋 다 필요하다** — 이미지 있는 시작자, 이미지 없는
      // 시작자(한지원), 시작자 자체가 없는 회의. 「시작 전」 노트들도 시작자가 null이지만
      // 그건 표본이 못 된다: `nullable-coverage`가 그 노트들로 세션을 만들면서 시작자를
      // 채워 버려, **종료된 이 노트들만이 null 쪽을 끝까지 들고 있다.**
      meetingStartedBy:
        (projectIndex as number) === 0
          ? starterOf(MOCK_USER.userId)
          : (index as number) < 4
            ? starterOf("01K0000000020")
            : null,
      // 넘침(+N) 표시를 화면에서 볼 수 있게 절반은 참여자를 둘 다 넣는다.
      participants:
        index % 2 === 0
          ? participantsOf(
              projects[projectIndex as number].projectId,
              MOCK_USER.userId,
              "01K0000000020"
            )
          : participantsOf(
              projects[projectIndex as number].projectId,
              MOCK_USER.userId
            ),
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
    // 시드 분석(아래 `analyses`)이 붙은 종료 노트의 세션이다. 근거 인용이 실제 전사 줄을
    // 가리켜야 요약 → 전사 점프를 목에서 밟을 수 있다 — 세그먼트가 없으면 칩만 있고
    // 눌러도 갈 곳이 없다.
    {
      sessionId: "01K0000000060",
      noteId: "01K0000000020",
      status: "COMPLETED",
      readyExpiresAt: "2026-07-13T00:10:00Z",
      startedAt: "2026-07-13T00:00:00Z",
      endedAt: "2026-07-13T00:06:00Z",
      endReason: "CLIENT_DISCONNECTED",
    },
    // READY/ACTIVE 세션은 시드하지 않는다 — `createSession`의 가드가 전역이라(한 유저는
    // 동시에 하나만 녹음) 시드가 하나라도 있으면 모든 세션 생성이 막힌다.
    // `startedAt`·`endedAt`·`endReason`의 null 경로는 `createSession`이 런타임에 만든다.
  ];
  const segments: StoredSegment[] = [
    {
      segmentId: "01K0000000011",
      transcriptionSessionId: sessions[0].sessionId,
      sequence: 1,
      text: "이번 주 제품 진행 상황을 공유하겠습니다.",
      startedAtMs: 0,
      endedAtMs: 1800,
      speakerLabel: null,
    },
    {
      segmentId: "01K0000000012",
      transcriptionSessionId: sessions[0].sessionId,
      sequence: 2,
      text: "첫 번째 안건은 온보딩 개선입니다.",
      startedAtMs: 2200,
      endedAtMs: 4300,
      speakerLabel: null,
    },
    {
      segmentId: "01K0000000013",
      transcriptionSessionId: sessions[0].sessionId,
      sequence: 3,
      text: "다음 주까지 사용자 테스트를 진행합니다.",
      startedAtMs: 5000,
      endedAtMs: 7100,
      speakerLabel: null,
    },
    {
      segmentId: "01K0000000030",
      transcriptionSessionId: "01K0000000029",
      sequence: 1,
      text: "파트너 요구사항을 먼저 확인하겠습니다.",
      startedAtMs: 0,
      endedAtMs: 1900,
      speakerLabel: null,
    },
    {
      segmentId: "01K0000000031",
      transcriptionSessionId: "01K0000000029",
      sequence: 2,
      text: "다음 배포 일정과 책임자를 정리하겠습니다.",
      startedAtMs: 2300,
      endedAtMs: 4500,
      speakerLabel: null,
    },
    {
      segmentId: "01K0000000032",
      transcriptionSessionId: "01K0000000029",
      sequence: 3,
      text: "확인한 내용은 회의록에 남기겠습니다.",
      startedAtMs: 5000,
      endedAtMs: 7100,
      speakerLabel: null,
    },
    // 시드 분석의 근거가 가리키는 줄들. 블록 묶기(최대 6개·간격 1.5초)를 넘기려고 간격을
    // 벌려 둔다 — 한 블록에 다 뭉치면 근거 셋이 같은 자리로 점프해 이동을 검증할 수 없다.
    {
      segmentId: "01K0000000061",
      transcriptionSessionId: "01K0000000060",
      speakerLabel: "A",
      sequence: 1,
      text: "가입 후 첫 회의를 만들기까지 이탈이 가장 큽니다.",
      startedAtMs: 12000,
      endedAtMs: 15200,
    },
    {
      segmentId: "01K0000000062",
      transcriptionSessionId: "01K0000000060",
      speakerLabel: "B",
      sequence: 2,
      text: "문구 문제라기보다 다음에 뭘 해야 하는지가 안 보입니다.",
      startedAtMs: 40000,
      endedAtMs: 43800,
    },
    {
      segmentId: "01K0000000063",
      transcriptionSessionId: "01K0000000060",
      speakerLabel: "A",
      sequence: 3,
      text: "그럼 첫 화면에 회의 만들기를 눈에 띄게 두죠.",
      startedAtMs: 92000,
      endedAtMs: 95500,
    },
    {
      segmentId: "01K0000000064",
      transcriptionSessionId: "01K0000000060",
      sequence: 4,
      text: "재방문 사용자는 같은 구간에서 막히지 않았습니다.",
      startedAtMs: 145000,
      endedAtMs: 148700,
      speakerLabel: null,
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
      // UI 만료 판정은 실제 시계라 데모용 PENDING은 항상 미래여야 한다 (고정일이면 썩는다)
      expiresAt: daysAgoIso(-1),
    },
    // 미가입자 초대 — 이름이 없는(null) 표본. 계약의 nullable 양쪽을 목이 보여줘야 한다
    {
      workspaceId: "01K0000000006",
      invitationId: "01K0000000025",
      inviteeName: null,
      inviteeEmail: "stranger@heymoa.dev",
      inviteeImage: null,
      inviterName: user.name,
      role: "MEMBER",
      status: "PENDING",
      createdAt: "2026-07-11T02:00:00Z",
      expiresAt: daysAgoIso(-1, 1),
    },
    // 만료 지난 PENDING 표본 — 토큰 수락의 INVITATION_EXPIRED 경로(/invite)와 멤버 탭의
    // 만료 배지를 dev에서 밟을 수 있어야 한다. 유저가 ADMIN인 워크스페이스에 둔다.
    {
      workspaceId: "01K0000000006",
      invitationId: "01K0000000026",
      inviteeName: user.name,
      inviteeEmail: user.email,
      inviteeImage: user.image,
      inviterName: "한지원",
      role: "MEMBER",
      status: "PENDING",
      createdAt: "2026-07-09T00:00:00Z",
      expiresAt: "2026-07-10T00:00:00Z",
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
        expiresAt: invitations[0].expiresAt,
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
        expiresAt: "2026-07-11T00:00:00Z",
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
    // 화자 분리를 시드한다. 목에 이걸 밀어줄 주체가 없어서(APP-419·420이 서버 몫)
    // 없으면 **화자 이름이 붙은 회의록을 목에서 한 번도 볼 수 없다.**
    //
    // 연결된 화자와 안 연결된 화자를 **둘 다** 심는다 — 한쪽만 심으면 `화자 A` 분기가
    // 목에서 안 그려지고 실서버에서 처음 실행된다.
    //
    // 이름을 손으로 박지 않는다. 참여자 시드가 바뀌면 조용히 어긋나고, 실제로 한 번
    // 어긋났다 — 없는 사람 이름이 화자에 붙어 있었다.
    diarizations: seededDiarizations(notes),
    // 사고 공백. 끝난 것과 진행 중인 것, 이유가 있는 것과 없는 것을 함께 심는다.
    extraGaps: new Map<string, TranscriptResponseDataGapsItem[]>([
      [
        "01K0000000020",
        [
          {
            gapId: "c-01K0000000020-604000",
            kind: "CAPTURE",
            startedAtMs: 604_000,
            endedAtMs: 620_000,
            startedAt: "2026-07-13T00:10:04Z",
            endedAt: "2026-07-13T00:10:20Z",
          },
          {
            // 아직 안 끝난 공백. 화면이 `02:20 – 진행 중`으로 열어 두고 회복하면 닫는다.
            //
            // **UPLOAD 로 두면 안 된다.** 조각 번호에 구멍이 났다는 것은 구멍 **다음** 번호가
            // 도착해야 알 수 있어서 — 13 이 안 온 것은 14 가 와야 안다 — UPLOAD 공백은
            // 발견되는 순간 이미 닫혀 있다. 열려 있을 수 있는 것은 CAPTURE 뿐이다.
            gapId: "c-01K0000000020-140000",
            kind: "CAPTURE",
            startedAtMs: 140_000,
            endedAtMs: 144_000,
            startedAt: "2026-07-13T00:02:20Z",
            endedAt: null,
          },
        ],
      ],
    ]),
    members,
    invitations,
    notifications,
    // 완료된 분석을 하나 시드한다. 실제로는 heymoa-ai의 callback이 채우는데 목에는 그걸
    // 밀어줄 주체가 없어서, 이게 없으면 **요약 화면(개요·액션 아이템·결정)을 목에서
    // 한 번도 볼 수 없다.** 종료된 노트 하나에만 붙여 빈 상태·분석 중 화면도 그대로 남긴다.
    //
    // 근거가 **있는 항목과 없는 항목을 둘 다** 심는다 — 계약상 근거 0개가 정상이고(칩 없음),
    // 한쪽만 심으면 그 분기가 목에서 한 번도 안 그려진다.
    analyses: [
      {
        analysisId: "01K0000000050",
        noteId: "01K0000000020",
        status: "SUCCEEDED",
        sections: [
          {
            kind: "OVERVIEW",
            items: [
              {
                itemId: "01K0000000070",
                content: "가입 후 첫 회의 생성까지의 이탈이 가장 큽니다.",
                evidence: [
                  {
                    segmentId: "01K0000000061",
                    text: "가입 후 첫 회의를 만들기까지 이탈이 가장 큽니다.",
                    startedAtMs: 12000,
                  },
                ],
              },
              {
                itemId: "01K0000000071",
                content:
                  "원인은 문구가 아니라 다음 행동이 보이지 않는 것으로 좁혀졌습니다.",
                evidence: [
                  {
                    segmentId: "01K0000000062",
                    text: "문구 문제라기보다 다음에 뭘 해야 하는지가 안 보입니다.",
                    startedAtMs: 40000,
                  },
                  {
                    segmentId: "01K0000000064",
                    text: "재방문 사용자는 같은 구간에서 막히지 않았습니다.",
                    startedAtMs: 145000,
                  },
                ],
              },
            ],
          },
          {
            kind: "ACTION_ITEM",
            items: [
              {
                itemId: "01K0000000072",
                content:
                  "첫 화면에 회의 만들기 유도를 붙입니다 (김민수, 이번 주)",
                evidence: [
                  {
                    segmentId: "01K0000000063",
                    text: "그럼 첫 화면에 회의 만들기를 눈에 띄게 두죠.",
                    startedAtMs: 92000,
                  },
                ],
              },
              // 근거를 못 찾은 항목. 버리지 않고 칩 없이 남긴다(설계 D2).
              {
                itemId: "01K0000000073",
                content:
                  "다음 주 사용자 테스트 참가자 5명을 모집합니다 (한지원)",
                evidence: [],
              },
            ],
          },
          {
            kind: "DECISION",
            items: [
              {
                itemId: "01K0000000074",
                content:
                  "온보딩 문구 개편보다 첫 행동 유도를 먼저 하기로 했습니다.",
                evidence: [
                  {
                    segmentId: "01K0000000063",
                    text: "그럼 첫 화면에 회의 만들기를 눈에 띄게 두죠.",
                    startedAtMs: 92000,
                  },
                ],
              },
            ],
          },
        ],
        errorCode: null,
        errorMessage: null,
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

/**
 * 만료 지난 PENDING은 EXPIRED로 밀고 409를 낸다 — 서버(APP-184)와 같은 전이.
 * 시계는 실제 시계다 — UI 만료 판정과 같은 시계여야 화면과 목 API가 갈라지지 않는다.
 * (시드의 만료 시각도 전부 실제-상대라 세월 따라 썩지 않는다.)
 */
function expireIfNeeded(invitation: MockInvitation) {
  if (invitation.status !== "PENDING") return;
  if (Date.parse(invitation.expiresAt) > Date.now()) return;
  invitation.status = "EXPIRED";
  syncInvitationNotification(invitation);
  fail("INVITATION_EXPIRED");
}

/** PENDING 초대를 확정 상태로 옮기고 알림을 맞춘다. 수락만 멤버를 늘린다. */
function resolveInvitation(
  invitationId: string,
  status: NotificationListResponseDataNotificationsItemInvitationStatus
): WorkspaceInvitationActionResponseData {
  const invitation = findInvitation(invitationId);
  expireIfNeeded(invitation);
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

/**
 * 멤버 역할 변경·추방은 ADMIN만 부를 수 있다. 나가기는 멤버 누구나 가능해서 이 가드를 쓰지 않는다.
 *
 * **멤버가 아닌 것과 ADMIN이 아닌 것은 다른 응답이다.** 서버 `WorkspaceAccessHandler`가
 * `requireMember`(없으면 404 WORKSPACE_NOT_FOUND) 다음에 역할을 보고 403을 내는 구조라,
 * 워크스페이스가 아예 없는 것도 남의 워크스페이스인 것도 똑같이 404로 존재를 숨긴다.
 * 둘을 `caller?.role !== "ADMIN"` 하나로 합치면 비멤버에게 그 워크스페이스가 있다고 알려준다.
 */
function requireWorkspaceAdmin(workspaceId: string) {
  const caller = state.members.find(
    (m) => m.workspaceId === workspaceId && m.userId === state.user.userId
  );
  if (!caller) fail("WORKSPACE_NOT_FOUND");
  if (caller.role !== "ADMIN") fail("WORKSPACE_ACCESS_DENIED");
}

/**
 * 계약에 없는 역할은 400이다. 핸들러가 요청 본문에 붙이는 타입 단언은 런타임에 아무것도
 * 막지 않으므로 여기서 검사한다 — 목이 계약보다 관대하면 웹에서는 통과하는 값이
 * 실제 서버에서 거부된다.
 */
function assertRole(value: string): MockMember["role"] {
  if (value === "ADMIN" || value === "MEMBER") return value;
  return fail("BAD_REQUEST");
}

/**
 * 현재 유저의 멤버십은 목에 두 벌 있다 — 멤버 명단(`state.members`)과 워크스페이스 응답
 * (`state.workspaces`, `listWorkspaces`·`getWorkspace`의 원본). 초대 수락이 합류를 두 곳에
 * 모두 반영하듯 본인 역할 변경도 둘을 같이 고쳐야 `getWorkspace().role`이 명단과 갈라지지 않는다.
 */
function syncOwnWorkspaceRole(
  workspaceId: string,
  userId: string,
  role: MockMember["role"]
) {
  if (userId !== state.user.userId) return;
  const workspace = state.workspaces.find((w) => w.workspaceId === workspaceId);
  if (workspace) workspace.role = role;
}

function assertProject(projectId: string) {
  return (
    state.projects.find((project) => project.projectId === projectId) ??
    fail("PROJECT_NOT_FOUND")
  );
}

/**
 * 그 워크스페이스 **안의** 프로젝트를 찾는다.
 *
 * **어긋난 조합은 403이 아니라 404다.** 서버가 `findByWorkspaceIdAndProjectId(...)` 한 번으로
 * 찾고 없으면 `ProjectNotFoundException`을 던진다(조회·수정·삭제 셋 다). 목이 `FORBIDDEN`을
 * 주면 "이 워크스페이스의 노트가 아니다"를 코드로 가리는 화면이 목에서만 다르게 동작한다.
 */
function assertProjectIn(workspaceId: string, projectId: string) {
  const project = state.projects.find(
    (candidate) =>
      candidate.projectId === projectId && candidate.workspaceId === workspaceId
  );
  return project ?? fail("PROJECT_NOT_FOUND");
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
      // 계약: 완료 전에는 섹션이 빈 배열이다(null이 아니다).
      sections: [],
      errorCode: null,
      errorMessage: null,
    };
    state.analyses.push(analysis);
    return copy(analysis);
  },

  /**
   * 대기 중인 분석을 완료로 넘긴다. 실제 서버는 heymoa-ai의 callback으로 채워지지만
   * 목에는 그걸 밀어줄 주체가 없어 폴링 데모와 테스트가 이 함수를 직접 부른다.
   *
   * 근거는 **그 노트에 실제로 있는 세그먼트**에서 뽑는다. 고정 id를 박으면 다른 노트를
   * 종료했을 때 인용을 눌러도 갈 곳이 없어, 목이 되는 척만 하게 된다.
   */
  advanceAnalysis(noteId: string): AnalysisResultResponseData | null {
    const analysis = latestAnalysis(noteId);
    if (!analysis || analysis.status !== "PENDING") return null;
    const segments = this.listSegments(noteId);
    const evidenceAt = (...indexes: number[]) =>
      indexes
        .map((index) => segments[index])
        .filter((segment) => segment !== undefined)
        .map(({ segmentId, text, startedAtMs }) => ({
          segmentId,
          text,
          startedAtMs,
        }));
    analysis.status = "SUCCEEDED";
    analysis.sections = [
      {
        kind: "OVERVIEW",
        items: [
          {
            itemId: nextId(),
            content: "출시 일정과 담당을 정했습니다.",
            evidence: evidenceAt(0, 1),
          },
        ],
      },
      {
        kind: "ACTION_ITEM",
        items: [
          {
            itemId: nextId(),
            content: "배포 체크리스트를 작성합니다 (김민수)",
            evidence: evidenceAt(2),
          },
          // 근거를 못 찾은 항목도 남는다(설계 D2) — 칩 없는 분기의 표본이다.
          {
            itemId: nextId(),
            content: "QA 일정을 공유합니다 (한지원)",
            evidence: [],
          },
        ],
      },
      {
        kind: "DECISION",
        items: [
          {
            itemId: nextId(),
            content:
              "일정 리스크는 QA 인력에 몰려 있다고 보고 우선 배치합니다.",
            evidence: evidenceAt(1),
          },
        ],
      },
    ];
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

  /**
   * 역할 변경은 ADMIN만 할 수 있다. 마지막 ADMIN을 MEMBER로 내리는 것은 막는다 —
   * 계약(openapi3.yml)의 409 LAST_WORKSPACE_ADMIN. 같은 역할로 바꾸면 그냥 통과한다(no-op 성공).
   */
  changeMemberRole(workspaceId: string, userId: string, requestedRole: string) {
    requireWorkspaceAdmin(workspaceId);
    const role = assertRole(requestedRole);
    const member = state.members.find(
      (m) => m.workspaceId === workspaceId && m.userId === userId
    );
    if (!member) fail("WORKSPACE_MEMBER_NOT_FOUND");
    const admins = state.members.filter(
      (m) => m.workspaceId === workspaceId && m.role === "ADMIN"
    );
    if (role !== "ADMIN" && member.role === "ADMIN" && admins.length <= 1) {
      fail("LAST_WORKSPACE_ADMIN");
    }
    member.role = role;
    syncOwnWorkspaceRole(workspaceId, userId, role);
  },

  /**
   * 추방은 ADMIN만, 자기 자신은 대상이 될 수 없다(계약 400 BAD_REQUEST). 이 규칙 때문에
   * 호출자가 항상 ADMIN이면서 대상과 다른 사람이라, 대상이 마지막 ADMIN인 경우는 수학적으로
   * 나올 수 없다(호출자 자신도 ADMIN으로 남으므로) — 계약도 이 엔드포인트엔 409가 없다.
   */
  removeMember(workspaceId: string, userId: string) {
    requireWorkspaceAdmin(workspaceId);
    if (userId === state.user.userId) fail("BAD_REQUEST");
    const index = state.members.findIndex(
      (m) => m.workspaceId === workspaceId && m.userId === userId
    );
    if (index < 0) fail("WORKSPACE_MEMBER_NOT_FOUND");
    state.members.splice(index, 1);
  },

  /**
   * 나가기는 멤버 누구나 할 수 있고(ADMIN 가드 없음), 마지막 ADMIN은 나갈 수 없다(409).
   * 비멤버의 404 코드는 추방과 달리 WORKSPACE_MEMBER_NOT_FOUND가 아니라 WORKSPACE_NOT_FOUND다
   * (계약 — 본인 접근 관점에서는 멤버가 아닌 워크스페이스가 곧 "없는" 워크스페이스다).
   */
  leaveWorkspace(workspaceId: string) {
    const index = state.members.findIndex(
      (m) => m.workspaceId === workspaceId && m.userId === state.user.userId
    );
    if (index < 0) fail("WORKSPACE_NOT_FOUND");
    const member = state.members[index];
    const admins = state.members.filter(
      (m) => m.workspaceId === workspaceId && m.role === "ADMIN"
    );
    if (member.role === "ADMIN" && admins.length <= 1) {
      fail("LAST_WORKSPACE_ADMIN");
    }
    state.members.splice(index, 1);

    // 멤버십이 사라지면 그 워크스페이스는 목록에서도 빠진다 — 초대 수락(합류)의 역이다.
    const workspaceIndex = state.workspaces.findIndex(
      (w) => w.workspaceId === workspaceId
    );
    if (workspaceIndex < 0) return;
    state.workspaces.splice(workspaceIndex, 1);
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
    // 서버(APP-183)와 동일한 정규화 — 미가입자 초대가 정상 경로라 404는 없다
    const email = input.email.trim().toLowerCase();
    const alreadyMember = state.members.some(
      (member) => member.workspaceId === workspaceId && member.email === email
    );
    if (alreadyMember) fail("ALREADY_WORKSPACE_MEMBER");
    const alreadyInvited = state.invitations.some(
      (invitation) =>
        invitation.workspaceId === workspaceId &&
        invitation.inviteeEmail === email &&
        invitation.status === "PENDING"
    );
    if (alreadyInvited) fail("DUPLICATE_PENDING_INVITATION");

    // 생성·만료(생성+1일, 계약)는 같은 시각에서 계산한다. 만료 판정과 UI가 실제 시계를
    // 쓰므로 여기도 실제 시계다 — 시계가 갈리면 방금 만든 초대가 만료로 보인다.
    const createdAtMs = Date.now();
    const invitation: MockInvitation = {
      workspaceId,
      invitationId: nextId(),
      // 목엔 가입자 레지스트리가 없다 — 계약의 미가입자 초대(inviteeName null)로 취급한다
      inviteeName: null,
      inviteeEmail: email,
      inviteeImage: null,
      inviterName: state.user.name,
      role: input.role as MockInvitation["role"],
      status: "PENDING",
      createdAt: new Date(createdAtMs).toISOString(),
      expiresAt: new Date(createdAtMs + 86_400_000).toISOString(),
    };
    state.invitations.push(invitation);
    return copy({
      invitationId: invitation.invitationId,
      workspaceId,
      role: invitation.role,
      status: invitation.status,
    });
  },

  /**
   * 토큰 수락 — 목의 토큰은 invitationId다. 실서버 계약대로 만료(409)와 이메일
   * 일치(403)를 먼저 본다. 인앱 수락(`acceptInvitation`)은 항상 본인 초대라 안 본다.
   */
  acceptInvitationByToken(
    token: string
  ): WorkspaceInvitationActionResponseData {
    const invitation = findInvitation(token);
    // 서버(AcceptWorkspaceInvitationByTokenService)와 같은 순서 — 만료 → 상태 → 이메일 → 멤버
    expireIfNeeded(invitation);
    if (invitation.status !== "PENDING") fail("INVITATION_NOT_PENDING");
    if (invitation.inviteeEmail !== state.user.email) {
      fail("INVITATION_EMAIL_MISMATCH");
    }
    // 계약의 409. 지금은 createInvitation이 이미 멤버를 막아 목에서 도달할 수 없지만,
    // 목에 멤버 변동 기능이 생겨도 실서버와 갈라지지 않게 검사를 둔다.
    if (
      state.members.some(
        (member) =>
          member.workspaceId === invitation.workspaceId &&
          member.email === state.user.email
      )
    ) {
      fail("ALREADY_WORKSPACE_MEMBER");
    }
    return mockDb.acceptInvitation(token);
  },

  acceptInvitation(
    invitationId: string
  ): WorkspaceInvitationActionResponseData {
    const invitation = findInvitation(invitationId);
    const resolved = resolveInvitation(invitationId, "ACCEPTED");
    const isSelf = invitation.inviteeEmail === state.user.email;

    // 본인이 받은 초대를 수락하면 그 워크스페이스가 목록에 나타나야 한다 — 그게 합류다.
    if (
      isSelf &&
      !state.workspaces.some((w) => w.workspaceId === invitation.workspaceId)
    ) {
      state.workspaces.push({
        workspaceId: invitation.workspaceId,
        name: INVITED_WORKSPACE.name,
        description: null,
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
        name: invitation.inviteeName ?? invitation.inviteeEmail,
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

  // 서버는 **합류한 순서**로 준다(workspaceMember.createdAt). 목은 삽입 순서가 곧 합류 순서라
  // 그대로 넘긴다 — 이름순으로 다시 정렬하면 목만 서버와 다른 순서를 보여 준다.
  listWorkspaces(): WorkspaceListResponseDataWorkspacesItem[] {
    return copy(state.workspaces);
  },

  createWorkspace(input: CreateWorkspaceRequest): WorkspaceResponseData {
    const name = input.name.trim();
    if (!name) fail("BAD_REQUEST");
    const workspace: WorkspaceResponseData = {
      workspaceId: nextId(),
      name,
      description: input.description ?? null,
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
    return copy(assertProjectIn(workspaceId, projectId));
  },

  updateProject(
    workspaceId: string,
    projectId: string,
    input: ProjectRequest
  ): ProjectResponseData {
    assertWorkspace(workspaceId);
    const project = assertProjectIn(workspaceId, projectId);
    const name = input.name.trim();
    if (!name) fail("BAD_REQUEST");
    project.name = name;
    project.description = input.description ?? null;
    project.updatedAt = nextTimestamp();
    return copy(project);
  },

  deleteProject(workspaceId: string, projectId: string) {
    assertWorkspace(workspaceId);
    assertProjectIn(workspaceId, projectId);
    if (state.notes.some((note) => note.projectId === projectId)) {
      fail("PROJECT_HAS_NOTES");
    }
    state.projects = state.projects.filter((p) => p.projectId !== projectId);
  },

  listNotes(projectId: string): NoteListResponseDataNotesItem[] {
    assertProject(projectId);
    state.notes
      .filter((note) => note.projectId === projectId)
      .forEach((note) => expireReadySessions(note.noteId));
    const notes = state.notes
      .filter((note) => note.projectId === projectId)
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) ||
          b.noteId.localeCompare(a.noteId)
      )
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

  createNote(projectId: string, input: Partial<NoteRequest>): NoteResponseData {
    assertProject(projectId);
    const createdAt = nextTimestamp();
    const note: NoteResponseData = {
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
      // 서버(CreateNoteService)가 만든 사람을 참여자로 넣는다.
      participants: [
        {
          userId: state.user.userId,
          name: state.user.name,
          email: state.user.email,
          image: state.user.image,
        },
      ],
    };
    state.notes.push(note);
    return copy(note);
  },

  /**
   * 참여자를 통째로 교체한다(PUT). 부분 추가·삭제가 아니라 요청한 목록이 곧 최종 상태다.
   * 워크스페이스 멤버가 아닌 유저가 섞이면 아무것도 바꾸지 않고 400을 낸다.
   */
  replaceNoteParticipants(noteId: string, userIds: string[]) {
    const note = findNote(noteId);
    const project = state.projects.find(
      (row) => row.projectId === note.projectId
    );
    const workspaceMembers = state.members.filter(
      (member) => member.workspaceId === project?.workspaceId
    );
    const unique = [...new Set(userIds)];
    if (
      unique.some(
        (userId) => !workspaceMembers.some((m) => m.userId === userId)
      )
    ) {
      fail("NOT_WORKSPACE_MEMBER");
    }
    note.participants = workspaceMembers
      .filter((member) => unique.includes(member.userId))
      .map(({ userId, name, email, image }) => ({ userId, name, email, image }))
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId)
      );
    return copy({ participants: note.participants });
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
    });
  },

  updateNote(noteId: string, input: NoteRequest): NoteResponseData {
    const note = findNote(noteId);
    const title = input.title.trim();
    if (!title) fail("BAD_REQUEST");
    note.title = title;
    note.updatedAt = nextTimestamp();
    return this.getNote(noteId);
  },

  /**
   * 노트를 물리 삭제한다. 서버는 FK CASCADE가 자식을 지우므로(APP-335 V18) 목도 같은 것을
   * 같이 지운다 — 세션·전사 세그먼트·분석·챗과 그 메시지. 안 지우면 "지웠는데 요약이 남는"
   * 상태가 목에서만 만들어져 화면 검증이 거짓이 된다.
   */
  deleteNote(noteId: string) {
    const note = findNote(noteId);
    // 기록 중 삭제는 전사 세션과 경합한다. 계약이 409로 막는 자리다.
    if (note.meetingStatus === "IN_PROGRESS") fail("MEETING_IN_PROGRESS");
    const sessionIds = new Set(
      state.sessions
        .filter((row) => row.noteId === noteId)
        .map((row) => row.sessionId)
    );
    const chatIds = new Set(
      state.agentChats
        .filter((row) => row.noteId === noteId)
        .map((row) => row.chatId)
    );
    state.notes = state.notes.filter((row) => row.noteId !== noteId);
    state.sessions = state.sessions.filter((row) => row.noteId !== noteId);
    state.segments = state.segments.filter(
      (row) => !sessionIds.has(row.transcriptionSessionId)
    );
    state.analyses = state.analyses.filter((row) => row.noteId !== noteId);
    state.agentChats = state.agentChats.filter((row) => row.noteId !== noteId);
    state.agentChatMessages = state.agentChatMessages.filter(
      (row) => !chatIds.has(row.chatId)
    );
    state.sharedChatMessages = state.sharedChatMessages.filter(
      (row) => row.noteId !== noteId
    );
    state.sharedChatLocks.delete(noteId);
    state.sharedChatForeignLocks.delete(noteId);
    state.sharedChatPendingApprovals.delete(noteId);
  },

  createSession(noteId: string): StartTranscriptionSessionResponseData {
    const note = findNote(noteId);
    // 조회와 같은 규칙 — 권한 승인과 이 POST 사이에 추방됐을 수 있다. 서버는 여기서도
    // 멤버십을 보고 404 `WORKSPACE_NOT_FOUND`를 준다(`NoteAccessHandler.requireProjectMember`).
    assertWorkspace(assertProject(note.projectId).workspaceId);
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
      email: state.user.email,
      image: state.user.image,
    };
    note.meetingStatus = "IN_PROGRESS";
    state.sessions.push(session);
    return copy(session) as unknown as StartTranscriptionSessionResponseData;
  },

  getSession(sessionId: string): TranscriptionSessionResponseData {
    const session = findSession(sessionId);
    // **세션 조회도 멤버십을 본다.** 서버는 노트 → 프로젝트 → 워크스페이스 멤버십을 확인하고
    // 비멤버에게는 존재를 숨기려고 404 `WORKSPACE_NOT_FOUND`를 준다
    // (`NoteAccessHandler.requireProjectMember` → `WorkspaceNotFoundException`).
    //
    // 이게 없으면 목에서는 추방 뒤에도 200이 와서, 녹음을 끊는 경로(`RecordingProvider`)가
    // 화면에서는 되는데 목으로는 재현이 안 된다 — 목이 계약과 갈리는 그 자리다.
    assertWorkspace(
      assertProject(findNote(session.noteId).projectId).workspaceId
    );
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

  /**
   * 화자에 참석자를 연결하거나 「참석자 아님」으로 확정한다.
   *
   * **한 사람은 한 화자에만 붙는다** — 다른 화자에 이미 붙어 있으면 그쪽에서 떨어진다.
   * 그래서 응답이 목록 전체다.
   *
   * `userId` 를 받아 `note_participants` 행을 찾아 그 `id` 를 저장한다. 연결의 대상은
   * 계정이 아니라 이 회의의 참여 기록이다 — 나중에 계정 없는 외부 참석자를 열 때
   * 데이터 마이그레이션이 안 생긴다.
   */
  assignSpeaker(
    noteId: string,
    label: string,
    userId: string | null,
  ): TranscriptResponseDataDiarization["speakers"] {
    const note = findNote(noteId);
    const diarization = state.diarizations.get(noteId);
    if (!diarization || diarization.status !== "MAPPED") {
      fail("DIARIZATION_NOT_MAPPED");
    }
    const speaker = diarization.speakers.find((row) => row.label === label);
    if (!speaker) {
      fail("SPEAKER_LABEL_NOT_FOUND");
    }

    // 부른 사람이 참석자가 아닌 것(403)과 연결 대상이 참석자가 아닌 것(422)은
    // 사용자가 할 일이 다르므로 가른다.
    if (!note.participants.some((row) => row.userId === state.user.userId)) {
      fail("NOT_NOTE_PARTICIPANT");
    }
    const participant = userId
      ? note.participants.find((row) => row.userId === userId)
      : null;
    if (userId && !participant) {
      fail("PARTICIPANT_NOT_IN_NOTE");
    }

    const speakers = diarization.speakers.map((row) => {
      if (row.label === label) {
        return {
          ...row,
          assignedUserId: participant?.userId ?? null,
          assignedName: participant?.name ?? null,
          confirmed: true,
        };
      }
      // 같은 사람이 다른 화자에 붙어 있었다면 떨어진다
      if (participant && row.assignedUserId === participant.userId) {
        return {
          ...row,
          assignedUserId: null,
          assignedName: null,
          confirmed: false,
        };
      }
      return row;
    });
    state.diarizations.set(noteId, { ...diarization, speakers });
    return copy(speakers);
  },

  /**
   * 화면이 읽는 유일한 조회. **응답 하나에 다 담는다** — 발화·공백·화자·봉인을 따로
   * 조회하면 네 응답의 시각이 서로 어긋난 순간이 그려진다.
   */
  getTranscript(noteId: string): TranscriptResponseData {
    const note = findNote(noteId);
    const sessions = state.sessions
      .filter((session) => session.noteId === noteId)
      .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
    const segments = this.listSegments(noteId);
    const offsets = noteOffsetsMs(sessions);

    const last = sessions.at(-1);
    const durationMs =
      last && last.startedAt && last.endedAt
        ? (offsets.get(last.sessionId) ?? 0) +
          Math.max(0, Date.parse(last.endedAt) - Date.parse(last.startedAt))
        : (segments.at(-1)?.endedAtMs ?? 0);

    // 세션과 세션 사이가 PAUSE 다. 회의 축에서 제외이므로 두 좌표가 같은 **점**이고,
    // 길이는 벽시계에서만 나온다.
    const gaps: TranscriptResponseDataGapsItem[] = [];
    sessions.forEach((session, index) => {
      const previous = sessions[index - 1];
      if (!previous?.endedAt || !session.startedAt) return;
      const at = offsets.get(session.sessionId) ?? 0;
      gaps.push({
        gapId: `p-${previous.sessionId}-${at}`,
        kind: "PAUSE",
        startedAtMs: at,
        endedAtMs: at,
        startedAt: previous.endedAt,
        endedAt: session.startedAt,
      });
    });

    return {
      recording: {
        startedAt:
          sessions[0]?.startedAt ?? note.meetingStartedAt ?? note.createdAt,
        // 봉인은 회의가 끝나야 찍힌다. 진행 중이면 OPEN 이고 그건 오류가 아니다.
        seal: note.meetingStatus === "ENDED" ? "COMPLETE" : "OPEN",
        durationMs,
        // 옛 노트는 전사만 있고 소리가 없다 — 「COMPLETE 인데 조립은 못 한다」가 정상이다.
        audioRetained: sessions.length > 0,
      },
      diarization: state.diarizations.get(noteId) ?? {
        status: "NOT_REQUESTED",
        speakers: [],
      },
      segments,
      gaps: [...gaps, ...(state.extraGaps.get(noteId) ?? [])].sort(
        (a, b) => a.startedAtMs - b.startedAtMs
      ),
    };
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
    // 서버가 하는 일을 목이 그대로 한다 — 세션 좌표를 회의 축으로 옮기고 노트 내
    // 순서로 다시 번호를 매긴다. 이 계산이 web 에 남아 있는 동안 다세션 노트의 시각이
    // 세션마다 00:00 으로 되돌아갔다.
    const offsets = noteOffsetsMs(noteSessions);
    const segments = state.segments
      .filter((segment) => sessionOrder.has(segment.transcriptionSessionId))
      .sort(
        (a, b) =>
          (sessionOrder.get(a.transcriptionSessionId) ?? 0) -
            (sessionOrder.get(b.transcriptionSessionId) ?? 0) ||
          a.sequence - b.sequence
      )
      .map((segment, index) => {
        const offset = offsets.get(segment.transcriptionSessionId) ?? 0;
        return {
          segmentId: segment.segmentId,
          sequence: index + 1,
          text: segment.text,
          startedAtMs: segment.startedAtMs + offset,
          endedAtMs: segment.endedAtMs + offset,
          speakerLabel: segment.speakerLabel ?? null,
        } satisfies TranscriptResponseDataSegmentsItem;
      });
    return copy(segments);
  },

  addSegment(sessionId: string, input: AddSegmentInput): StoredSegment {
    findSession(sessionId);
    const sequence =
      Math.max(
        0,
        ...state.segments
          .filter((segment) => segment.transcriptionSessionId === sessionId)
          .map((segment) => segment.sequence)
      ) + 1;
    const segment: StoredSegment = {
      segmentId: nextId(),
      transcriptionSessionId: sessionId,
      sequence,
      // 실시간으로 만들어지는 발화에는 화자가 없다. 회의가 끝난 뒤 PRO-32 가 채운다
      speakerLabel: null,
      ...input,
    };
    state.segments.push(segment);
    return copy(segment);
  },
};
