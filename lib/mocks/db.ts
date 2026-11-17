import { faker } from "@faker-js/faker";
import type {
  AgentDelegationsResponseDataDelegationsItem,
  AgentDelegationUsagesResponseData,
  AgentDelegationUsagesResponseDataUsagesItem,
  CreateWorkspaceRequest,
  RecordConsentRequest,
  WorkspaceAgentDelegationsResponseDataDelegationsItem,
  CurrentUserResponseData,
  NoteListResponseDataNotesItem,
  NoteRequest,
  NoteResponseData,
  ProjectRequest,
  ProjectResponseData,
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
  FeedbackResponseData,
  CreateFeedbackRequest,
  AnalysisResultResponseData,
  ToolConnectionsResponseDataIntegrationsItem,
  AgentChatResponseData,
  AgentChatMessagesResponseDataMessagesItem,
  WorkspaceResponseData,
  TranscriptResponseData,
  TranscriptResponseDataDiarization,
  TranscriptResponseDataGapsItem,
  TranscriptResponseDataTranscriptGapsItem,
} from "@/lib/api/generated/models";
import { scopeMarker, unwrapScopeMarkers } from "@/lib/chat/scope-marker";
import { getAppDateKey } from "@/lib/format/date";
import { createHelpDemoState, isHelpDemoEnabled } from "@/lib/mocks/help-demo";
import { failWith } from "@/lib/mocks/mock-envelope";
import {
  MOCK_ACCOUNT,
  MOCK_ACCOUNT_LANGUAGE_COOKIE,
  MOCK_USER,
} from "@/lib/mocks/mock-user";
import {
  MENTORING_GUEST_IDS,
  MENTORING_NOTE_ID,
  MENTORING_PARTICIPANT_IDS,
  MENTORING_SESSION_ID,
  mentoringDiarization,
  mentoringSegments,
} from "@/lib/mocks/fixtures/mentoring-note";

const ACTIVE_STATUSES = new Set<string>(["READY", "ACTIVE"]);

const TERMINAL_STATUSES = new Set<string>(["COMPLETED", "INTERRUPTED"]);

type AddSegmentInput = Pick<
  TranscriptResponseDataSegmentsItem,
  "text" | "startedAtMs" | "endedAtMs"
>;

type MockSession = Omit<TranscriptionSessionResponseData, "status"> & {
  status: string;
};

type StoredSegment = TranscriptResponseDataSegmentsItem & {
  transcriptionSessionId: string;
};

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

type MockMember = Omit<
  WorkspaceMemberListResponseDataMembersItem,
  "displayName" | "accountName"
> & {
  workspaceId: string;
  displayName?: string | null;
};

function myNameIn(workspaceId: string | undefined) {
  const me = state.members.find(
    (m) => m.workspaceId === workspaceId && m.userId === state.user.userId
  );
  return me ? memberView(me).name : state.user.name;
}

function memberView(member: MockMember) {
  const { displayName, ...rest } = omit(member, ["workspaceId"]);
  return {
    ...rest,
    name: displayName ?? member.name,
    displayName: displayName ?? null,
    accountName: member.name,
  };
}

type MockInvitation = WorkspaceInvitationListResponseDataInvitationsItem & {
  workspaceId: string;
  status: NotificationListResponseDataNotificationsItemInvitationStatus;
};

const INVITED_WORKSPACE = {
  workspaceId: "01K0000000030",
  name: "디자인 팀",
} as const;

const RESEARCH_WORKSPACE = {
  workspaceId: "01K0000000043",
  name: "리서치 랩",
} as const;

const EX_MEMBER_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#c7d3d8"/><circle cx="32" cy="25" r="11" fill="#6b7f88"/><path d="M8 64c0-13 11-21 24-21s24 8 24 21z" fill="#6b7f88"/></svg>'
  );

const SUPPORTED_PROVIDERS = ["LINEAR", "GITHUB"] as const;

type MockIntegration = ToolConnectionsResponseDataIntegrationsItem & {
  workspaceId: string;
};

export type ScopeRef = {
  kind: "NOTE" | "PROJECT";
  id: string;
  title: string | null;
  unavailable: boolean;
};

type MockAgentChat = AgentChatResponseData & { updatedAt: string };

const AGENT_CHAT_LIST_LIMIT = 50;

const DEFAULT_AGENT_CHAT_TITLE = "새 대화";

const seededTitleSource = (title: string) =>
  title === DEFAULT_AGENT_CHAT_TITLE
    ? ("DEFAULT" as const)
    : ("QUESTION" as const);

function aiTitleFor(question: string) {
  const core = question
    .replace(/\s+/g, " ")
    .replace(/[?？!.。]+$/u, "")
    .replace(
      /\s*(정리|요약|설명|찾아|알려|만들어|확인)?\s*(해\s*)?(줘|주세요|줄래|줄 수 있어)$/u,
      ""
    )
    .trim();
  const title = core.length > 24 ? `${core.slice(0, 24).trim()}…` : core;
  return title ? `${title} 정리` : "대화 정리";
}

const MAX_AGENT_CHAT_TITLE_LENGTH = 200;

type MockAgentChatMessage = AgentChatMessagesResponseDataMessagesItem & {
  chatId: string;
};

type MockWorkspaceGuest = {
  guestId: string;
  workspaceId: string;
  displayName: string;
  createdAt: string;
};

export type StoreState = {
  user: CurrentUserResponseData;
  workspaces: WorkspaceResponseData[];
  projects: ProjectResponseData[];
  notes: NoteResponseData[];
  sessions: MockSession[];
  segments: StoredSegment[];
  diarizations: Map<string, TranscriptResponseDataDiarization>;
  extraGaps: Map<string, TranscriptResponseDataGapsItem[]>;
  transcriptGaps: Map<string, TranscriptResponseDataTranscriptGapsItem[]>;
  members: MockMember[];
  workspaceGuests: MockWorkspaceGuest[];
  invitations: MockInvitation[];
  notifications: NotificationListResponseDataNotificationsItem[];
  feedbacks: FeedbackResponseData[];
  analyses: AnalysisResultResponseData[];
  integrations: MockIntegration[];
  agentChats: MockAgentChat[];
  agentChatMessages: MockAgentChatMessage[];
  agentDelegations: MockAgentDelegation[];
  agentDelegationUsages: MockAgentDelegationUsage[];
  agentOAuthConsents: Record<string, MockAgentOAuthConsent>;
};

type MockAgentDelegation = AgentDelegationsResponseDataDelegationsItem & {
  userId: string;
};

type MockAgentOAuthConsent = {
  clientName: string;
  redirectUri: string;
  scopes: string[];
};

type MockAgentDelegationUsage = AgentDelegationUsagesResponseDataUsagesItem & {
  delegationId: string;
};

const AGENT_USAGE_PAGE_SIZE = 20;

let state: StoreState;
let idCounter = 100;

function omit<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[]
): Omit<T, K> {
  const next = { ...value };
  for (const key of keys) delete next[key];
  return next;
}

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
            assignedParticipantId: first.participantId,
            assignedName: first.name,
            confirmed: true,
          },
          {
            label: "B",
            speakingMs: 610_000,
            segmentCount: 1,
            representativeSegmentId: "01K0000000062",
            assignedParticipantId: null,
            assignedName: null,
            confirmed: false,
          },
        ],
      },
    ],
  ]);
}

function seedSegmentOverride(
  notes: NoteResponseData[],
  segments: StoredSegment[]
) {
  const note = notes.find((row) => row.noteId === "01K0000000020");
  const other = note?.participants[1];
  const segment = segments.find((row) => row.segmentId === "01K0000000063");
  if (!other || !segment) return;
  segment.assignedParticipantId = other.participantId;
}

function sortParticipants(
  participants: NoteResponseData["participants"]
): NoteResponseData["participants"] {
  return [...participants].sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.participantId.localeCompare(b.participantId)
  );
}

function detachSpeakers(noteId: string, participantIds: string[]) {
  if (participantIds.length === 0) return;
  for (const segment of segmentsOfNote(noteId)) {
    if (
      segment.assignedParticipantId &&
      participantIds.includes(segment.assignedParticipantId)
    ) {
      segment.assignedParticipantId = null;
    }
  }
  const diarization = state.diarizations.get(noteId);
  if (!diarization) return;
  state.diarizations.set(noteId, {
    ...diarization,
    speakers: diarization.speakers.map((speaker) =>
      speaker.assignedParticipantId &&
      participantIds.includes(speaker.assignedParticipantId)
        ? {
            ...speaker,
            assignedParticipantId: null,
            assignedName: null,
            confirmed: false,
          }
        : speaker
    ),
  });
}

type GuestLinkEntry = {
  noteId: string;
  title: string;
  createdAt: string;
  guestParticipantId: string;
  guestHasSpeaker: boolean;
  accountParticipantId: string | null;
};

function hasSpeaker(noteId: string, participantId: string) {
  const onLabel = state.diarizations
    .get(noteId)
    ?.speakers.some((row) => row.assignedParticipantId === participantId);
  const onSegment = state.segments.some(
    (segment) => segment.assignedParticipantId === participantId
  );
  return Boolean(onLabel) || onSegment;
}

function planGuestLink(
  workspaceId: string,
  guestId: string,
  targetUserId: string
) {
  requireWorkspaceAdmin(workspaceId);
  const guest = state.workspaceGuests.find(
    (row) => row.guestId === guestId && row.workspaceId === workspaceId
  );
  if (!guest) fail("WORKSPACE_GUEST_NOT_FOUND");
  const isMember = state.members.some(
    (row) => row.workspaceId === workspaceId && row.userId === targetUserId
  );
  if (!isMember) fail("WORKSPACE_MEMBER_NOT_FOUND");

  const entries: GuestLinkEntry[] = [];
  for (const note of state.notes) {
    const guestRow = note.participants.find((row) => row.guestId === guestId);
    if (!guestRow) continue;
    const accountRow = note.participants.find(
      (row) => row.userId === targetUserId
    );
    entries.push({
      noteId: note.noteId,
      title: note.title,
      createdAt: note.createdAt,
      guestParticipantId: guestRow.participantId,
      guestHasSpeaker: hasSpeaker(note.noteId, guestRow.participantId),
      accountParticipantId: accountRow?.participantId ?? null,
    });
  }
  return { changed: entries };
}

const MAX_LISTED_NOTES = 100;

function guestLinkResultOf(plan: { changed: GuestLinkEntry[] }) {
  return {
    changedNoteCount: plan.changed.length,
    changedNotes: [...plan.changed]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_LISTED_NOTES)
      .map((entry) => ({ noteId: entry.noteId, title: entry.title })),
  };
}

function renameSpeaker(
  noteId: string,
  participantId: string,
  target: { userId: string; name: string }
) {
  const diarization = state.diarizations.get(noteId);
  if (!diarization) return;
  state.diarizations.set(noteId, {
    ...diarization,
    speakers: diarization.speakers.map((row) =>
      row.assignedParticipantId === participantId
        ? { ...row, assignedName: target.name }
        : row
    ),
  });
}

function segmentsOfNote(noteId: string) {
  const sessionIds = new Set(
    state.sessions
      .filter((session) => session.noteId === noteId)
      .map((session) => session.sessionId)
  );
  return state.segments.filter((segment) =>
    sessionIds.has(segment.transcriptionSessionId)
  );
}

function repointSpeakers(noteId: string, fromId: string, toId: string) {
  const diarization = state.diarizations.get(noteId);
  if (diarization) {
    state.diarizations.set(noteId, {
      ...diarization,
      speakers: diarization.speakers.map((row) =>
        row.assignedParticipantId === fromId
          ? { ...row, assignedParticipantId: toId }
          : row
      ),
    });
  }
  for (const segment of segmentsOfNote(noteId)) {
    if (segment.assignedParticipantId === fromId) {
      segment.assignedParticipantId = toId;
    }
  }
}

function readMockAccountLanguage(): "ko" | "en" | null {
  if (typeof document === "undefined") return null;
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${MOCK_ACCOUNT_LANGUAGE_COOKIE}=`))
    ?.slice(MOCK_ACCOUNT_LANGUAGE_COOKIE.length + 1);
  return value === "ko" || value === "en" ? value : null;
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function fail(code: string): never {
  throw new Error(code);
}

function withQuery(uri: string, params: Record<string, string>) {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function rejectIfChanged(
  expected: string[] | undefined,
  current: string[],
  requested: string[]
) {
  const same = (a: string[], b: string[]) =>
    new Set(a).size === new Set(b).size &&
    a.every((value) => b.includes(value));
  if (expected && !same(expected, current) && !same(requested, current)) {
    fail("NOTE_PARTICIPANTS_CONFLICT");
  }
}

function nextId() {
  const id = `01K${String(idCounter).padStart(10, "0")}`;
  idCounter += 1;
  return id;
}

let mockClock = 0;
function nextTimestamp() {
  mockClock = Math.max(Date.now(), mockClock + 1);
  return new Date(mockClock).toISOString();
}

const nextAgentChatTimestamp = nextTimestamp;

function nextSessionTimestamp() {
  const latest = state.sessions.reduce((latestMs, session) => {
    const candidates = [session.startedAt, session.endedAt]
      .map((value) => (value ? Date.parse(value) : Number.NaN))
      .filter(Number.isFinite);
    return Math.max(latestMs, ...candidates);
  }, Number.NEGATIVE_INFINITY);
  return new Date(Math.max(Date.now(), latest + 1_000)).toISOString();
}

function daysAgoIso(daysAgo: number, order = 0): string {
  const todayUtcMidnight = Date.parse(`${getAppDateKey(new Date())}T00:00:00Z`);
  const at =
    todayUtcMidnight - daysAgo * 86_400_000 + 3_600_000 - order * 60_000;
  const capped =
    daysAgo >= 0 ? Math.min(at, Date.now() - order * 60_000 - 1_000) : at;
  return new Date(capped).toISOString();
}

function seedAgentChats(workspaceId: string) {
  const minutesAgo = (minutes: number) =>
    new Date(Date.now() - minutes * 60_000).toISOString();
  const dayAt = (daysAgo: number, minutes: number) =>
    new Date(Date.parse(daysAgoIso(daysAgo)) + minutes * 60_000).toISOString();

  const chats: MockAgentChat[] = [];
  const messages: MockAgentChatMessage[] = [];
  let turn = 300;

  const exchange = (
    chatId: string,
    askedAt: string,
    ask: string,
    answer: string
  ) => {
    const turnId = `01K${String(turn).padStart(10, "0")}`;
    turn += 1;
    messages.push(
      {
        chatId,
        turnId,
        createdAt: askedAt,
        role: "USER",
        content: ask,
        scope: [],
        toolEvent: null,
      },
      {
        chatId,
        turnId,
        createdAt: new Date(Date.parse(askedAt) + 8_000).toISOString(),
        role: "ASSISTANT",
        content: answer,
        scope: [],
        toolEvent: null,
      }
    );
  };

  const chat = (chatId: string, title: string, createdAt: string) => {
    chats.push({
      chatId,
      workspaceId,
      title,
      titleSource: seededTitleSource(title),
      createdAt,
      updatedAt: createdAt,
    });
    return chatId;
  };

  const followUp = chat("01K0000000201", "회의 후속 정리", dayAt(1, 320));
  exchange(
    followUp,
    dayAt(1, 320),
    "지난 회의에서 정한 것만 정리해줘",
    "세 가지가 남아 있었습니다. 첫 화면 개편, 알림 정책 확정, 그리고 배포 일정 재조정입니다."
  );
  exchange(
    followUp,
    dayAt(1, 496),
    "그럼 두 번째는?",
    "알림 정책은 기본값을 끄기로 하고, 켤 사람만 설정에서 켜는 쪽으로 좁혔습니다."
  );
  exchange(
    followUp,
    minutesAgo(6),
    "남은 액션 아이템이 뭐야?",
    "배포 일정 재조정만 남았습니다. 담당자가 아직 안 정해져 있습니다."
  );

  const onboarding = chat("01K0000000202", "온보딩 문서 초안", minutesAgo(180));
  exchange(
    onboarding,
    minutesAgo(180),
    "온보딩 문서 초안 잡아줘",
    "가입 직후 첫 화면부터 첫 회의를 만들기까지를 네 단계로 나눠 적었습니다."
  );

  const release = chat("01K0000000203", "배포 일정 확인", dayAt(1, 40));
  exchange(
    release,
    dayAt(1, 40),
    "이번 배포 언제였지?",
    "이번 주 목요일 오후로 잡혀 있고, 그 전날까지 QA 를 끝내기로 했습니다."
  );

  const feedback = chat("01K0000000204", "고객 피드백 후속", dayAt(3, 200));
  exchange(
    feedback,
    dayAt(3, 200),
    "고객 피드백에서 반복된 얘기 있어?",
    "검색이 느리다는 말이 세 번 나왔습니다. 나머지는 한 번씩입니다."
  );

  const retro = chat("01K0000000205", "스프린트 회고 정리", dayAt(5, 120));
  exchange(
    retro,
    dayAt(5, 120),
    "회고에서 나온 개선안만 뽑아줘",
    "리뷰 대기 시간을 줄이자는 것과 배포 체크리스트를 문서로 남기자는 것 둘입니다."
  );

  const traced = chat("01K0000000208", "생각이 남은 대화", dayAt(2, 60));
  {
    const turnId = `01K${String(turn).padStart(10, "0")}`;
    turn += 1;
    const at = (seconds: number) =>
      new Date(Date.parse(dayAt(2, 60)) + seconds * 1_000).toISOString();
    const step = (
      seconds: number,
      role: "THINKING" | "TOOL",
      content: string,
      toolEvent: MockAgentChatMessage["toolEvent"] = null
    ) =>
      messages.push({
        chatId: traced,
        turnId,
        createdAt: at(seconds),
        role,
        content,
        scope: [],
        toolEvent,
      });

    messages.push({
      chatId: traced,
      turnId,
      createdAt: at(0),
      role: "USER",
      content: "결제 실패 얘기 언제 나왔고 이슈로도 만들었어?",
      scope: [],
      toolEvent: null,
    });
    step(
      2,
      "THINKING",
      "먼저 스크립트에서 결제 실패가 언급된 자리를 찾습니다."
    );
    step(4, "TOOL", "스크립트에서 관련 발화 검색 · 3건 찾음", {
      tool: "transcripts.search",
      decision: null,
      status: "success",
      url: null,
      card: null,
    });
    step(
      6,
      "THINKING",
      "세 건 중 두 건은 같은 회의의 같은 대목이라 하나로 봅니다. 남은 한 건은 그보다 " +
        "이틀 전 회의인데, 그때는 원인을 못 좁히고 다음 회의로 넘겼습니다. 그래서 " +
        "언제 나왔는지는 두 회의가 답이고, 이슈로 만들었는지는 아직 확인이 안 됐으니 " +
        "Linear 를 한 번 더 봐야 합니다."
    );
    step(8, "TOOL", "Linear 이슈 검색 · 1건 찾음", {
      tool: "linear.search_issues",
      decision: null,
      status: "success",
      url: "https://linear.app/heymoa/issue/APP-12",
      card: null,
    });
    messages.push({
      chatId: traced,
      turnId,
      createdAt: at(10),
      role: "ASSISTANT",
      content:
        "두 회의에서 나왔습니다. 이틀 전 회의에서는 원인을 못 좁혔고, 어제 회의에서 " +
        "결제 실패율이 3%로 올랐다는 얘기가 다시 나왔습니다. 이슈는 APP-12 로 이미 " +
        "만들어져 있습니다.",
      scope: [],
      toolEvent: null,
    });
  }

  const ordered = chat(
    "01K0000000209",
    "주간 제품 회의 진행 순서",
    minutesAgo(58)
  );
  {
    const turnId = `01K${String(turn).padStart(10, "0")}`;
    turn += 1;
    const askedAt = minutesAgo(58);
    const at = (seconds: number) =>
      new Date(Date.parse(askedAt) + seconds * 1_000).toISOString();
    const note = {
      kind: "NOTE" as const,
      id: "01K0000000002",
      title: "주간 제품 회의",
      unavailable: false,
    };
    const row = (
      seconds: number,
      role: MockAgentChatMessage["role"],
      content: string,
      extra: Partial<MockAgentChatMessage> = {}
    ) =>
      messages.push({
        chatId: ordered,
        turnId,
        createdAt: at(seconds),
        role,
        content,
        scope: [],
        toolEvent: null,
        ...extra,
      });
    row(
      0,
      "USER",
      `${scopeMarker({ kind: "note", id: note.id, title: note.title })} 어떤 흐름으로 진행했나 순서대로`,
      { scope: [note] }
    );
    row(2, "THINKING", "주간 제품 회의가 진행된 순서를 찾아볼게요.\n");
    row(3, "THINKING", "안건 요약에서 진행 순서를 확인할게요.\n");
    row(6, "TOOL", "안건 요약 읽기 · 안건 4개", {
      scope: [note],
      toolEvent: {
        tool: "notes_read",
        decision: null,
        status: "success",
        url: null,
        card: null,
      },
    });
    row(8, "THINKING", "스크립트에서 각 안건이 나온 시각을 확인할게요.\n");
    row(11, "TOOL", "스크립트에서 관련 발화 검색 · 3건 찾음", {
      scope: [note],
      toolEvent: {
        tool: "transcripts.search",
        decision: null,
        status: "success",
        url: null,
        card: null,
      },
    });
    row(
      12,
      "ASSISTANT",
      [
        "확인된 발언 기준으로 이런 흐름이었어요.",
        "",
        "1. 지난주 액션 아이템 점검 — 온보딩 축소안이 끝났는지부터 봤어요",
        "2. 온보딩 이탈 지표 공유 — 프로필 설정 단계 이탈이 41%로 가장 컸어요",
        "3. 알림 정책 논의 — 묶어서 보내는 방향으로 좁혔어요",
        "4. 다음 주 사용자 테스트 일정 확정",
        "",
        "필요하면 안건별 발언 시각도 정리해 드릴게요.",
      ].join("\n"),
      { scope: [note] }
    );
  }

  const legacy = chat("01K0000000210", "알림 정책 결정 사항", dayAt(4, 90));
  exchange(
    legacy,
    dayAt(4, 90),
    "알림 정책 어떻게 정했어?",
    [
      "회의록에서 알림 정책 얘기를 찾아볼게요.",
      "스크립트에서 관련 발화를 먼저 확인할게요.",
      "알림은 기본값을 끄고, 켤 사람만 설정에서 켜는 쪽으로 정했어요. 묶어서 보내는 주기는 다음 사이클에 정하기로 했어요.",
    ].join("\n\n")
  );

  const hiring = chat("01K0000000206", "채용 프로세스 정리", dayAt(40, 180));
  exchange(
    hiring,
    dayAt(40, 180),
    "채용 절차 어디까지 정해졌어?",
    "서류·과제·인터뷰 세 단계로 좁혔고 과제 분량은 아직 논의 중입니다."
  );

  const roadmap = chat("01K0000000207", "지난 분기 로드맵", dayAt(96, 150));
  exchange(
    roadmap,
    dayAt(96, 150),
    "지난 분기에 뭘 냈지?",
    "회의 기록과 요약까지 냈고, 연동은 다음 분기로 미뤘습니다."
  );

  for (const each of chats)
    if (each.chatId === ordered) each.titleSource = "AI";

  for (const each of chats) {
    const last = messages
      .filter((message) => message.chatId === each.chatId)
      .at(-1);
    if (last) each.updatedAt = last.createdAt;
  }

  return { chats, messages };
}

function createSeedState(): StoreState {
  faker.seed(20260715);
  const seededChats = seedAgentChats("01K0000000000");
  const user: CurrentUserResponseData = {
    ...MOCK_USER,
    ...structuredClone(MOCK_ACCOUNT),
    language: readMockAccountLanguage(),
  };
  const workspaces: WorkspaceResponseData[] = [
    {
      workspaceId: "01K0000000000",
      name: "테스트 유저의 워크스페이스",
      description: "회의 기록을 모으는 기본 공간입니다.",
      role: "ADMIN",
      agentAccessAllowed: true,
    },
    {
      workspaceId: "01K0000000006",
      name: "제품 팀",
      description: null,
      role: "ADMIN",
      agentAccessAllowed: true,
    },
    {
      workspaceId: "01K0000000009",
      name: "새 워크스페이스",
      description: null,
      role: "ADMIN",
      agentAccessAllowed: true,
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
      displayName: "리서치 담당",
      email: user.email,
      role: "ADMIN",
      image: user.image,
      joinedAt: "2026-07-03T00:00:00Z",
    },
    {
      workspaceId: workspaces[1].workspaceId,
      userId: "01K0000000M21",
      name: "박서연",
      email: "seoyeon@heymoa.com",
      role: "ADMIN",
      image: null,
      joinedAt: "2026-07-04T00:00:00Z",
    },
    {
      workspaceId: workspaces[1].workspaceId,
      userId: "01K0000000M22",
      name: "이도윤",
      email: "doyoon@heymoa.com",
      role: "MEMBER",
      image: null,
      joinedAt: "2026-07-06T00:00:00Z",
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
      .map(memberView)
      .map(({ userId, name, email, image }) => ({
        participantId: nextId(),
        userId,
        guestId: null,
        name,
        email,
        image,
      }))
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) ||
          a.participantId.localeCompare(b.participantId)
      );
  };
  const seededGuest: MockWorkspaceGuest = {
    guestId: "01K0000000900",
    workspaceId: workspaces[0].workspaceId,
    displayName: "박서준",
    createdAt: "2026-07-08T00:00:00Z",
  };
  const mentoringGuests: MockWorkspaceGuest[] = (
    [
      [MENTORING_GUEST_IDS.hanJiwon, "한지원"],
      [MENTORING_GUEST_IDS.shark, "상어"],
      [MENTORING_GUEST_IDS.kimMinsu, "김민수"],
      [MENTORING_GUEST_IDS.mentorLee, "이동준 멘토님"],
    ] as const
  ).map(([guestId, displayName]) => ({
    guestId,
    workspaceId: workspaces[0].workspaceId,
    displayName,
    createdAt: "2026-09-11T00:00:00Z",
  }));
  const guestParticipant = () => ({
    participantId: "01K0000000901",
    userId: null,
    guestId: seededGuest.guestId,
    name: seededGuest.displayName,
    email: null,
    image: null,
  });
  const starterOf = (userId: string): NoteResponseData["meetingStartedBy"] => {
    const member = members.find((candidate) => candidate.userId === userId);
    if (!member) return null;
    const { name, email, image } = memberView(member);
    return { userId, name, email, image };
  };
  type SeedNote = Omit<
    NoteResponseData,
    | "workspaceId"
    | "projectName"
    | "meetingEndedAt"
    | "contextTopic"
    | "contextBackground"
    | "autoEnd"
    | "pausedAt"
  > & {
    meetingEndedAt?: string | null;
    autoEnd?: NoteResponseData["autoEnd"];
    contextTopic?: string | null;
    contextBackground?: string | null;
  };
  const withProjectScope = (note: SeedNote): NoteResponseData => {
    const project = projects.find((it) => it.projectId === note.projectId);
    return {
      ...note,
      workspaceId: project?.workspaceId ?? workspaces[0].workspaceId,
      projectName: project?.name ?? "알 수 없는 프로젝트",
      meetingEndedAt: note.meetingEndedAt ?? null,
      contextTopic: note.contextTopic ?? null,
      contextBackground: note.contextBackground ?? null,
      autoEnd: note.autoEnd ?? null,
      pausedAt: null,
    };
  };
  const noteSeeds: SeedNote[] = [
    {
      noteId: "01K0000000002",
      projectId: projects[0].projectId,
      title: "주간 제품 회의",
      createdAt: "2026-07-10T00:00:00Z",
      updatedAt: "2026-07-11T00:00:00Z",
      contextTopic: "결제 오류 대응과 다음 주 출시 일정",
      contextBackground:
        "지난주 결제 승인 실패가 늘어 원인을 찾는 중입니다. 오늘은 PG사 로그 결과와 임시 조치를 정합니다.",
      meetingStatus: "IN_PROGRESS",
      meetingStartedAt: "2026-07-11T00:00:00Z",
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: starterOf(MOCK_USER.userId),
      participants: sortParticipants([
        ...participantsOf(
          projects[0].projectId,
          MOCK_USER.userId,
          "01K0000000020"
        ),
        guestParticipant(),
      ]),
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
      noteId: "01K0000000006",
      projectId: projects[0].projectId,
      title: "정리 실패 재현 회의",
      createdAt: "2026-07-05T00:00:00Z",
      updatedAt: "2026-07-05T00:00:00Z",
      meetingStatus: "PAUSED",
      meetingStartedAt: null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: starterOf(MOCK_USER.userId),
      participants: participantsOf(projects[0].projectId, MOCK_USER.userId),
    },
    {
      noteId: "01K0000000007",
      projectId: projects[0].projectId,
      title: "합성 원장 검증 회의",
      createdAt: "2026-07-05T01:00:00Z",
      updatedAt: "2026-07-05T01:00:00Z",
      meetingStatus: "PAUSED",
      meetingStartedAt: null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: starterOf(MOCK_USER.userId),
      participants: participantsOf(projects[0].projectId, MOCK_USER.userId),
    },
    {
      noteId: "01K0000000008",
      projectId: projects[0].projectId,
      title: "커버리지 추종 확인",
      createdAt: "2026-07-13T00:00:00Z",
      updatedAt: "2026-07-13T00:00:00Z",
      meetingStatus: "PAUSED",
      meetingStartedAt: "2026-07-13T00:00:00Z",
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: starterOf(MOCK_USER.userId),
      participants: participantsOf(projects[0].projectId, MOCK_USER.userId),
    },
    {
      noteId: "01K0000000016",
      projectId: projects[0].projectId,
      title: "실시간 안건 확인 회의",
      createdAt: "2026-07-04T00:00:00Z",
      updatedAt: "2026-07-04T00:00:00Z",
      meetingStatus: "IN_PROGRESS",
      meetingStartedAt: "2026-07-04T00:00:00Z",
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: starterOf(MOCK_USER.userId),
      participants: participantsOf(projects[0].projectId, MOCK_USER.userId),
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
      noteId: "01K0000000040",
      projectId: projects[2].projectId,
      title: "멈춰 둔 주간 회의",
      createdAt: "2026-07-07T00:00:00Z",
      updatedAt: "2026-07-07T00:05:00Z",
      meetingStatus: "PAUSED",
      autoEnd: {
        scheduledAt: new Date(
          Math.floor(Date.now() / 86_400_000) * 86_400_000 +
            2 * 86_400_000 +
            (7 * 60 + 20) * 60_000
        ).toISOString(),
        endedBy: null,
        reason: null,
        pausedAt: null,
        pausedBusinessDays: null,
      },
      meetingStartedAt: "2026-07-07T00:00:00Z",
      recordedDurationMs: 300_000,
      activeSessionStartedAt: null,
      meetingStartedBy: starterOf(MOCK_USER.userId),
      participants: participantsOf(projects[2].projectId, MOCK_USER.userId),
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
      participants: participantsOf(projects[3].projectId, MOCK_USER.userId),
    },
    ...[
      ["01K0000000020", "온보딩 이탈 구간 리뷰", 0, 0],
      ["01K0000000021", "알림 정책 논의 (2차)", 0, 1],
      ["01K0000000022", "고객 피드백 정리", 1, 0],
      ["01K0000000023", "스프린트 회고", 3, 1],
      ["01K0000000024", "로드맵 브레인스토밍", 4, 0],
      ["01K0000000025", "디자인 시스템 점검", 9, 1],
      ["01K0000000026", "분기 계획 세션", 20, 0],
      ["01K0000000027", "파트너십 킥오프", 45, 1],
    ].map(([noteId, title, daysAgo, projectIndex], index) => {
      const at = daysAgoIso(daysAgo as number, index);
      return {
        noteId: noteId as string,
        projectId: projects[projectIndex as number].projectId,
        title: title as string,
        createdAt: at,
        updatedAt: at,
        meetingStatus: "ENDED" as const,
        meetingStartedAt: null,
        meetingEndedAt: at,
        recordedDurationMs: 0,
        activeSessionStartedAt: null,
        meetingStartedBy:
          (projectIndex as number) === 0
            ? starterOf(MOCK_USER.userId)
            : (index as number) < 4
              ? starterOf("01K0000000020")
              : null,
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
        autoEnd:
          noteId === "01K0000000026"
            ? {
                scheduledAt: null,
                endedBy: "SYSTEM" as const,
                reason: "PAUSE_TIMEOUT" as const,
                pausedAt: at,
                pausedBusinessDays: 3,
              }
            : null,
      };
    }),
    {
      noteId: MENTORING_NOTE_ID,
      projectId: projects[0].projectId,
      title: "9/11 팀 이동준 멘토님 - 정규멘토링",
      createdAt: "2026-09-11T01:45:00Z",
      updatedAt: "2026-09-11T02:48:18Z",
      meetingStatus: "ENDED",
      meetingStartedAt: "2026-09-11T01:45:00Z",
      meetingEndedAt: "2026-09-11T02:48:18Z",
      recordedDurationMs: 3_797_080,
      activeSessionStartedAt: null,
      meetingStartedBy: starterOf(MOCK_USER.userId),
      participants: [
        {
          participantId: MENTORING_PARTICIPANT_IDS.hanJiwon,
          userId: null,
          guestId: MENTORING_GUEST_IDS.hanJiwon,
          name: "한지원",
          email: null,
          image: null,
        },
        {
          participantId: MENTORING_PARTICIPANT_IDS.shark,
          userId: null,
          guestId: MENTORING_GUEST_IDS.shark,
          name: "상어",
          email: null,
          image: null,
        },
        {
          participantId: MENTORING_PARTICIPANT_IDS.kimMinsu,
          userId: null,
          guestId: MENTORING_GUEST_IDS.kimMinsu,
          name: "김민수",
          email: null,
          image: null,
        },
        {
          participantId: MENTORING_PARTICIPANT_IDS.mentorLee,
          userId: null,
          guestId: MENTORING_GUEST_IDS.mentorLee,
          name: "이동준 멘토님",
          email: null,
          image: null,
        },
      ],
    },
  ];
  const notes: NoteResponseData[] = noteSeeds.map(withProjectScope);
  const liveSessionStartedAt = new Date(Date.now() - 5_000).toISOString();
  const liveSessionReadyExpiresAt = new Date(Date.now() + 60_000).toISOString();
  const sessions: MockSession[] = [
    {
      sessionId: "01K0000000010",
      noteId: notes[0].noteId,
      status: "COMPLETED",
      firstRecording: false,
      readyExpiresAt: "2026-07-11T00:10:00Z",
      startedAt: "2026-07-11T00:00:00Z",
      endedAt: "2026-07-11T00:02:00Z",
      endReason: "CLIENT_DISCONNECTED",
    },
    {
      sessionId: "01K0000000402",
      noteId: "01K0000000002",
      status: "ACTIVE",
      firstRecording: false,
      readyExpiresAt: liveSessionReadyExpiresAt,
      startedAt: liveSessionStartedAt,
      endedAt: null,
      endReason: null,
    },
    {
      sessionId: "01K0000000428",
      noteId: "01K0000000028",
      status: "ACTIVE",
      firstRecording: false,
      readyExpiresAt: liveSessionReadyExpiresAt,
      startedAt: liveSessionStartedAt,
      endedAt: null,
      endReason: null,
    },
    {
      sessionId: "01K0000000416",
      noteId: "01K0000000016",
      status: "ACTIVE",
      firstRecording: false,
      readyExpiresAt: liveSessionReadyExpiresAt,
      startedAt: liveSessionStartedAt,
      endedAt: null,
      endReason: null,
    },
    {
      sessionId: "01K0000000406",
      noteId: "01K0000000006",
      status: "INTERRUPTED",
      firstRecording: false,
      readyExpiresAt: "2026-07-05T00:01:00Z",
      startedAt: null,
      endedAt: "2026-07-05T00:01:00Z",
      endReason: "READY_TIMEOUT",
    },
    {
      sessionId: "01K0000000407",
      noteId: "01K0000000007",
      status: "INTERRUPTED",
      firstRecording: false,
      readyExpiresAt: "2026-07-05T01:01:00Z",
      startedAt: null,
      endedAt: "2026-07-05T01:01:00Z",
      endReason: "READY_TIMEOUT",
    },
    {
      sessionId: "01K0000000029",
      noteId: "01K0000000028",
      status: "COMPLETED",
      firstRecording: false,
      readyExpiresAt: "2026-07-12T00:10:00Z",
      startedAt: "2026-07-12T00:00:00Z",
      endedAt: "2026-07-12T00:05:00Z",
      endReason: "CLIENT_DISCONNECTED",
    },
    {
      sessionId: "01K0000000440",
      noteId: "01K0000000040",
      status: "COMPLETED",
      firstRecording: false,
      readyExpiresAt: "2026-07-07T00:10:00Z",
      startedAt: "2026-07-07T00:00:00Z",
      endedAt: "2026-07-07T00:05:00Z",
      endReason: "CLIENT_DISCONNECTED",
    },
    {
      sessionId: "01K0000000008",
      noteId: "01K0000000008",
      status: "COMPLETED",
      firstRecording: false,
      readyExpiresAt: "2026-07-13T00:10:00Z",
      startedAt: "2026-07-13T00:00:00Z",
      endedAt: "2026-07-13T00:05:00Z",
      endReason: "CLIENT_DISCONNECTED",
    },
    {
      sessionId: "01K0000000060",
      noteId: "01K0000000020",
      status: "COMPLETED",
      firstRecording: false,
      readyExpiresAt: "2026-07-13T00:10:00Z",
      startedAt: "2026-07-13T00:00:00Z",
      endedAt: "2026-07-13T00:06:00Z",
      endReason: "CLIENT_DISCONNECTED",
    },
    {
      sessionId: MENTORING_SESSION_ID,
      noteId: MENTORING_NOTE_ID,
      status: "COMPLETED",
      firstRecording: false,
      readyExpiresAt: "2026-09-11T02:58:00Z",
      startedAt: "2026-09-11T01:45:00Z",
      endedAt: "2026-09-11T02:48:18Z",
      endReason: "CLIENT_DISCONNECTED",
    },
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
      assignedParticipantId: null,
    },
    {
      segmentId: "01K0000000012",
      transcriptionSessionId: sessions[0].sessionId,
      sequence: 2,
      text: "첫 번째 안건은 온보딩 개선입니다.",
      startedAtMs: 2200,
      endedAtMs: 4300,
      speakerLabel: null,
      assignedParticipantId: null,
    },
    {
      segmentId: "01K0000000013",
      transcriptionSessionId: sessions[0].sessionId,
      sequence: 3,
      text: "다음 주까지 사용자 테스트를 진행합니다.",
      startedAtMs: 5000,
      endedAtMs: 7100,
      speakerLabel: null,
      assignedParticipantId: null,
    },
    ...Array.from({ length: 40 }, (_, index) => ({
      segmentId: `01K${String(index + 500).padStart(10, "0")}`,
      transcriptionSessionId: "01K0000000008",
      sequence: index + 1,
      text: `커버리지 추종 확인용 발화 ${index + 1}입니다. 화면을 넘기려면 줄이 넉넉해야 합니다.`,
      startedAtMs: index * 4_000,
      endedAtMs: index * 4_000 + 1_800,
      speakerLabel: null,
      assignedParticipantId: null,
    })),
    {
      segmentId: "01K0000000030",
      transcriptionSessionId: "01K0000000029",
      sequence: 1,
      text: "파트너 요구사항을 먼저 확인하겠습니다.",
      startedAtMs: 0,
      endedAtMs: 1900,
      speakerLabel: null,
      assignedParticipantId: null,
    },
    {
      segmentId: "01K0000000031",
      transcriptionSessionId: "01K0000000029",
      sequence: 2,
      text: "다음 배포 일정과 책임자를 정리하겠습니다.",
      startedAtMs: 2300,
      endedAtMs: 4500,
      speakerLabel: null,
      assignedParticipantId: null,
    },
    {
      segmentId: "01K0000000032",
      transcriptionSessionId: "01K0000000029",
      sequence: 3,
      text: "확인한 내용은 회의록에 남기겠습니다.",
      startedAtMs: 5000,
      endedAtMs: 7100,
      speakerLabel: null,
      assignedParticipantId: null,
    },
    {
      segmentId: "01K0000000061",
      transcriptionSessionId: "01K0000000060",
      speakerLabel: "A",
      assignedParticipantId: null,
      sequence: 1,
      text: "가입 후 첫 회의를 만들기까지 이탈이 가장 큽니다.",
      startedAtMs: 12000,
      endedAtMs: 15200,
    },
    {
      segmentId: "01K0000000062",
      transcriptionSessionId: "01K0000000060",
      speakerLabel: "B",
      assignedParticipantId: null,
      sequence: 2,
      text: "문구 문제라기보다 다음에 뭘 해야 하는지가 안 보입니다.",
      startedAtMs: 40000,
      endedAtMs: 43800,
    },
    {
      segmentId: "01K0000000063",
      transcriptionSessionId: "01K0000000060",
      speakerLabel: "A",
      assignedParticipantId: null,
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
      assignedParticipantId: null,
    },
    {
      segmentId: "01K0000000065",
      transcriptionSessionId: "01K0000000060",
      speakerLabel: "B",
      assignedParticipantId: null,
      sequence: 5,
      text: "제가 지난주에 신규 가입자 마흔 명 세션을 전부 돌려봤는데요, 대시보드까지는 다들 무리 없이 들어오다가 회의 만들기 버튼 앞에서 평균 이 분 가까이 머물다 그냥 나가더라고요. 화면에 버튼이 없는 게 아니라 그게 지금 눌러야 할 것으로 안 읽히는 겁니다.",
      startedAtMs: 210000,
      endedAtMs: 231400,
    },
    {
      segmentId: "01K0000000066",
      transcriptionSessionId: "01K0000000060",
      speakerLabel: "A",
      assignedParticipantId: null,
      sequence: 6,
      text: "정리하면 이렇습니다. 첫째, 가입 직후 화면에서 회의 만들기를 가장 눈에 띄는 자리로 올리고 나머지 진입점은 한 단계 뒤로 미룹니다. 둘째, 회의를 아직 한 번도 안 만든 사람에게는 빈 목록 대신 예시 회의를 하나 깔아 두고 그것부터 열어보게 합니다. 셋째, 이 둘을 이번 스프린트 안에 같이 내고 이 주 뒤에 같은 지표를 다시 봅니다. 문구 개편은 그때 판단해도 늦지 않습니다.",
      startedAtMs: 268000,
      endedAtMs: 297600,
    },
    ...mentoringSegments.map((segment) => ({ ...segment })),
  ];
  if (process.env.NEXT_PUBLIC_TRANSCRIPT_EXPERIMENT === "enabled") {
    const sessionId = "01K0000000060";
    const experimentSession = sessions.find((s) => s.sessionId === sessionId)!;
    const starts = [0, 2705, 5409];
    const ends = [2705 * 1160, 5409 * 1160, 9410350];
    const sessionIds = [
      sessionId,
      "experiment-session-2",
      "experiment-session-3",
    ];
    const began = Date.parse(experimentSession.startedAt!);
    const copies = starts.map((start, i) => ({
      ...experimentSession,
      sessionId: sessionIds[i],
      startedAt: new Date(began + start * 1160 + i * 600000).toISOString(),
      endedAt: new Date(began + ends[i] + i * 600000).toISOString(),
    }));
    Object.assign(experimentSession, copies[0]);
    sessions.push(...copies.slice(1));
    const originals = segments.filter(
      (s) => s.transcriptionSessionId === sessionId
    );
    const indexes = [0, 1400, 6000, 8113, 3000, 4500];
    const generated: typeof segments = Array.from({ length: 8114 }, (_, i) => ({
      segmentId: `experiment-${i}`,
      transcriptionSessionId:
        sessionIds[i < starts[1] ? 0 : i < starts[2] ? 1 : 2],
      sequence: i - starts[i < starts[1] ? 0 : i < starts[2] ? 1 : 2] + 1,
      text:
        i % 90 === 0
          ? `실험 발화 ${i}: ${"이 내용은 여러 줄 발화의 높이 변경을 확인하기 위한 합성 문장입니다. ".repeat(6)}`
          : `실험 발화 ${i}: ${i % 2 ? "다음 내용을 확인합니다." : "네."}`,
      speakerLabel: i < 1390 ? "B" : i < 7727 ? "A" : null,
      assignedParticipantId: null,
      startedAtMs:
        (i - starts[i < starts[1] ? 0 : i < starts[2] ? 1 : 2]) * 1160,
      endedAtMs:
        (i - starts[i < starts[1] ? 0 : i < starts[2] ? 1 : 2]) * 1160 + 570,
    }));
    originals.forEach((original, i) => {
      generated[indexes[i]] = {
        ...generated[indexes[i]],
        ...original,
        transcriptionSessionId: generated[indexes[i]].transcriptionSessionId,
        sequence: generated[indexes[i]].sequence,
        startedAtMs: generated[indexes[i]].startedAtMs,
        endedAtMs: generated[indexes[i]].endedAtMs,
      };
    });
    segments.splice(
      0,
      segments.length,
      ...segments.filter((s) => s.transcriptionSessionId !== sessionId),
      ...generated
    );
  }
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
      expiresAt: daysAgoIso(-1),
    },
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
    {
      workspaceId: RESEARCH_WORKSPACE.workspaceId,
      invitationId: "01K0000000044",
      inviteeName: user.name,
      inviteeEmail: user.email,
      inviteeImage: user.image,
      inviterName: "박서준",
      role: "MEMBER",
      status: "PENDING",
      createdAt: daysAgoIso(2, 40),
      expiresAt: daysAgoIso(-5),
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
      payload: invitationPayload(
        INVITED_WORKSPACE.workspaceId,
        INVITED_WORKSPACE.name,
        invitations[0].invitationId
      ),
    },
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
      payload: invitationPayload(
        workspaces[1].workspaceId,
        workspaces[1].name,
        "01K0000000024"
      ),
    },
    {
      notificationId: "01K0000000019",
      type: "WORKSPACE_INVITATION",
      readAt: "2026-07-09T01:00:00Z",
      createdAt: "2026-07-09T00:00:00Z",
      invitation: null,
      payload: invitationPayload(
        "01K0000000018",
        "디자인 스튜디오",
        "01K0000000017"
      ),
    },
    {
      notificationId: "01K0000000016",
      type: "WORKSPACE_INVITATION",
      readAt: "2026-07-08T01:00:00Z",
      createdAt: "2026-07-08T00:00:00Z",
      invitation: {
        invitationId: "01K0000000015",
        status: "DECLINED",
        role: "MEMBER",
        workspaceId: "01K0000000014",
        workspaceName: "마케팅 팀",
        inviterName: "한지원",
        expiresAt: "2026-07-09T00:00:00Z",
      },
      payload: null,
    },
    {
      notificationId: "01K0000000080",
      type: "INQUIRY_ANSWERED",
      readAt: null,
      createdAt: daysAgoIso(0, 10),
      invitation: null,
      payload: {
        workspaceId: null,
        workspaceName: null,
        invitationId: null,
        inviterUserId: null,
        noteId: null,
        noteTitle: null,
        autoEnded: null,
        pausedBusinessDays: null,
        feedbackId: "01K0000000031",
      },
    },
    {
      notificationId: "01K0000000031",
      type: "ANALYSIS_READY",
      readAt: null,
      createdAt: daysAgoIso(0, 0),
      invitation: null,
      payload: analysisReadyPayload(
        workspaces[0],
        "01K0000000026",
        "분기 계획 세션",
        true,
        3
      ),
    },
    {
      notificationId: "01K0000000032",
      type: "ANALYSIS_READY",
      readAt: null,
      createdAt: daysAgoIso(1, 0),
      invitation: null,
      payload: analysisReadyPayload(
        workspaces[0],
        MENTORING_NOTE_ID,
        "9/11 팀 이동준 멘토님 - 정규멘토링",
        false,
        null
      ),
    },
    {
      notificationId: "01K0000000033",
      type: "ANALYSIS_READY",
      readAt: "2026-07-12T01:00:00Z",
      createdAt: "2026-07-12T00:00:00Z",
      invitation: null,
      payload: {
        workspaceId: null,
        workspaceName: null,
        invitationId: null,
        inviterUserId: null,
        noteId: "01K0000009999",
        noteTitle: "6월 킥오프",
        autoEnded: false,
        pausedBusinessDays: null,
        feedbackId: null,
      },
    },
    {
      notificationId: "01K0000000041",
      type: "ANALYSIS_READY",
      readAt: daysAgoIso(0, 5),
      createdAt: daysAgoIso(0, 30),
      invitation: null,
      payload: analysisReadyPayload(
        workspaces[0],
        "01K0000000002",
        "주간 제품 회의",
        false,
        null
      ),
    },
    {
      notificationId: "01K0000000042",
      type: "WORKSPACE_INVITATION",
      readAt: null,
      createdAt: daysAgoIso(2, 40),
      invitation: {
        invitationId: "01K0000000044",
        status: "PENDING",
        role: "MEMBER",
        workspaceId: RESEARCH_WORKSPACE.workspaceId,
        workspaceName: RESEARCH_WORKSPACE.name,
        inviterName: "박서준",
        expiresAt: daysAgoIso(-5),
      },
      payload: invitationPayload(
        RESEARCH_WORKSPACE.workspaceId,
        RESEARCH_WORKSPACE.name,
        "01K0000000044"
      ),
    },
    {
      notificationId: "01K0000000045",
      type: "ANALYSIS_READY",
      readAt: null,
      createdAt: daysAgoIso(2, 90),
      invitation: null,
      payload: analysisReadyPayload(
        workspaces[0],
        "01K0000000005",
        "고객 인터뷰",
        false,
        null
      ),
    },
    {
      notificationId: "01K0000000046",
      type: "ANALYSIS_READY",
      readAt: daysAgoIso(3, 0),
      createdAt: daysAgoIso(3, 60),
      invitation: null,
      payload: analysisReadyPayload(
        workspaces[0],
        "01K0000000040",
        "멈춰 둔 주간 회의",
        true,
        5
      ),
    },
    {
      notificationId: "01K0000000047",
      type: "WORKSPACE_INVITATION",
      readAt: daysAgoIso(4, 0),
      createdAt: daysAgoIso(4, 30),
      invitation: {
        invitationId: "01K0000000049",
        status: "CANCELED",
        role: "MEMBER",
        workspaceId: "01K0000000048",
        workspaceName: "영업 팀",
        inviterName: "한지원",
        expiresAt: daysAgoIso(-2),
      },
      payload: invitationPayload("01K0000000048", "영업 팀", "01K0000000049"),
    },
    {
      notificationId: "01K0000000034",
      type: "ANALYSIS_READY",
      readAt: daysAgoIso(6, 0),
      createdAt: daysAgoIso(6, 120),
      invitation: null,
      payload: analysisReadyPayload(
        workspaces[0],
        "01K0000000028",
        "파트너 검토 회의",
        false,
        null
      ),
    },
    {
      notificationId: "01K0000000035",
      type: "WORKSPACE_INVITATION",
      readAt: daysAgoIso(9, 0),
      createdAt: daysAgoIso(9, 30),
      invitation: {
        invitationId: "01K0000000037",
        status: "EXPIRED",
        role: "MEMBER",
        workspaceId: "01K0000000036",
        workspaceName: "외부 자문단",
        inviterName: "이서연",
        expiresAt: daysAgoIso(2),
      },
      payload: invitationPayload(
        "01K0000000036",
        "외부 자문단",
        "01K0000000037"
      ),
    },
    {
      notificationId: "01K0000000038",
      type: "ANALYSIS_READY",
      readAt: null,
      createdAt: daysAgoIso(12, 30),
      invitation: null,
      payload: analysisReadyPayload(
        { workspaceId: "01K0000000014", name: "마케팅 팀" },
        "01K0000000039",
        "캠페인 회고",
        false,
        null
      ),
    },
  ];
  const integrations: MockIntegration[] = workspaces.flatMap((workspace) =>
    SUPPORTED_PROVIDERS.map((provider) => ({
      workspaceId: workspace.workspaceId,
      provider,
      connected: false,
      connectedBy: null,
      connectedAt: null,
    }))
  );
  seedSegmentOverride(notes, segments);
  return {
    user,
    workspaces,
    projects,
    notes,
    sessions,
    segments,
    workspaceGuests: [seededGuest, ...mentoringGuests],
    diarizations: new Map([
      ...seededDiarizations(notes),
      [MENTORING_NOTE_ID, mentoringDiarization],
    ]),
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
    transcriptGaps: new Map<string, TranscriptResponseDataTranscriptGapsItem[]>(
      [
        [
          "01K0000000020",
          [
            {
              gapId: "tn-01K0000000020-0-598000",
              kind: "NOT_SENT",
              startedAtMs: 598_000,
              endedAtMs: 612_000,
            },
            {
              gapId: "tu-01K0000000020-1-300000",
              kind: "UNANSWERED",
              startedAtMs: 300_000,
              endedAtMs: 318_000,
            },
          ],
        ],
      ]
    ),
    members,
    invitations,
    notifications,
    feedbacks: [
      {
        feedbackId: "01K0000000031",
        kind: "INCIDENT",
        message:
          "녹음 중에 전사가 몇 분 멈췄어요. 데스크톱 앱이고 화면은 노트 상세였습니다.",
        answer:
          "불편을 드려 죄송합니다. 네트워크가 끊긴 구간이 있었고, 다시 연결되며 이어서 받아쓰도록 고쳤습니다.",
        answeredAt: "2026-10-17T09:30:00.000Z",
        answerSeen: false,
        createdAt: "2026-10-17T08:12:00.000Z",
      },
      {
        feedbackId: "01K0000000032",
        kind: "SUGGESTION",
        message: "회의 요약을 메일로 자동 전송하는 옵션이 있으면 좋겠어요.",
        answer: null,
        answeredAt: null,
        answerSeen: false,
        createdAt: "2026-10-18T01:05:00.000Z",
      },
    ],
    analyses: [
      {
        analysisId: "01K0000000050",
        noteId: "01K0000000020",
        status: "SUCCEEDED",
        analysisRunning: false,
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
                  {
                    segmentId: "01K0000000065",
                    text: "제가 지난주에 신규 가입자 마흔 명 세션을 전부 돌려봤는데요, 대시보드까지는 다들 무리 없이 들어오다가 회의 만들기 버튼 앞에서 평균 이 분 가까이 머물다 그냥 나가더라고요. 화면에 버튼이 없는 게 아니라 그게 지금 눌러야 할 것으로 안 읽히는 겁니다.",
                    startedAtMs: 210000,
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
                  {
                    segmentId: "01K0000000066",
                    text: "정리하면 이렇습니다. 첫째, 가입 직후 화면에서 회의 만들기를 가장 눈에 띄는 자리로 올리고 나머지 진입점은 한 단계 뒤로 미룹니다. 둘째, 회의를 아직 한 번도 안 만든 사람에게는 빈 목록 대신 예시 회의를 하나 깔아 두고 그것부터 열어보게 합니다. 셋째, 이 둘을 이번 스프린트 안에 같이 내고 이 주 뒤에 같은 지표를 다시 봅니다. 문구 개편은 그때 판단해도 늦지 않습니다.",
                    startedAtMs: 268000,
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
    agentChats: seededChats.chats,
    agentChatMessages: seededChats.messages,
    agentDelegations: seedAgentDelegations(workspaces, user.userId),
    agentDelegationUsages: seedAgentDelegationUsages(),
    agentOAuthConsents: {
      "mock-consent": {
        clientName: "Codex",
        redirectUri: "http://127.0.0.1:1455/callback",
        scopes: ["mcp:read", "mcp:write"],
      },
      "mock-consent-read": {
        clientName: "Codex",
        redirectUri: "http://127.0.0.1:1455/callback",
        scopes: ["mcp:read"],
      },
    },
  };
}

function seedAgentDelegationUsages(): MockAgentDelegationUsage[] {
  const tools = [
    "list_projects",
    "list_project_items",
    "get_project_item",
    "expand_relations",
    "list_open_tasks",
    "open_screen",
  ];
  const active = Array.from({ length: 24 }, (_, index) => {
    const toolName = tools[index % tools.length];
    const failed = index % 7 === 3;
    return {
      delegationId: "01K00000000Q1",
      usageId: `01K0000000T${String(index).padStart(2, "0")}`,
      toolName,
      outcome: failed ? ("FAILED" as const) : ("SUCCEEDED" as const),
      resultCount:
        failed || toolName === "open_screen" ? null : (index % 5) + 1,
      occurredAt: new Date(
        Date.parse("2026-09-30T13:00:00Z") - index * 30 * 60 * 1000
      ).toISOString(),
    };
  });
  const left = [
    {
      delegationId: "01K00000000Q3",
      usageId: "01K0000000V01",
      toolName: "list_projects",
      outcome: "SUCCEEDED" as const,
      resultCount: 2,
      occurredAt: "2026-08-25T09:00:00Z",
    },
  ];
  return [...active, ...left];
}

function seedAgentDelegations(
  workspaces: WorkspaceResponseData[],
  userId: string
): MockAgentDelegation[] {
  const [first] = workspaces;
  const base = {
    workspaceId: first.workspaceId,
    workspaceName: first.name,
    userId,
  };
  return [
    {
      ...base,
      delegationId: "01K00000000Q1",
      name: "노트북 Claude Code",
      tokenHint: "hm_Q7xKp2a",
      credentialKind: "PERSONAL_TOKEN",
      allowTaskChanges: true,
      status: "ACTIVE",
      createdAt: "2026-09-20T09:00:00Z",
      lastUsedAt: "2026-09-30T13:00:00Z",
      expiresAt: "2026-12-29T13:00:00Z",
      revokedAt: null,
      revokeReason: null,
    },
    {
      ...base,
      delegationId: "01K00000000Q2",
      name: "예전 Codex CLI",
      tokenHint: "hm_m3Zr8Td",
      credentialKind: "PERSONAL_TOKEN",
      allowTaskChanges: false,
      status: "REVOKED",
      createdAt: "2026-09-02T09:00:00Z",
      lastUsedAt: null,
      expiresAt: "2026-12-01T09:00:00Z",
      revokedAt: "2026-09-10T09:00:00Z",
      revokeReason: "USER",
    },
    {
      ...base,
      delegationId: "01K00000000Q3",
      name: "떠난 팀의 연결",
      tokenHint: null,
      credentialKind: "OAUTH",
      allowTaskChanges: false,
      status: "REVOKED",
      createdAt: "2026-08-20T09:00:00Z",
      lastUsedAt: "2026-08-25T09:00:00Z",
      expiresAt: "2026-11-23T09:00:00Z",
      revokedAt: "2026-08-28T09:00:00Z",
      revokeReason: "MEMBERSHIP_ENDED",
    },
    {
      ...base,
      userId: "01K0000000020",
      delegationId: "01K00000000Q4",
      name: "지원의 Codex",
      tokenHint: null,
      credentialKind: "OAUTH",
      allowTaskChanges: false,
      status: "ACTIVE",
      createdAt: "2026-09-25T09:00:00Z",
      lastUsedAt: null,
      expiresAt: "2026-12-24T09:00:00Z",
      revokedAt: null,
      revokeReason: null,
    },
  ];
}

function findInvitation(invitationId: string): MockInvitation {
  const invitation = state.invitations.find(
    (candidate) => candidate.invitationId === invitationId
  );
  return invitation ?? fail("INVITATION_NOT_FOUND");
}

function analysisReadyPayload(
  workspace: { workspaceId: string; name: string },
  noteId: string,
  noteTitle: string,
  autoEnded: boolean,
  pausedBusinessDays: number | null
): NotificationListResponseDataNotificationsItem["payload"] {
  return {
    workspaceId: workspace.workspaceId,
    workspaceName: workspace.name,
    invitationId: null,
    inviterUserId: null,
    noteId,
    noteTitle,
    autoEnded,
    pausedBusinessDays,
    feedbackId: null,
  };
}

function invitationPayload(
  workspaceId: string,
  workspaceName: string,
  invitationId: string
): NotificationListResponseDataNotificationsItem["payload"] {
  return {
    workspaceId,
    workspaceName,
    invitationId,
    inviterUserId: "01K0000000020",
    noteId: null,
    noteTitle: null,
    autoEnded: null,
    pausedBusinessDays: null,
    feedbackId: null,
  };
}

function visibleNotifications(schema?: string | null) {
  const modern = Number(schema) >= 2;
  return [...state.notifications]
    .filter(
      (item) =>
        modern ||
        (item.type === "WORKSPACE_INVITATION" && item.invitation !== null)
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) ||
        b.notificationId.localeCompare(a.notificationId)
    );
}

function syncInvitationNotification(invitation: MockInvitation) {
  const notification = state.notifications.find(
    (candidate) =>
      candidate.invitation?.invitationId === invitation.invitationId
  );
  if (notification?.invitation)
    notification.invitation.status = invitation.status;
}

function expireIfNeeded(invitation: MockInvitation) {
  if (invitation.status !== "PENDING") return;
  if (Date.parse(invitation.expiresAt) > Date.now()) return;
  invitation.status = "EXPIRED";
  syncInvitationNotification(invitation);
  fail("INVITATION_EXPIRED");
}

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

function assertWorkspaceName(workspaceId: string, workspaceName: unknown) {
  const workspace = assertWorkspace(workspaceId);
  if (
    typeof workspaceName !== "string" ||
    workspaceName.trim() !== workspace.name.trim()
  ) {
    fail("WORKSPACE_NAME_MISMATCH");
  }
}

function removeWorkspace(workspaceId: string) {
  state.members = state.members.filter((m) => m.workspaceId !== workspaceId);
  state.workspaces = state.workspaces.filter(
    (w) => w.workspaceId !== workspaceId
  );
}

function assertWorkspace(workspaceId: string) {
  return (
    state.workspaces.find(
      (workspace) => workspace.workspaceId === workspaceId
    ) ?? fail("WORKSPACE_NOT_FOUND")
  );
}

function requireWorkspaceMember(workspaceId: string) {
  const caller = state.members.find(
    (m) => m.workspaceId === workspaceId && m.userId === state.user.userId
  );
  if (!caller) fail("WORKSPACE_NOT_FOUND");
}

function requireWorkspaceAdmin(workspaceId: string) {
  const caller = state.members.find(
    (m) => m.workspaceId === workspaceId && m.userId === state.user.userId
  );
  if (!caller) fail("WORKSPACE_NOT_FOUND");
  if (caller.role !== "ADMIN") fail("WORKSPACE_ACCESS_DENIED");
}

function assertRole(value: string): MockMember["role"] {
  if (value === "ADMIN" || value === "MEMBER") return value;
  return fail("BAD_REQUEST");
}

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

function resolveOrJoinParticipant(
  note: NoteResponseData,
  target: {
    participantId?: string | null;
    userId?: string | null;
    guestId?: string | null;
  }
) {
  const keys = [target.participantId, target.userId, target.guestId].filter(
    Boolean
  );
  if (keys.length > 1) fail("BAD_REQUEST");
  if (keys.length === 0) return null;

  if (target.participantId) {
    const found = note.participants.find(
      (row) => row.participantId === target.participantId
    );
    return found ?? fail("PARTICIPANT_NOT_IN_NOTE");
  }

  const workspaceId = state.projects.find(
    (project) => project.projectId === note.projectId
  )?.workspaceId;

  if (target.guestId) {
    const already = note.participants.find(
      (row) => row.guestId === target.guestId
    );
    if (already) return already;

    const guest = state.workspaceGuests.find(
      (row) => row.guestId === target.guestId && row.workspaceId === workspaceId
    );
    if (!guest) fail("PARTICIPANT_NOT_IN_NOTE");

    const joinedGuest = {
      participantId: nextId(),
      userId: null,
      guestId: guest.guestId,
      name: guest.displayName,
      email: null,
      image: null,
    };
    note.participants = sortParticipants([...note.participants, joinedGuest]);
    return joinedGuest;
  }

  const existing = note.participants.find(
    (row) => row.userId === target.userId
  );
  if (existing) return existing;

  const member = state.members.find(
    (row) => row.userId === target.userId && row.workspaceId === workspaceId
  );
  if (!member) fail("PARTICIPANT_NOT_IN_NOTE");

  const joined = {
    participantId: nextId(),
    userId: member.userId,
    guestId: null,
    name: memberView(member).name,
    email: member.email,
    image: member.image,
  };
  note.participants = sortParticipants([...note.participants, joined]);
  return joined;
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

const resetListeners = new Set<() => void>();

const sessionOpeners = new Map<string, string>();
const MOCK_RECORDER_CLIENT_ID = "mock-recorder-tab";

let consentFailures = 0;

type LocalSeedProject = {
  projectId: string;
  workspaceId?: string;
  name: string;
  description: string | null;
  notes: { noteId: string; title: string; startedAt: string }[];
};

let localSeed: LocalSeedProject[] = [];

function seedLocal(target: StoreState) {
  for (const entry of localSeed) {
    const workspaceId = entry.workspaceId ?? target.workspaces[0].workspaceId;
    if (
      !target.projects.some((project) => project.projectId === entry.projectId)
    ) {
      target.projects.push({
        projectId: entry.projectId,
        workspaceId,
        name: entry.name,
        description: entry.description,
        createdAt: entry.notes.at(-1)?.startedAt ?? "2026-07-01T00:00:00Z",
        updatedAt: entry.notes[0]?.startedAt ?? "2026-07-01T00:00:00Z",
      });
    }
    const template =
      target.notes.find((note) => note.workspaceId === workspaceId) ??
      target.notes[0];
    for (const meeting of entry.notes) {
      if (target.notes.some((note) => note.noteId === meeting.noteId)) continue;
      const startedMs = Date.parse(meeting.startedAt);
      target.notes.push({
        ...structuredClone(template),
        noteId: meeting.noteId,
        projectId: entry.projectId,
        projectName: entry.name,
        workspaceId,
        title: meeting.title,
        createdAt: meeting.startedAt,
        updatedAt: meeting.startedAt,
        meetingStatus: "ENDED",
        meetingStartedAt: meeting.startedAt,
        meetingEndedAt: new Date(startedMs + 40 * 60_000).toISOString(),
        recordedDurationMs: 40 * 60_000,
        activeSessionStartedAt: null,
        pausedAt: null,
        contextTopic: null,
        contextBackground: null,
        autoEnd: null,
      });
    }
  }
}

function reset() {
  idCounter = 100;
  consentFailures = 0;
  mockClock = 0;
  state = isHelpDemoEnabled() ? createHelpDemoState() : createSeedState();
  if (localSeed.length > 0) seedLocal(state);
  sessionOpeners.clear();
  sessionOpeners.set("01K0000000402", MOCK_RECORDER_CLIENT_ID);
  for (const listener of resetListeners) listener();
}

reset();

function pausedAtOf(note: NoteResponseData) {
  if (note.meetingStatus !== "PAUSED") return null;
  return (
    state.sessions
      .filter(
        (session) =>
          session.noteId === note.noteId &&
          session.startedAt !== null &&
          session.endedAt !== null
      )
      .map((session) => session.endedAt as string)
      .sort((a, b) => b.localeCompare(a))[0] ?? null
  );
}

function listNotesWhere(
  match: (note: NoteResponseData) => boolean
): NoteListResponseDataNotesItem[] {
  state.notes.filter(match).forEach((note) => expireReadySessions(note.noteId));
  const notes = state.notes
    .filter(match)
    .sort(
      (a, b) =>
        (b.meetingStartedAt ?? b.createdAt).localeCompare(
          a.meetingStartedAt ?? a.createdAt
        ) || b.noteId.localeCompare(a.noteId)
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
        pausedAt: pausedAtOf(note),
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
}

export const mockDb = {
  reset,
  onReset(listener: () => void) {
    resetListeners.add(listener);
  },

  createAgentChat(input: {
    workspaceId: string;
    title?: string | null;
  }): AgentChatResponseData {
    assertWorkspace(input.workspaceId);

    const now = nextAgentChatTimestamp();
    const chat: MockAgentChat = {
      chatId: nextId(),
      workspaceId: input.workspaceId,
      title: input.title ?? DEFAULT_AGENT_CHAT_TITLE,
      titleSource: input.title ? "USER" : "DEFAULT",
      createdAt: now,
      updatedAt: now,
    };
    state.agentChats.push(chat);
    return copy(omit(chat, ["updatedAt"]));
  },

  listAgentChats(query: { workspaceId: string }) {
    return this.listAllAgentChats(query.workspaceId).slice(
      0,
      AGENT_CHAT_LIST_LIMIT
    );
  },

  listAllAgentChats(workspaceId: string) {
    assertWorkspace(workspaceId);
    return state.agentChats
      .filter((chat) => chat.workspaceId === workspaceId)
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) ||
          b.chatId.localeCompare(a.chatId)
      )
      .map(({ chatId, title, titleSource, updatedAt }) => ({
        chatId,
        title,
        titleSource,
        updatedAt,
      }));
  },

  findNoteBrief(noteId: string) {
    return state.notes.find((note) => note.noteId === noteId) ?? null;
  },

  findProjectBrief(projectId: string) {
    return (
      state.projects.find((project) => project.projectId === projectId) ?? null
    );
  },

  retitleAgentChatByAi(chatId: string) {
    const chat = state.agentChats.find((each) => each.chatId === chatId);
    if (!chat || chat.titleSource !== "QUESTION") return false;
    const question = state.agentChatMessages.find(
      (message) => message.chatId === chatId && message.role === "USER"
    );
    if (!question) return false;
    chat.title = aiTitleFor(unwrapScopeMarkers(question.content));
    chat.titleSource = "AI";
    return true;
  },

  deleteAgentChat(chatId: string) {
    if (!state.agentChats.some((chat) => chat.chatId === chatId)) {
      fail("AGENT_CHAT_NOT_FOUND");
    }
    state.agentChats = state.agentChats.filter(
      (chat) => chat.chatId !== chatId
    );
    state.agentChatMessages = state.agentChatMessages.filter(
      (message) => message.chatId !== chatId
    );
  },

  findAgentChat(chatId: string) {
    return state.agentChats.find((chat) => chat.chatId === chatId) ?? null;
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

  appendAgentChatMessage(
    chatId: string,
    message: Omit<
      AgentChatMessagesResponseDataMessagesItem,
      "createdAt" | "turnId"
    > & { turnId?: string | null }
  ) {
    const createdAt = nextAgentChatTimestamp();
    state.agentChatMessages.push({
      turnId: null,
      ...message,
      chatId,
      createdAt,
    });

    const chat = state.agentChats.find(
      (candidate) => candidate.chatId === chatId
    );
    if (!chat) return;
    chat.updatedAt = createdAt;
    if (message.role === "USER" && chat.titleSource === "DEFAULT") {
      chat.title = unwrapScopeMarkers(message.content)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_AGENT_CHAT_TITLE_LENGTH);
      chat.titleSource = "QUESTION";
    }
  },

  endMeeting(noteId: string): NoteResponseData {
    const note = findNote(noteId);
    if (note.meetingStatus === "NOT_STARTED") fail("MEETING_NOT_STARTED");
    if (note.meetingStatus === "ENDED") fail("MEETING_ALREADY_ENDED");
    if (note.meetingStatus === "IN_PROGRESS") fail("MEETING_RECORDING");
    const endedAt = nextTimestamp();
    note.meetingStatus = "ENDED";
    note.meetingEndedAt = endedAt;
    note.updatedAt = endedAt;
    return this.getNote(noteId);
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
      analysisRunning: true,
      sections: [],
      errorCode: null,
      errorMessage: null,
      retry: null,
    };
    state.analyses.push(analysis);
    return copy(analysis);
  },

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
    const latest = latestAnalysis(noteId) ?? fail("ANALYSIS_JOB_NOT_FOUND");
    if (latest.status === "SUCCEEDED") return copy(latest);
    const shown = [...state.analyses]
      .reverse()
      .find(
        (analysis) =>
          analysis.noteId === noteId && analysis.status === "SUCCEEDED"
      );
    if (!shown) return copy(latest);
    return copy({
      ...shown,
      retry: {
        analysisId: latest.analysisId,
        status: latest.status,
        errorCode: latest.errorCode,
        errorMessage: latest.errorMessage,
      },
    });
  },

  failAnalysis(noteId: string): AnalysisResultResponseData | null {
    const analysis = latestAnalysis(noteId);
    if (!analysis || analysis.status !== "PENDING") return null;
    analysis.status = "FAILED";
    analysis.errorCode = "ANALYSIS_TIMEOUT";
    analysis.errorMessage = "분석이 제한 시간을 초과했습니다.";
    return copy(analysis);
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
    integration.connectedBy = myNameIn(workspaceId);
    integration.connectedAt = nextTimestamp();
    return copy(omit(integration, ["workspaceId"]));
  },

  listAgentDelegations(): AgentDelegationsResponseDataDelegationsItem[] {
    const now = Date.now();
    return copy(
      state.agentDelegations
        .filter((delegation) => delegation.userId === state.user.userId)
        .map((delegation) => omit(delegation, ["userId"]))
        .map((delegation) =>
          delegation.status === "ACTIVE" &&
          Date.parse(delegation.expiresAt) <= now
            ? { ...delegation, status: "EXPIRED" as const }
            : delegation
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  },

  createAgentDelegation(
    workspaceId: string,
    name: string,
    allowTaskChanges = false
  ): {
    delegation: AgentDelegationsResponseDataDelegationsItem;
    token: string;
  } {
    const workspace = assertWorkspace(workspaceId);
    if (!workspace.agentAccessAllowed) fail("AGENT_ACCESS_DISABLED");
    const createdAt = nextTimestamp();
    let seed = idCounter * 2654435761;
    const random = Array.from({ length: 43 }, () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return "ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz0123456789-_".charAt(
        seed % 56
      );
    }).join("");
    const token = `hm_${random}`;
    const delegation: MockAgentDelegation = {
      delegationId: nextId(),
      name,
      workspaceId,
      workspaceName: workspace.name,
      userId: state.user.userId,
      tokenHint: token.slice(0, 10),
      credentialKind: "PERSONAL_TOKEN",
      allowTaskChanges,
      status: "ACTIVE",
      createdAt,
      lastUsedAt: null,
      expiresAt: new Date(
        Date.parse(createdAt) + 90 * 24 * 60 * 60 * 1000
      ).toISOString(),
      revokedAt: null,
      revokeReason: null,
    };
    state.agentDelegations.push(delegation);
    return { delegation: copy(omit(delegation, ["userId"])), token };
  },

  listAgentDelegationUsages(
    delegationId: string,
    afterOccurredAt?: string | null,
    afterUsageId?: string | null
  ): AgentDelegationUsagesResponseData {
    if (
      !state.agentDelegations.some(
        (candidate) =>
          candidate.delegationId === delegationId &&
          candidate.userId === state.user.userId
      )
    )
      fail("AGENT_DELEGATION_NOT_FOUND");
    const cursor =
      afterOccurredAt && afterUsageId
        ? { at: Date.parse(afterOccurredAt), id: afterUsageId }
        : null;
    const rows = state.agentDelegationUsages
      .filter((usage) => usage.delegationId === delegationId)
      .sort(
        (a, b) =>
          Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
          b.usageId.localeCompare(a.usageId)
      )
      .filter((usage) => {
        if (!cursor) return true;
        const at = Date.parse(usage.occurredAt);
        return (
          at < cursor.at || (at === cursor.at && usage.usageId < cursor.id)
        );
      });
    const page = rows.slice(0, AGENT_USAGE_PAGE_SIZE);
    const hasMore = rows.length > AGENT_USAGE_PAGE_SIZE;
    const last = page.at(-1);
    return copy({
      usages: page.map((usage) => omit(usage, ["delegationId"])),
      hasMore,
      nextOccurredAt: hasMore && last ? last.occurredAt : null,
      nextUsageId: hasMore && last ? last.usageId : null,
    });
  },

  getAgentOAuthConsent(consentState: string) {
    const consent = state.agentOAuthConsents[consentState];
    if (!consent) fail("AGENT_OAUTH_REQUEST_NOT_FOUND");
    return {
      clientName: consent.clientName,
      redirectHost: new URL(consent.redirectUri).host,
      scopes: consent.scopes,
    };
  },

  approveAgentOAuthConsent(
    consentState: string,
    workspaceId: string,
    allowTaskChanges = false
  ) {
    const consent = state.agentOAuthConsents[consentState];
    if (!consent) fail("AGENT_OAUTH_REQUEST_NOT_FOUND");
    if (allowTaskChanges && !consent.scopes.includes("mcp:write"))
      fail("BAD_REQUEST");
    const workspace = state.workspaces.find(
      (candidate) => candidate.workspaceId === workspaceId
    );
    if (!workspace) fail("WORKSPACE_NOT_FOUND");
    if (!workspace.agentAccessAllowed) fail("AGENT_ACCESS_DISABLED");
    delete state.agentOAuthConsents[consentState];
    const createdAt = nextTimestamp();
    const delegationId = nextId();
    state.agentDelegations.push({
      delegationId,
      name: consent.clientName.slice(0, 50),
      workspaceId,
      workspaceName: workspace.name,
      userId: state.user.userId,
      tokenHint: null,
      credentialKind: "OAUTH",
      allowTaskChanges,
      status: "ACTIVE",
      createdAt,
      lastUsedAt: null,
      expiresAt: new Date(
        Date.parse(createdAt) + 90 * 24 * 60 * 60 * 1000
      ).toISOString(),
      revokedAt: null,
      revokeReason: null,
    });
    return {
      redirectUri: withQuery(consent.redirectUri, {
        code: `mock-code-${delegationId}`,
        state: consentState,
      }),
    };
  },

  denyAgentOAuthConsent(consentState: string) {
    const consent = state.agentOAuthConsents[consentState];
    if (!consent) fail("AGENT_OAUTH_REQUEST_NOT_FOUND");
    delete state.agentOAuthConsents[consentState];
    return {
      redirectUri: withQuery(consent.redirectUri, {
        error: "access_denied",
        state: consentState,
      }),
    };
  },

  revokeAgentDelegation(delegationId: string): void {
    const delegation = state.agentDelegations.find(
      (candidate) =>
        candidate.delegationId === delegationId &&
        candidate.userId === state.user.userId
    );
    if (!delegation) fail("AGENT_DELEGATION_NOT_FOUND");
    if (delegation.status === "REVOKED") return;
    delegation.status = "REVOKED";
    delegation.revokedAt = nextTimestamp();
    delegation.revokeReason = "USER";
  },

  changeWorkspaceAgentAccess(workspaceId: string, allowed: boolean): void {
    requireWorkspaceAdmin(workspaceId);
    const workspace = assertWorkspace(workspaceId);
    workspace.agentAccessAllowed = allowed;
    if (allowed) return;
    const revokedAt = nextTimestamp();
    for (const delegation of state.agentDelegations) {
      if (
        delegation.workspaceId !== workspaceId ||
        delegation.status === "REVOKED"
      )
        continue;
      delegation.status = "REVOKED";
      delegation.revokedAt = revokedAt;
      delegation.revokeReason = "AGENT_ACCESS_DISABLED";
    }
  },

  listWorkspaceAgentDelegations(
    workspaceId: string
  ): WorkspaceAgentDelegationsResponseDataDelegationsItem[] {
    requireWorkspaceAdmin(workspaceId);
    const now = Date.now();
    return copy(
      state.agentDelegations
        .filter(
          (delegation) =>
            delegation.workspaceId === workspaceId &&
            delegation.status === "ACTIVE" &&
            Date.parse(delegation.expiresAt) > now
        )
        .sort(
          (a, b) =>
            b.createdAt.localeCompare(a.createdAt) ||
            b.delegationId.localeCompare(a.delegationId)
        )
        .map((delegation) => ({
          delegationId: delegation.delegationId,
          name: delegation.name,
          credentialKind: delegation.credentialKind,
          allowTaskChanges: delegation.allowTaskChanges,
          userId: delegation.userId,
          userName: ((member) => (member ? memberView(member).name : ""))(
            state.members.find(
              (member) =>
                member.workspaceId === workspaceId &&
                member.userId === delegation.userId
            )
          ),
          createdAt: delegation.createdAt,
          lastUsedAt: delegation.lastUsedAt,
        }))
    );
  },

  revokeWorkspaceAgentDelegation(
    workspaceId: string,
    delegationId: string
  ): void {
    requireWorkspaceAdmin(workspaceId);
    const delegation = state.agentDelegations.find(
      (candidate) =>
        candidate.delegationId === delegationId &&
        candidate.workspaceId === workspaceId
    );
    if (!delegation) fail("AGENT_DELEGATION_NOT_FOUND");
    if (
      delegation.status !== "ACTIVE" ||
      Date.parse(delegation.expiresAt) <= Date.now()
    )
      return;
    delegation.status = "REVOKED";
    delegation.revokedAt = nextTimestamp();
    delegation.revokeReason = "ADMIN";
  },

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
        .map(memberView)
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
    );
  },

  renameMember(
    workspaceId: string,
    userId: string,
    displayName: string | null
  ) {
    if (userId === state.user.userId) requireWorkspaceMember(workspaceId);
    else requireWorkspaceAdmin(workspaceId);
    const member = state.members.find(
      (m) => m.workspaceId === workspaceId && m.userId === userId
    );
    if (!member) fail("WORKSPACE_MEMBER_NOT_FOUND");
    const name = (displayName ?? "")
      .replace(/[\u0000-\u001F\u007F\u0085\u2028\u2029]+/g, " ")
      .trim();
    if (name.length > 30) fail("BAD_REQUEST");
    member.displayName = name.length > 0 ? name : null;
    const shown = memberView(member).name;
    const projectIds = new Set(
      state.projects
        .filter((project) => project.workspaceId === workspaceId)
        .map((project) => project.projectId)
    );
    for (const note of state.notes) {
      if (!projectIds.has(note.projectId)) continue;
      const participantIds = new Set<string>();
      note.participants = note.participants.map((row) => {
        if (row.userId !== userId) return row;
        participantIds.add(row.participantId);
        return { ...row, name: shown };
      });
      for (const participantId of participantIds) {
        renameSpeaker(note.noteId, participantId, { userId, name: shown });
      }
      if (note.meetingStartedBy?.userId === userId) {
        note.meetingStartedBy = { ...note.meetingStartedBy, name: shown };
      }
    }
    return copy(memberView(member));
  },

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

  removeMember(workspaceId: string, userId: string) {
    requireWorkspaceAdmin(workspaceId);
    if (userId === state.user.userId) fail("BAD_REQUEST");
    const index = state.members.findIndex(
      (m) => m.workspaceId === workspaceId && m.userId === userId
    );
    if (index < 0) fail("WORKSPACE_MEMBER_NOT_FOUND");
    state.members.splice(index, 1);
  },

  leaveWorkspace(workspaceId: string, workspaceName?: unknown) {
    const index = state.members.findIndex(
      (m) => m.workspaceId === workspaceId && m.userId === state.user.userId
    );
    if (index < 0) fail("WORKSPACE_NOT_FOUND");
    assertWorkspaceName(workspaceId, workspaceName);
    const member = state.members[index];
    const admins = state.members.filter(
      (m) => m.workspaceId === workspaceId && m.role === "ADMIN"
    );
    if (member.role === "ADMIN" && admins.length <= 1) {
      fail("LAST_WORKSPACE_ADMIN");
    }
    state.members.splice(index, 1);

    const revokedAt = nextTimestamp();
    for (const delegation of state.agentDelegations) {
      if (
        delegation.workspaceId !== workspaceId ||
        delegation.status !== "ACTIVE"
      ) {
        continue;
      }
      delegation.status = "REVOKED";
      delegation.revokedAt = revokedAt;
      delegation.revokeReason = "MEMBERSHIP_ENDED";
    }

    const leftChats = new Set(
      state.agentChats
        .filter((chat) => chat.workspaceId === workspaceId)
        .map((chat) => chat.chatId)
    );
    state.agentChats = state.agentChats.filter(
      (chat) => !leftChats.has(chat.chatId)
    );
    state.agentChatMessages = state.agentChatMessages.filter(
      (message) => !leftChats.has(message.chatId)
    );

    const workspaceIndex = state.workspaces.findIndex(
      (w) => w.workspaceId === workspaceId
    );
    if (workspaceIndex < 0) return;
    state.workspaces.splice(workspaceIndex, 1);
  },

  deletionPlan() {
    const me = state.user.userId;
    return {
      workspaces: state.workspaces.flatMap((workspace) => {
        const rows = state.members
          .filter((m) => m.workspaceId === workspace.workspaceId)
          .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
        const mine = rows.find((m) => m.userId === me);
        if (!mine) return [];
        const others = rows.filter((m) => m.userId !== me);
        const action =
          others.length === 0
            ? ("DELETE" as const)
            : mine.role !== "ADMIN" || others.some((m) => m.role === "ADMIN")
              ? ("LEAVE" as const)
              : ("TRANSFER_OR_DELETE" as const);
        const candidates =
          action === "TRANSFER_OR_DELETE"
            ? others.map((m) => ({
                userId: m.userId,
                name: memberView(m).name,
                email: m.email,
              }))
            : [];
        return [
          {
            workspaceId: workspace.workspaceId,
            name: workspace.name,
            action,
            successorCandidates: candidates,
            defaultSuccessorUserId: candidates[0]?.userId ?? null,
          },
        ];
      }),
    };
  },

  deleteWorkspace(workspaceId: string, workspaceName?: unknown) {
    requireWorkspaceAdmin(workspaceId);
    assertWorkspaceName(workspaceId, workspaceName);
    removeWorkspace(workspaceId);
  },

  deleteAccount(body: {
    confirmation?: unknown;
    workspaces?: {
      workspaceId: string;
      decision: string;
      successorUserId?: string;
    }[];
    reason?: { code?: unknown; detail?: unknown };
  }) {
    if (
      typeof body.confirmation !== "string" ||
      body.confirmation.trim() !== "회원 탈퇴"
    ) {
      fail("WITHDRAWAL_CONFIRMATION_MISMATCH");
    }
    const detail = body.reason?.detail;
    if (typeof detail === "string" && detail.length > 500) fail("BAD_REQUEST");
    const plan = mockDb.deletionPlan().workspaces;
    const decisions = body.workspaces ?? [];
    for (const row of plan) {
      if (row.action !== "TRANSFER_OR_DELETE") continue;
      const decision = decisions.find((d) => d.workspaceId === row.workspaceId);
      const valid =
        decision?.decision === "DELETE" ||
        (decision?.decision === "TRANSFER" &&
          row.successorCandidates.some(
            (c) => c.userId === decision.successorUserId
          ));
      if (!valid) fail("DELETION_PLAN_CHANGED");
    }
    for (const row of plan) {
      const decision = decisions.find((d) => d.workspaceId === row.workspaceId);
      if (row.action === "DELETE" || decision?.decision === "DELETE") {
        removeWorkspace(row.workspaceId);
        continue;
      }
      if (decision?.decision === "TRANSFER") {
        const successor = state.members.find(
          (m) =>
            m.workspaceId === row.workspaceId &&
            m.userId === decision.successorUserId
        );
        if (successor) successor.role = "ADMIN";
      }
      state.members = state.members.filter(
        (m) =>
          !(m.workspaceId === row.workspaceId && m.userId === state.user.userId)
      );
      state.workspaces = state.workspaces.filter(
        (w) => w.workspaceId !== row.workspaceId
      );
    }
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

    const createdAtMs = Date.now();
    const invitation: MockInvitation = {
      workspaceId,
      invitationId: nextId(),
      inviteeName: null,
      inviteeEmail: email,
      inviteeImage: null,
      inviterName: myNameIn(workspaceId),
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

  acceptInvitationByToken(
    token: string
  ): WorkspaceInvitationActionResponseData {
    const invitation = findInvitation(token);
    expireIfNeeded(invitation);
    if (invitation.status !== "PENDING") fail("INVITATION_NOT_PENDING");
    if (invitation.inviteeEmail !== state.user.email) {
      fail("INVITATION_EMAIL_MISMATCH");
    }
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

    if (
      isSelf &&
      !state.workspaces.some((w) => w.workspaceId === invitation.workspaceId)
    ) {
      state.workspaces.push({
        workspaceId: invitation.workspaceId,
        name:
          state.notifications.find(
            (item) => item.invitation?.invitationId === invitation.invitationId
          )?.invitation?.workspaceName ?? INVITED_WORKSPACE.name,
        description: null,
        role: invitation.role,
        agentAccessAllowed: true,
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

  listNotifications(
    params: {
      filter?: string | null;
      limit?: string | null;
      schema?: string | null;
      afterCreatedAt?: string | null;
      afterNotificationId?: string | null;
    } = {}
  ): NotificationListResponseData {
    const visible = visibleNotifications(params.schema);
    const filtered = visible.filter((item) =>
      params.filter === "UNREAD"
        ? item.readAt === null
        : params.filter === "ACTION_REQUIRED"
          ? item.invitation?.status === "PENDING" &&
            Date.parse(item.invitation.expiresAt) > Date.now()
          : true
    );
    const after = params.afterNotificationId
      ? filtered.filter(
          (item) =>
            item.createdAt < (params.afterCreatedAt ?? "") ||
            (item.createdAt === params.afterCreatedAt &&
              item.notificationId < params.afterNotificationId!)
        )
      : filtered;
    const limit = Number(params.limit) || 50;
    const page = after.slice(0, limit);
    const hasMore = after.length > limit;
    const last = page.at(-1);
    return copy({
      notifications: page,
      unreadCount: visible.filter((item) => item.readAt === null).length,
      hasMore,
      nextCreatedAt: hasMore && last ? last.createdAt : null,
      nextNotificationId: hasMore && last ? last.notificationId : null,
      serverTime: nextTimestamp(),
    });
  },

  unreadNotificationCount(schema?: string | null): number {
    return visibleNotifications(schema).filter((item) => item.readAt === null)
      .length;
  },

  markAllNotificationsRead(upTo: string): { readCount: number } {
    let readCount = 0;
    const readAt = nextTimestamp();
    for (const item of state.notifications) {
      if (item.readAt === null && item.createdAt <= upTo) {
        item.readAt = readAt;
        readCount += 1;
      }
    }
    return { readCount };
  },

  pushNotification(item: NotificationListResponseDataNotificationsItem) {
    const id = item.notificationId;
    if (state.notifications.some((n) => n.notificationId === id)) return;
    state.notifications.push(copy(item));
  },

  arriveNotification(): NotificationListResponseDataNotificationsItem {
    const titles = ["분기 계획 세션", "주간 제품 회의", "고객 인터뷰"];
    const notes = ["01K0000000026", "01K0000000002", "01K0000000005"];
    const turn = state.notifications.length % titles.length;
    const item: NotificationListResponseDataNotificationsItem = {
      notificationId: nextId(),
      type: "ANALYSIS_READY",
      readAt: null,
      createdAt: nextTimestamp(),
      invitation: null,
      payload: analysisReadyPayload(
        state.workspaces[0],
        notes[turn],
        titles[turn],
        false,
        null
      ),
    };
    state.notifications.push(item);
    return copy(item);
  },

  listFeedbacks(): { feedbacks: FeedbackResponseData[] } {
    return copy({
      feedbacks: [...state.feedbacks].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      ),
    });
  },

  createFeedback(request: CreateFeedbackRequest): FeedbackResponseData {
    const feedback: FeedbackResponseData = {
      feedbackId: nextId(),
      kind: request.kind,
      message: request.message.trim(),
      answer: null,
      answeredAt: null,
      answerSeen: false,
      createdAt: nextTimestamp(),
    };
    state.feedbacks.push(feedback);
    return copy(feedback);
  },

  markFeedbackAnswersSeen(): void {
    for (const item of state.feedbacks) {
      if (item.answer !== null) item.answerSeen = true;
    }
  },

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

  updateCurrentUserLanguage(language: "ko" | "en"): CurrentUserResponseData {
    state.user.language = language;
    if (typeof document !== "undefined") {
      document.cookie = `${MOCK_ACCOUNT_LANGUAGE_COOKIE}=${language}; path=/; samesite=lax`;
    }
    return copy(state.user);
  },

  recordConsents(request: RecordConsentRequest): void {
    if (consentFailures > 0) {
      consentFailures -= 1;
      failWith("INTERNAL_ERROR", 500, "잠시 후 다시 시도해 주세요.");
    }
    const current = state.user.consents;
    const outdated = request.consents.some(
      ({ documentType, version }) =>
        current.find((consent) => consent.documentType === documentType)
          ?.currentVersion !== version
    );
    if (outdated) {
      failWith(
        "CONSENT_VERSION_OUTDATED",
        409,
        "약관이 새로 바뀌었습니다. 다시 확인한 뒤 동의해 주세요."
      );
    }
    const agreed = new Set(
      request.consents.map((consent) => consent.documentType)
    );
    const consents = current.map((consent) =>
      agreed.has(consent.documentType) ? { ...consent, agreed: true } : consent
    );
    state.user = {
      ...state.user,
      consents,
      consentRequired: consents.some((consent) => !consent.agreed),
    };
  },

  failNextConsents(count: number): void {
    consentFailures = count;
  },

  requireConsent(): void {
    state.user = {
      ...state.user,
      consentRequired: true,
      consents: state.user.consents.map((consent) => ({
        ...consent,
        agreed: false,
      })),
    };
  },

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
      agentAccessAllowed: true,
    };
    state.workspaces.push(workspace);
    attachWorkspaceState(workspace.workspaceId, workspace.role);
    const createdAt = nextTimestamp();
    state.projects.push({
      projectId: nextId(),
      workspaceId: workspace.workspaceId,
      name: "일반",
      description: null,
      createdAt,
      updatedAt: createdAt,
    });
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

  applyLocalSeed(list: LocalSeedProject[]) {
    localSeed = list;
    seedLocal(state);
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
    return listNotesWhere((note) => note.projectId === projectId);
  },

  listWorkspaceNotes(workspaceId: string): NoteListResponseDataNotesItem[] {
    assertWorkspace(workspaceId);
    requireWorkspaceMember(workspaceId);
    const projectIds = new Set(
      state.projects
        .filter((project) => project.workspaceId === workspaceId)
        .map((project) => project.projectId)
    );
    return listNotesWhere((note) => projectIds.has(note.projectId));
  },

  createNote(projectId: string, input: Partial<NoteRequest>): NoteResponseData {
    const project = assertProject(projectId);
    const createdAt = nextTimestamp();
    const note: NoteResponseData = {
      noteId: nextId(),
      projectId,
      workspaceId: project.workspaceId,
      projectName: project.name,
      title: input.title?.trim() || "제목 없는 노트",
      createdAt,
      updatedAt: createdAt,
      meetingStatus: "NOT_STARTED",
      meetingStartedAt: null,
      meetingEndedAt: null,
      recordedDurationMs: 0,
      activeSessionStartedAt: null,
      meetingStartedBy: null,
      contextTopic: null,
      contextBackground: null,
      autoEnd: null,
      pausedAt: null,
      participants: [
        {
          participantId: nextId(),
          userId: state.user.userId,
          guestId: null,
          name: myNameIn(project.workspaceId),
          email: state.user.email,
          image: state.user.image,
        },
      ],
    };
    state.notes.push(note);
    return copy(note);
  },

  replaceNoteParticipants(
    noteId: string,
    userIds: string[],
    expectedUserIds?: string[]
  ) {
    const note = findNote(noteId);
    const project = state.projects.find(
      (row) => row.projectId === note.projectId
    );
    const workspaceMembers = state.members
      .filter((member) => member.workspaceId === project?.workspaceId)
      .map(memberView);
    const unique = [...new Set(userIds)];
    const currentUserIds = note.participants
      .map((row) => row.userId)
      .filter((userId): userId is string => Boolean(userId));
    rejectIfChanged(expectedUserIds, currentUserIds, unique);
    if (
      unique.some(
        (userId) =>
          !workspaceMembers.some((m) => m.userId === userId) &&
          !currentUserIds.includes(userId)
      )
    ) {
      fail("NOT_WORKSPACE_MEMBER");
    }
    const keptGuests = note.participants.filter((row) => row.guestId !== null);
    const existingByUserId = new Map(
      note.participants
        .filter((row) => row.userId !== null)
        .map((row) => [row.userId as string, row])
    );
    const rebuildSource = [
      ...workspaceMembers,
      ...note.participants
        .filter(
          (row) =>
            row.userId !== null &&
            !workspaceMembers.some((member) => member.userId === row.userId)
        )
        .map((row) => ({
          userId: row.userId as string,
          name: row.name,
          email: row.email,
          image: row.image,
        })),
    ];
    const accounts = rebuildSource
      .filter((member) => unique.includes(member.userId))
      .map(({ userId, name, email, image }) => {
        const existing = existingByUserId.get(userId);
        return {
          participantId: existing?.participantId ?? nextId(),
          userId,
          guestId: null,
          name,
          email,
          image,
        };
      });
    const removedAccounts = note.participants.filter(
      (row) => row.userId !== null && !unique.includes(row.userId)
    );
    note.participants = sortParticipants([...accounts, ...keptGuests]);
    detachSpeakers(
      noteId,
      removedAccounts.map((row) => row.participantId)
    );
    return copy({ participants: note.participants });
  },

  createNoteGuestParticipant(noteId: string, displayName: string) {
    const note = findNote(noteId);
    const workspaceId = state.projects.find(
      (row) => row.projectId === note.projectId
    )?.workspaceId;
    if (!workspaceId) fail("NOTE_NOT_FOUND");

    const name = displayName
      .replace(/[\u0000-\u001F\u007F\u0085\u2028\u2029]+/g, " ")
      .trim();
    if (name.length === 0 || name.length > 100) fail("BAD_REQUEST");

    const guest: MockWorkspaceGuest = {
      guestId: nextId(),
      workspaceId,
      displayName: name,
      createdAt: nextTimestamp(),
    };
    state.workspaceGuests.push(guest);
    const participantId = nextId();
    note.participants = sortParticipants([
      ...note.participants,
      {
        participantId,
        userId: null,
        guestId: guest.guestId,
        name,
        email: null,
        image: null,
      },
    ]);
    return copy({ participantId, participants: note.participants });
  },

  replaceNoteGuestParticipants(
    noteId: string,
    guestIds: string[],
    expectedGuestIds?: string[]
  ) {
    const note = findNote(noteId);
    const workspaceId = state.projects.find(
      (row) => row.projectId === note.projectId
    )?.workspaceId;
    const unique = [...new Set(guestIds)];
    rejectIfChanged(
      expectedGuestIds,
      note.participants
        .map((row) => row.guestId)
        .filter((guestId): guestId is string => Boolean(guestId)),
      unique
    );
    const guests = unique.map((guestId) => {
      const guest = state.workspaceGuests.find(
        (row) => row.guestId === guestId && row.workspaceId === workspaceId
      );
      if (!guest) fail("WORKSPACE_GUEST_NOT_FOUND");
      return guest;
    });

    const keptAccounts = note.participants.filter((row) => row.userId !== null);
    const existingByGuestId = new Map(
      note.participants
        .filter((row) => row.guestId !== null)
        .map((row) => [row.guestId as string, row])
    );
    const next = guests.map((guest) => ({
      participantId:
        existingByGuestId.get(guest.guestId)?.participantId ?? nextId(),
      userId: null,
      guestId: guest.guestId,
      name: guest.displayName,
      email: null,
      image: null,
    }));
    const removed = note.participants.filter(
      (row) => row.guestId !== null && !unique.includes(row.guestId)
    );
    note.participants = sortParticipants([...keptAccounts, ...next]);
    detachSpeakers(
      noteId,
      removed.map((row) => row.participantId)
    );
    return copy({ participants: note.participants });
  },

  createWorkspaceGuest(workspaceId: string, displayName: string) {
    requireWorkspaceMember(workspaceId);
    const name = displayName
      .replace(/[\u0000-\u001F\u007F\u0085\u2028\u2029]+/g, " ")
      .trim();
    if (name.length === 0 || name.length > 100) fail("BAD_REQUEST");

    const guest: MockWorkspaceGuest = {
      guestId: nextId(),
      workspaceId,
      displayName: name,
      createdAt: nextTimestamp(),
    };
    state.workspaceGuests.push(guest);
    return copy({
      guestId: guest.guestId,
      displayName: name,
      noteCount: 0,
      createdAt: guest.createdAt,
    });
  },

  renameWorkspaceGuest(
    workspaceId: string,
    guestId: string,
    displayName: string
  ) {
    requireWorkspaceAdmin(workspaceId);
    const guest = state.workspaceGuests.find(
      (row) => row.guestId === guestId && row.workspaceId === workspaceId
    );
    if (!guest) fail("WORKSPACE_GUEST_NOT_FOUND");

    const name = displayName
      .replace(/[\u0000-\u001F\u007F\u0085\u2028\u2029]+/g, " ")
      .trim();
    if (name.length === 0 || name.length > 100) fail("BAD_REQUEST");

    guest.displayName = name;
    for (const note of state.notes) {
      const participantIds = new Set<string>();
      note.participants = note.participants.map((row) => {
        if (row.guestId !== guestId) return row;
        participantIds.add(row.participantId);
        return { ...row, name };
      });
      for (const participantId of participantIds) {
        renameSpeaker(note.noteId, participantId, { userId: "", name });
      }
    }
    return copy({
      guestId,
      displayName: name,
      noteCount: state.notes.filter((note) =>
        note.participants.some((row) => row.guestId === guestId)
      ).length,
      createdAt: guest.createdAt,
    });
  },

  deleteWorkspaceGuest(workspaceId: string, guestId: string) {
    requireWorkspaceAdmin(workspaceId);
    const guest = state.workspaceGuests.find(
      (row) => row.guestId === guestId && row.workspaceId === workspaceId
    );
    if (!guest) fail("WORKSPACE_GUEST_NOT_FOUND");

    let affectedNoteCount = 0;
    for (const note of state.notes) {
      const removed = note.participants.filter(
        (row) => row.guestId === guestId
      );
      if (removed.length === 0) continue;
      affectedNoteCount += 1;
      note.participants = note.participants.filter(
        (row) => row.guestId !== guestId
      );
      detachSpeakers(
        note.noteId,
        removed.map((row) => row.participantId)
      );
    }
    state.workspaceGuests = state.workspaceGuests.filter(
      (row) => row.guestId !== guestId
    );
    return copy({ affectedNoteCount });
  },

  previewWorkspaceGuestLink(
    workspaceId: string,
    guestId: string,
    targetUserId: string
  ) {
    return copy(
      guestLinkResultOf(planGuestLink(workspaceId, guestId, targetUserId))
    );
  },

  linkWorkspaceGuest(
    workspaceId: string,
    guestId: string,
    targetUserId: string
  ) {
    const plan = planGuestLink(workspaceId, guestId, targetUserId);
    const target = state.members.find(
      (row) => row.workspaceId === workspaceId && row.userId === targetUserId
    )!;

    for (const entry of plan.changed) {
      const note = findNote(entry.noteId);
      if (entry.accountParticipantId && !entry.guestHasSpeaker) {
        note.participants = note.participants.filter(
          (row) => row.participantId !== entry.guestParticipantId
        );
      } else {
        if (entry.accountParticipantId) {
          repointSpeakers(
            entry.noteId,
            entry.accountParticipantId,
            entry.guestParticipantId
          );
        }
        note.participants = note.participants
          .filter((row) => row.participantId !== entry.accountParticipantId)
          .map((row) =>
            row.participantId === entry.guestParticipantId
              ? {
                  ...row,
                  userId: targetUserId,
                  guestId: null,
                  name: memberView(target).name,
                  email: target.email,
                  image: target.image,
                }
              : row
          );
        renameSpeaker(entry.noteId, entry.guestParticipantId, target);
      }
      note.participants = sortParticipants(note.participants);
    }

    state.workspaceGuests = state.workspaceGuests.filter(
      (row) => row.guestId !== guestId
    );
    return copy(guestLinkResultOf(plan));
  },

  listWorkspaceGuests(workspaceId: string) {
    requireWorkspaceMember(workspaceId);
    const guests = state.workspaceGuests
      .filter((guest) => guest.workspaceId === workspaceId)
      .map((guest) => ({
        guestId: guest.guestId,
        displayName: guest.displayName,
        noteCount: state.notes.filter((note) =>
          note.participants.some((row) => row.guestId === guest.guestId)
        ).length,
        createdAt: guest.createdAt,
      }))
      .sort(
        (a, b) =>
          a.displayName.localeCompare(b.displayName) ||
          a.guestId.localeCompare(b.guestId)
      );
    return copy({ guests });
  },

  getNote(noteId: string): NoteResponseData {
    expireReadySessions(noteId);
    const note = findNote(noteId);
    return copy({
      ...note,
      pausedAt: pausedAtOf(note),
      autoEnd:
        note.meetingStatus === "PAUSED" || note.autoEnd?.endedBy === "SYSTEM"
          ? note.autoEnd
          : null,
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

  updateNoteContext(
    noteId: string,
    input: { topic?: string | null; background?: string | null }
  ): NoteResponseData {
    const note = findNote(noteId);
    if (note.meetingStatus === "ENDED") fail("MEETING_ALREADY_ENDED");
    const topic = input.topic?.trim() || null;
    const background = input.background?.trim() || null;
    if ((topic?.length ?? 0) > 200 || (background?.length ?? 0) > 1000)
      fail("BAD_REQUEST");
    note.contextTopic = topic;
    note.contextBackground = background;
    note.updatedAt = nextTimestamp();
    return this.getNote(noteId);
  },

  deleteNote(noteId: string) {
    findNote(noteId);
    const sessionIds = new Set(
      state.sessions
        .filter((row) => row.noteId === noteId)
        .map((row) => row.sessionId)
    );
    state.notes = state.notes.filter((row) => row.noteId !== noteId);
    state.sessions = state.sessions.filter((row) => row.noteId !== noteId);
    state.segments = state.segments.filter(
      (row) => !sessionIds.has(row.transcriptionSessionId)
    );
    state.analyses = state.analyses.filter((row) => row.noteId !== noteId);
    state.agentChats
      .filter((chat) => {
        const questions = state.agentChatMessages.filter(
          (message) => message.chatId === chat.chatId && message.role === "USER"
        );
        return (
          questions.length > 0 &&
          questions.every(
            (message) =>
              message.scope?.length === 1 &&
              message.scope[0].kind === "NOTE" &&
              message.scope[0].id === noteId
          )
        );
      })
      .forEach((chat) => mockDb.deleteAgentChat(chat.chatId));
  },

  createSession(
    noteId: string,
    clientInstanceId?: string
  ): TranscriptionSessionResponseData {
    const note = findNote(noteId);
    assertWorkspace(assertProject(note.projectId).workspaceId);
    if (note.meetingStatus === "ENDED") fail("MEETING_ALREADY_ENDED");
    expireReadySessions(noteId);
    for (const session of state.sessions) {
      if (
        session.noteId === noteId &&
        ACTIVE_STATUSES.has(session.status) &&
        clientInstanceId !== undefined &&
        sessionOpeners.get(session.sessionId) === clientInstanceId
      ) {
        session.status = "INTERRUPTED";
        session.endedAt = new Date().toISOString();
        session.endReason = "HEARTBEAT_TIMEOUT";
      }
    }
    if (
      state.sessions.some(
        (session) =>
          session.noteId === noteId && ACTIVE_STATUSES.has(session.status)
      )
    ) {
      fail("ACTIVE_TRANSCRIPTION_SESSION");
    }
    const session: MockSession = {
      sessionId: nextId(),
      noteId,
      status: "READY",
      firstRecording: false,
      readyExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      startedAt: null,
      endedAt: null,
      endReason: null,
    };
    note.meetingStartedBy ??= {
      userId: state.user.userId,
      name: myNameIn(
        state.projects.find((project) => project.projectId === note.projectId)
          ?.workspaceId
      ),
      email: state.user.email,
      image: state.user.image,
    };
    note.meetingStatus = "IN_PROGRESS";
    state.sessions.push(session);
    if (clientInstanceId)
      sessionOpeners.set(session.sessionId, clientInstanceId);
    return copy(session) as unknown as TranscriptionSessionResponseData;
  },

  getSession(sessionId: string): TranscriptionSessionResponseData {
    const session = findSession(sessionId);
    assertWorkspace(
      assertProject(findNote(session.noteId).projectId).workspaceId
    );
    expireReadySessions(session.noteId);
    return copy(session) as unknown as TranscriptionSessionResponseData;
  },

  getCurrentSession(
    noteId: string
  ): Pick<
    TranscriptionSessionResponseData,
    "sessionId" | "noteId" | "status" | "readyExpiresAt" | "startedAt"
  > | null {
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
          status: session.status as TranscriptionSessionResponseData["status"],
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

  assignSpeaker(
    noteId: string,
    label: string,
    target: {
      participantId?: string | null;
      userId?: string | null;
      guestId?: string | null;
    }
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

    const participant = resolveOrJoinParticipant(note, target);

    const speakers = diarization.speakers.map((row) => {
      if (row.label === label) {
        return {
          ...row,
          assignedParticipantId: participant?.participantId ?? null,
          assignedName: participant?.name ?? null,
          confirmed: true,
        };
      }
      return row;
    });
    state.diarizations.set(noteId, { ...diarization, speakers });

    for (const segment of segmentsOfNote(noteId)) {
      if (segment.speakerLabel === label && segment.assignedParticipantId) {
        segment.assignedParticipantId = null;
      }
    }
    return copy(speakers);
  },

  assignSegmentSpeaker(
    noteId: string,
    segmentId: string,
    target: {
      participantId?: string | null;
      userId?: string | null;
      guestId?: string | null;
    }
  ): { segmentId: string; assignedParticipantId: string | null } {
    const note = findNote(noteId);
    const sessionIds = new Set(
      state.sessions
        .filter((session) => session.noteId === noteId)
        .map((session) => session.sessionId)
    );
    const segment = state.segments.find(
      (row) =>
        row.segmentId === segmentId &&
        sessionIds.has(row.transcriptionSessionId)
    );
    if (!segment) fail("TRANSCRIPT_SEGMENT_NOT_FOUND");
    if (!segment.speakerLabel) fail("SEGMENT_NOT_DIARIZED");

    const participant = resolveOrJoinParticipant(note, target);
    if (!participant) {
      segment.assignedParticipantId = null;
      return { segmentId, assignedParticipantId: null };
    }
    segment.assignedParticipantId = participant.participantId;
    return { segmentId, assignedParticipantId: participant.participantId };
  },

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
        seal: note.meetingStatus === "ENDED" ? "COMPLETE" : "OPEN",
        durationMs,
        audioRetained: sessions.some((session) => session.startedAt !== null),
      },
      diarization: state.diarizations.get(noteId) ?? {
        status: "NOT_REQUESTED",
        speakers: [],
      },
      segments,
      gaps: [...gaps, ...(state.extraGaps.get(noteId) ?? [])].sort(
        (a, b) => a.startedAtMs - b.startedAtMs
      ),
      transcriptGaps: state.transcriptGaps.get(noteId) ?? [],
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
          assignedParticipantId: segment.assignedParticipantId ?? null,
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
      speakerLabel: null,
      assignedParticipantId: null,
      ...input,
    };
    state.segments.push(segment);
    return copy(segment);
  },
};
