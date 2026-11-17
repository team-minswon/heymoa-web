import { HttpResponse, http } from "msw";
import { billingMock } from "@/lib/mocks/billing";
import { mockDb } from "@/lib/mocks/db";
import { meetingFlow } from "@/lib/mocks/meeting-flow";
import { agentChatTurnState, runningTurnOf } from "@/lib/mocks/sse-handler";
import {
  LIVE_AGENDA_NOTE_ID,
  liveAgendaProposals,
} from "@/lib/mocks/live-agendas";
import {
  CONTEXT_DEMO_NOTE_ID,
  CONTEXT_FAILING_NOTE_ID,
  CONTEXT_SYNTHETIC_LEDGER_NOTE_ID,
  CONTEXT_SNAPSHOT,
  CONTEXT_SWAP_FILLED,
  CONTEXT_SWAP_NOTE_ID,
  CONTEXT_SWAP_SNAPSHOT,
  CONTEXT_TIMELINE,
  isSwapFilled,
} from "@/lib/mocks/proposals";
import SYNTHETIC_LEDGER_SNAPSHOT from "@/lib/notes/proposals/__fixtures__/synthetic-ledger-snapshot.json";

import { getGetAuthSessionMockHandler } from "@/lib/api/generated/auth/auth.msw";
import { getGetCurrentUserMockHandler } from "@/lib/api/generated/users/users.msw";
import { getGetNotificationSettingsMockHandler } from "@/lib/api/generated/notification-settings/notification-settings.msw";
import { getGetWorkspacesMockHandler } from "@/lib/api/generated/workspaces/workspaces.msw";
import { getGetNotificationsMockHandler } from "@/lib/api/generated/notifications/notifications.msw";

import type {
  AdminFeedbackListResponseDataFeedbacksItem,
  AdminUserListResponseDataUsersItem,
  BillingReviewListResponseDataReviewsItem,
  NotificationSettingsResponse,
  NotificationSettingsResponseDataMarketingEmail,
  CreateFeedbackRequest,
  CreateWorkspaceRequest,
  NoteListResponseData,
  NoteListResponseDataNotesItem,
  ProjectRequest,
  NoteRequest,
  RecordConsentRequest,
  UpdateWorkspaceRequest,
} from "@/lib/api/generated/models";
import { failWith, respond } from "@/lib/mocks/mock-envelope";
import { isEmail } from "@/lib/notes/share-mail/recipients";
import {
  emitChatsChanged,
  emitNotificationsChanged,
} from "@/lib/mocks/user-events";

function id(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : String(value ?? "");
}

const INVITATION_NOT_FOUND_CODES = new Set([
  "INVITATION_NOT_FOUND",
  "WORKSPACE_NOT_FOUND",
]);

const INVITATION_FORBIDDEN_CODES = new Set(["INVITATION_EMAIL_MISMATCH"]);

const INVITATION_ERROR_MESSAGES: Record<string, string> = {
  ALREADY_WORKSPACE_MEMBER: "이미 워크스페이스 멤버입니다.",
  INVITATION_EXPIRED: "만료된 초대입니다.",
  INVITATION_EMAIL_MISMATCH: "초대 대상 이메일이 아닙니다.",
  DUPLICATE_PENDING_INVITATION: "이미 대기 중인 초대가 있습니다.",
};

const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  NOTE_NOT_FOUND: "노트를 찾을 수 없습니다.",
  WORKSPACE_NOT_FOUND: "워크스페이스를 찾을 수 없습니다.",
  PROJECT_NOT_FOUND: "프로젝트를 찾을 수 없습니다.",
  NOT_WORKSPACE_MEMBER: "워크스페이스 멤버만 참여자로 등록할 수 있습니다.",
  SPEAKER_LABEL_NOT_FOUND: "그 화자를 찾을 수 없습니다.",
  DIARIZATION_NOT_MAPPED: "화자 분리가 아직 끝나지 않았습니다.",
  PARTICIPANT_NOT_IN_NOTE: "이 회의의 화자로 지정할 수 없는 대상입니다.",
  TRANSCRIPT_SEGMENT_NOT_FOUND: "그 발화를 찾을 수 없습니다.",
  SEGMENT_NOT_DIARIZED: "화자가 나뉘지 않은 발화입니다.",
  WORKSPACE_GUEST_NOT_FOUND: "임시 참여자를 찾을 수 없습니다.",
  WORKSPACE_MEMBER_NOT_FOUND: "워크스페이스 멤버를 찾을 수 없습니다.",
  CONCURRENT_GUEST_LINK: "연동 중에 회의가 바뀌었습니다. 다시 시도해 주세요.",
  NOTE_PARTICIPANTS_CONFLICT:
    "참여자 목록이 그 사이 바뀌었습니다. 다시 읽은 뒤 저장해 주세요.",
  WORKSPACE_ACCESS_DENIED: "워크스페이스를 변경할 권한이 없습니다.",
  BAD_REQUEST: "잘못된 요청입니다.",
  AGENT_DELEGATION_NOT_FOUND: "연결을 찾을 수 없습니다.",
  AGENT_OAUTH_REQUEST_NOT_FOUND:
    "연결 요청을 찾을 수 없습니다. 에이전트에서 다시 연결해 주세요.",
  AGENT_ACCESS_DISABLED:
    "이 워크스페이스는 외부 에이전트 연결이 꺼져 있습니다.",
  MEETING_RECORDING: "기록 중인 회의는 일시정지한 뒤 종료할 수 있습니다.",
  MEETING_ALREADY_ENDED: "이미 종료된 회의입니다.",
};

const SESSION_CONFLICTS: Record<string, string> = {
  ACTIVE_TRANSCRIPTION_SESSION: "이미 진행 가능한 스크립트 세션이 있습니다.",
  MEETING_ALREADY_ENDED: "이미 종료된 회의입니다.",
};

const FORBIDDEN_CODES = new Set([
  "NOT_MEETING_STARTER",
  "WORKSPACE_ACCESS_DENIED",
  "AGENT_ACCESS_DISABLED",
]);

const NOT_FOUND_CODES = new Set([
  "AGENT_DELEGATION_NOT_FOUND",
  "AGENT_OAUTH_REQUEST_NOT_FOUND",
  "NOTE_NOT_FOUND",
  "WORKSPACE_NOT_FOUND",
  "PROJECT_NOT_FOUND",
  "TRANSCRIPTION_SESSION_NOT_FOUND",
  "ANALYSIS_JOB_NOT_FOUND",
  "INTEGRATION_NOT_FOUND",
  "NOTIFICATION_NOT_FOUND",
  "AGENT_CHAT_NOT_FOUND",
  "SPEAKER_LABEL_NOT_FOUND",
  "WORKSPACE_GUEST_NOT_FOUND",
  "WORKSPACE_MEMBER_NOT_FOUND",
  "TRANSCRIPT_SEGMENT_NOT_FOUND",
]);

const BAD_REQUEST_CODES = new Set(["NOT_WORKSPACE_MEMBER", "BAD_REQUEST"]);

const NOT_WORKSPACE_MEMBER = {
  code: "NOT_WORKSPACE_MEMBER",
  message: "워크스페이스 멤버만 참여자로 등록할 수 있습니다.",
  status: 400,
} as const;

const KNOWN_CODES = new Set([
  ...NOT_FOUND_CODES,
  ...BAD_REQUEST_CODES,
  ...FORBIDDEN_CODES,
  ...INVITATION_NOT_FOUND_CODES,
  "PROJECT_HAS_NOTES",
  "NOT_MEETING_STARTER",
  "DIARIZATION_NOT_MAPPED",
  "PARTICIPANT_NOT_IN_NOTE",
  "SEGMENT_NOT_DIARIZED",
  "CONCURRENT_GUEST_LINK",
  "NOTE_PARTICIPANTS_CONFLICT",
  "MEETING_ALREADY_ENDED",
]);

function statusOf(code: string) {
  if (FORBIDDEN_CODES.has(code)) return 403;
  if (NOT_FOUND_CODES.has(code)) return 404;
  if (BAD_REQUEST_CODES.has(code)) return 400;
  if (code === "PARTICIPANT_NOT_IN_NOTE") return 422;
  return 409;
}

const ADMIN_USERS: AdminUserListResponseDataUsersItem[] = [
  {
    userId: "0HZX2K7M9Q4AM",
    name: "김하늘",
    email: "haneul@example.com",
    language: "ko",
    createdAt: "2026-11-12T03:00:00Z",
    firstRecordingAt: "2026-11-12T04:00:00Z",
    lastLoginAt: "2026-11-13T09:00:00Z",
    lastActiveAt: "2026-11-14T01:00:00Z",
    meetingCount: 3,
    lastMeetingAt: "2026-11-13T10:00:00Z",
    workspaceCount: 1,
    teamRecorded: true,
    testWorkspaceMember: false,
    emailMuted: false,
    onboardingMailSentAt: "2026-11-13T00:00:00Z",
  },
  {
    userId: "0HZX2K7M9Q4AK",
    name: "이도윤",
    email: "doyun@example.com",
    language: null,
    createdAt: "2026-11-10T03:00:00Z",
    firstRecordingAt: null,
    lastLoginAt: null,
    lastActiveAt: null,
    meetingCount: 0,
    lastMeetingAt: null,
    workspaceCount: 0,
    teamRecorded: false,
    testWorkspaceMember: false,
    emailMuted: true,
    onboardingMailSentAt: null,
  },
];
const ADMIN_FEEDBACKS: AdminFeedbackListResponseDataFeedbacksItem[] = [
  {
    feedbackId: "0HZX2K7M9Q4AJ",
    kind: "QUESTION",
    message: "녹음 파일을 내려받을 수 있나요?",
    createdAt: "2026-11-14T02:00:00Z",
    answer: "회의 노트의 더보기 메뉴에서 내려받을 수 있습니다.",
    answeredAt: "2026-11-14T03:00:00Z",
    answerSeenAt: "2026-11-14T04:00:00Z",
    userId: "0HZX2K7M9Q4AM",
    name: "김하늘",
    email: "haneul@example.com",
  },
  {
    feedbackId: "0HZX2K7M9Q4AH",
    kind: "INCIDENT",
    message: "회의가 끝났는데 요약이 안 보여요",
    createdAt: "2026-11-13T02:00:00Z",
    answer: null,
    answeredAt: null,
    answerSeenAt: null,
    userId: "0HZX2K7M9Q4AG",
    name: null,
    email: null,
  },
];

const BILLING_REVIEWS: BillingReviewListResponseDataReviewsItem[] = [
  {
    kind: "ATTEMPT",
    id: "0P00000000091",
    status: "UNKNOWN",
    reason: "PG_RESULT_UNKNOWN",
    amountKrw: 24900,
    orderId: "HM0P00000000091",
    subscriptionId: "0S00000000091",
    workspaceId: "01K0000000000",
    createdAt: "2026-11-14T02:00:00Z",
    ageSeconds: 3600,
  },
  {
    kind: "KEY_DELETION",
    id: "0M00000000091",
    status: "DELETE_FAILED",
    reason: null,
    amountKrw: null,
    orderId: null,
    subscriptionId: null,
    workspaceId: null,
    createdAt: "2026-11-13T02:00:00Z",
    ageSeconds: 90000,
  },
];

function adminPage<T>(
  request: Request,
  rows: T[],
  body: (page: T[], next: T | null) => object
) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  const page = rows.slice(0, limit);
  const next = rows.length > limit ? page[page.length - 1] : null;
  return HttpResponse.json({
    success: true,
    data: { ...body(page, next), hasMore: next !== null },
    error: null,
  });
}

function commandResult<T>(run: () => T, okStatus = 200) {
  try {
    return HttpResponse.json(
      { success: true, data: run(), error: null },
      { status: okStatus }
    );
  } catch (error) {
    const code = (error as Error).message;
    return HttpResponse.json(
      {
        success: false,
        data: null,
        error: {
          code,
          message: CONTRACT_ERROR_MESSAGES[code] ?? code,
          details: null,
        },
      },
      {
        status: FORBIDDEN_CODES.has(code)
          ? 403
          : NOT_FOUND_CODES.has(code)
            ? 404
            : 409,
      }
    );
  }
}

const BAD_REQUEST = {
  code: "BAD_REQUEST",
  message: "잘못된 요청입니다.",
  status: 400,
} as const;

function notFound(code: string, message: string) {
  return { code, message, status: 404 } as const;
}

async function resultOf<T>(
  run: () => T | Promise<T>,
  onError: { code: string; message: string; status: number },
  okStatus = 200
) {
  try {
    return HttpResponse.json(
      { success: true, data: await run(), error: null },
      { status: okStatus }
    );
  } catch (error) {
    const thrown = error instanceof Error ? error.message : "";
    const code = KNOWN_CODES.has(thrown) ? thrown : onError.code;
    return HttpResponse.json(
      {
        success: false,
        data: null,
        error: {
          code,
          message:
            code === onError.code
              ? onError.message
              : (CONTRACT_ERROR_MESSAGES[code] ?? code),
          details: null,
        },
      },
      { status: code === onError.code ? onError.status : statusOf(code) }
    );
  }
}

const MEMBER_ERROR_MESSAGES: Record<string, string> = {
  WORKSPACE_MEMBER_NOT_FOUND: "워크스페이스 멤버를 찾을 수 없습니다.",
  WORKSPACE_NOT_FOUND: "워크스페이스를 찾을 수 없습니다.",
  LAST_WORKSPACE_ADMIN: "워크스페이스에는 관리자가 최소 한 명 있어야 합니다.",
  WORKSPACE_ACCESS_DENIED: "워크스페이스를 변경할 권한이 없습니다.",
  BAD_REQUEST: "잘못된 요청입니다.",
  AGENT_DELEGATION_NOT_FOUND: "연결을 찾을 수 없습니다.",
  WORKSPACE_NAME_MISMATCH:
    "워크스페이스 이름이 맞지 않습니다. 다시 입력해 주세요.",
  WITHDRAWAL_CONFIRMATION_MISMATCH:
    "확인 문구가 맞지 않습니다. 「회원 탈퇴」를 정확히 입력해 주세요.",
  DELETION_PLAN_CHANGED:
    "그사이 워크스페이스 상황이 바뀌었습니다. 목록을 다시 확인해 주세요.",
  RECORDING_IN_PROGRESS:
    "녹음 중인 회의가 있습니다. 녹음을 끝낸 뒤 다시 시도해 주세요.",
};

const MEMBER_NOT_FOUND_CODES = new Set([
  "WORKSPACE_MEMBER_NOT_FOUND",
  "WORKSPACE_NOT_FOUND",
  "AGENT_DELEGATION_NOT_FOUND",
]);
const MEMBER_FORBIDDEN_CODES = new Set(["WORKSPACE_ACCESS_DENIED"]);
const MEMBER_BAD_REQUEST_CODES = new Set([
  "BAD_REQUEST",
  "WORKSPACE_NAME_MISMATCH",
  "WITHDRAWAL_CONFIRMATION_MISMATCH",
]);

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  return ((await request.json().catch(() => null)) ?? {}) as Record<
    string,
    unknown
  >;
}

async function memberResult(run: () => void | Promise<void>) {
  try {
    await run();
    return new HttpResponse(null, { status: 204 });
  } catch (error) {
    const code = (error as Error).message;
    return HttpResponse.json(
      {
        success: false,
        data: null,
        error: {
          code,
          message: MEMBER_ERROR_MESSAGES[code] ?? code,
          details: null,
        },
      },
      {
        status: MEMBER_NOT_FOUND_CODES.has(code)
          ? 404
          : MEMBER_FORBIDDEN_CODES.has(code)
            ? 403
            : MEMBER_BAD_REQUEST_CODES.has(code)
              ? 400
              : 409,
      }
    );
  }
}

function notified(response: Response) {
  if (response.ok) emitNotificationsChanged();
  return response;
}

function invitationResult<T>(run: () => T, okStatus = 200) {
  try {
    return HttpResponse.json(
      { success: true, data: run(), error: null },
      { status: okStatus }
    );
  } catch (error) {
    const code = (error as Error).message;
    return HttpResponse.json(
      {
        success: false,
        data: null,
        error: {
          code,
          message: INVITATION_ERROR_MESSAGES[code] ?? code,
          details: null,
        },
      },
      {
        status: INVITATION_NOT_FOUND_CODES.has(code)
          ? 404
          : INVITATION_FORBIDDEN_CODES.has(code)
            ? 403
            : 409,
      }
    );
  }
}

function pageOfNotes(
  notes: NoteListResponseDataNotesItem[],
  url: URL
): NoteListResponseData {
  const limit = Number(url.searchParams.get("limit")) || null;
  const afterSortedAt = url.searchParams.get("afterSortedAt");
  const afterNoteId = url.searchParams.get("afterNoteId");
  const sortedAt = (note: NoteListResponseDataNotesItem) =>
    note.meetingStartedAt ?? note.createdAt;
  const meetingStatus = url.searchParams.get("meetingStatus");
  const matching = meetingStatus
    ? notes.filter((note) => note.meetingStatus === meetingStatus)
    : notes;
  const rest =
    afterSortedAt && afterNoteId
      ? matching.filter(
          (note) =>
            sortedAt(note) < afterSortedAt ||
            (sortedAt(note) === afterSortedAt && note.noteId < afterNoteId)
        )
      : matching;
  const page = limit ? rest.slice(0, limit) : rest;
  const last = page.at(-1);
  const hasMore = page.length < rest.length && last !== undefined;
  return {
    notes: page,
    hasMore,
    nextSortedAt: hasMore ? sortedAt(last) : null,
    nextNoteId: hasMore ? last.noteId : null,
  };
}

const SHARE_MAIL_HOURLY_LIMIT = 30;
const SHARE_MAIL_WINDOW_MS = 60 * 60 * 1000;
const shareMailSent = new Map<number, number>();
const shareMails = new Map<
  string,
  { noteId: string; requestedAt: number; recipients: string[] }
>();
mockDb.onReset(() => {
  shareMailSent.clear();
  shareMails.clear();
});
const SHARE_MAIL_SETTLE_MS = 1_500;

export function seedShareMail(
  noteId: string,
  recipients: string[],
  requestedAt = Date.now()
) {
  const mailId = `0K9${String(shareMails.size + 1).padStart(10, "0")}`;
  shareMails.set(mailId, { noteId, requestedAt, recipients });
  return mailId;
}

type MockChannel = {
  channel: "WEB" | "EMAIL";
  provided: boolean;
  enabled: boolean;
};
const NOTIFICATION_DEFAULTS: {
  type:
    | "WORKSPACE_INVITATION"
    | "ANALYSIS_READY"
    | "MEETING_PAUSED_REMINDER"
    | "INQUIRY_ANSWERED";
  required: boolean;
  channels: MockChannel[];
}[] = [
  {
    type: "WORKSPACE_INVITATION",
    required: true,
    channels: [
      { channel: "WEB", provided: true, enabled: true },
      { channel: "EMAIL", provided: true, enabled: true },
    ],
  },
  {
    type: "ANALYSIS_READY",
    required: false,
    channels: [
      { channel: "WEB", provided: true, enabled: true },
      { channel: "EMAIL", provided: false, enabled: false },
    ],
  },
  {
    type: "MEETING_PAUSED_REMINDER",
    required: false,
    channels: [
      { channel: "WEB", provided: false, enabled: false },
      { channel: "EMAIL", provided: true, enabled: true },
    ],
  },
  {
    type: "INQUIRY_ANSWERED",
    required: false,
    channels: [
      { channel: "WEB", provided: true, enabled: true },
      { channel: "EMAIL", provided: true, enabled: true },
    ],
  },
];
let notificationPrefs = structuredClone(NOTIFICATION_DEFAULTS);
let notificationMutes = { muteAll: false, muteEmail: false };
let marketingEmail: NotificationSettingsResponseDataMarketingEmail = {
  agreed: false,
  changedAt: null,
};
export function resetMarketingConsentMock() {
  marketingEmail = { agreed: false, changedAt: null };
}

export function resetNotificationSettingsMock() {
  notificationPrefs = structuredClone(NOTIFICATION_DEFAULTS);
  notificationMutes = { muteAll: false, muteEmail: false };
}

function notificationSettings(): NotificationSettingsResponse {
  return {
    success: true,
    data: {
      ...notificationMutes,
      marketingEmail,
      items: notificationPrefs.map((item) => ({
        ...item,
        channels: item.channels.map((entry) => ({
          ...entry,
          effective:
            entry.provided &&
            (item.required ||
              (entry.enabled &&
                !(entry.channel === "WEB" && notificationMutes.muteAll) &&
                !(entry.channel === "EMAIL" && notificationMutes.muteEmail))),
        })),
      })),
    },
    error: null,
  };
}

let mailUnsubscribed = false;

function unsubscribeResult(request: Request, run: () => boolean) {
  if (new URL(request.url).searchParams.get("t") === "invalid") {
    return HttpResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: "UNSUBSCRIBE_LINK_INVALID",
          message:
            "유효하지 않은 수신거부 링크입니다. 알림 설정에서 메일을 끌 수 있습니다.",
          details: null,
        },
      },
      { status: 400 }
    );
  }
  return HttpResponse.json({
    success: true,
    data: {
      kind: "MEETING_PAUSED_REMINDER",
      email: "mo***@heymoa.app",
      unsubscribed: run(),
      autoEndActive: true,
    },
    error: null,
  });
}

export const restHandlers = [
  getGetAuthSessionMockHandler(() => {
    const { userId, name, email, image, language } = mockDb.getCurrentUser();
    return {
      success: true,
      data: {
        state: "authenticated",
        user: { userId, name, email, image, language },
      },
      error: null,
    };
  }),
  getGetNotificationSettingsMockHandler(() => notificationSettings()),
  http.put("*/v1/notification-settings", async ({ request }) => {
    const body = (await request.json()) as typeof notificationMutes;
    notificationMutes = { muteAll: body.muteAll, muteEmail: body.muteEmail };
    return HttpResponse.json(notificationSettings());
  }),
  http.delete("*/v1/notification-settings", () => {
    resetNotificationSettingsMock();
    return HttpResponse.json(notificationSettings());
  }),
  http.put("*/v1/notification-settings/items", async ({ request }) => {
    const body = (await request.json()) as {
      type: string;
      channel: string;
      enabled: boolean;
    };
    const item = notificationPrefs.find((entry) => entry.type === body.type);
    const target = item?.channels.find(
      (entry) => entry.channel === body.channel
    );
    if (!item || item.required || !target?.provided) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: "BAD_REQUEST",
            message: "잘못된 요청입니다.",
            details: null,
          },
        },
        { status: 400 }
      );
    }
    target.enabled = body.enabled;
    return HttpResponse.json(notificationSettings());
  }),
  http.put(
    "*/v1/notification-settings/marketing-email",
    async ({ request }) => {
      const { agreed } = (await request.json()) as { agreed: boolean };
      if (agreed !== marketingEmail.agreed)
        marketingEmail = { agreed, changedAt: new Date().toISOString() };
      return HttpResponse.json(notificationSettings());
    }
  ),
  http.get("*/v1/mail/unsubscribe", ({ request }) =>
    unsubscribeResult(request, () => mailUnsubscribed)
  ),
  http.post("*/v1/mail/unsubscribe", ({ request }) =>
    unsubscribeResult(request, () => (mailUnsubscribed = true))
  ),
  getGetCurrentUserMockHandler(() => ({
    success: true,
    data: mockDb.getCurrentUser(),
    error: null,
  })),
  http.patch("*/v1/users/me", async ({ request }) =>
    respond(async () => {
      const { language } = (await jsonBody(request)) as { language?: unknown };
      if (language !== "ko" && language !== "en") {
        failWith("BAD_REQUEST", 400, "잘못된 요청입니다.");
      }
      return mockDb.updateCurrentUserLanguage(language);
    })
  ),
  http.get("*/v1/users/me/deletion-plan", () =>
    respond(() => mockDb.deletionPlan())
  ),
  http.delete("*/v1/users/me", ({ request }) =>
    memberResult(async () => mockDb.deleteAccount(await jsonBody(request)))
  ),
  http.delete("*/v1/workspaces/:workspaceId", ({ params, request }) =>
    memberResult(async () =>
      mockDb.deleteWorkspace(
        id(params.workspaceId),
        (await jsonBody(request)).workspaceName
      )
    )
  ),
  http.post("*/v1/realtime/tickets", () =>
    respond(() => ({
      ticket: "mock-realtime-ticket",
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    }))
  ),
  http.post("*/v1/users/me/consents", async ({ request }) =>
    respond(
      async () =>
        mockDb.recordConsents((await request.json()) as RecordConsentRequest),
      204
    )
  ),

  getGetWorkspacesMockHandler(() => ({
    success: true,
    data: { workspaces: mockDb.listWorkspaces() },
    error: null,
  })),
  http.post("*/v1/workspaces", async ({ request }) =>
    resultOf(
      async () =>
        mockDb.createWorkspace(
          (await request.json()) as CreateWorkspaceRequest
        ),
      BAD_REQUEST,
      201
    )
  ),
  http.get("*/v1/workspaces/:workspaceId", ({ params }) =>
    resultOf(
      () => mockDb.getWorkspace(id(params.workspaceId)),
      notFound("WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다.")
    )
  ),
  http.put("*/v1/workspaces/:workspaceId", async ({ request, params }) =>
    resultOf(
      async () =>
        mockDb.updateWorkspace(
          id(params.workspaceId),
          (await request.json()) as UpdateWorkspaceRequest
        ),
      BAD_REQUEST
    )
  ),
  http.get("*/v1/workspaces/:workspaceId/projects", ({ params }) =>
    resultOf(
      () => ({ projects: mockDb.listProjects(id(params.workspaceId)) }),
      notFound("WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다.")
    )
  ),
  http.post(
    "*/v1/workspaces/:workspaceId/projects",
    async ({ request, params }) =>
      resultOf(
        async () =>
          mockDb.createProject(
            id(params.workspaceId),
            (await request.json()) as ProjectRequest
          ),
        BAD_REQUEST,
        201
      )
  ),
  http.get("*/v1/workspaces/:workspaceId/projects/:projectId", ({ params }) =>
    resultOf(
      () => mockDb.getProject(id(params.workspaceId), id(params.projectId)),
      notFound("PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.")
    )
  ),
  http.put(
    "*/v1/workspaces/:workspaceId/projects/:projectId",
    async ({ request, params }) =>
      resultOf(
        async () =>
          mockDb.updateProject(
            id(params.workspaceId),
            id(params.projectId),
            (await request.json()) as ProjectRequest
          ),
        BAD_REQUEST
      )
  ),
  http.delete(
    "*/v1/workspaces/:workspaceId/projects/:projectId",
    async ({ params }) => {
      try {
        mockDb.deleteProject(id(params.workspaceId), id(params.projectId));
        return new HttpResponse(null, { status: 204 });
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        if (msg === "PROJECT_HAS_NOTES") {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: {
                code: "PROJECT_HAS_NOTES",
                message: "노트가 있는 프로젝트는 삭제할 수 없습니다.",
                details: null,
              },
            },
            { status: 409 }
          );
        }
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: msg,
              message: msg,
              details: null,
            },
          },
          { status: 404 }
        );
      }
    }
  ),

  http.get("*/v1/workspaces/:workspaceId/notes", ({ params, request }) =>
    resultOf(
      () =>
        pageOfNotes(
          mockDb.listWorkspaceNotes(id(params.workspaceId)),
          new URL(request.url)
        ),
      notFound("WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다.")
    )
  ),
  http.get("*/v1/projects/:projectId/notes", ({ params, request }) =>
    resultOf(
      () =>
        pageOfNotes(
          mockDb.listNotes(id(params.projectId)),
          new URL(request.url)
        ),
      notFound("PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.")
    )
  ),
  http.post("*/v1/projects/:projectId/notes", async ({ request, params }) =>
    resultOf(
      async () =>
        mockDb.createNote(
          id(params.projectId),
          (await request.json()) as NoteRequest
        ),
      BAD_REQUEST,
      201
    )
  ),
  http.get("*/v1/notes/:noteId", ({ params }) =>
    resultOf(
      () => mockDb.getNote(id(params.noteId)),
      notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
    )
  ),
  http.post("*/v1/notes/:noteId/share-mails", async ({ request, params }) => {
    const form = await request.formData();
    const file = form.get("file");
    const fail = (code: string, message: string, status = 400) =>
      HttpResponse.json(
        { success: false, data: null, error: { code, message, details: null } },
        { status }
      );
    const recipients = [
      ...new Map(
        form
          .getAll("recipients")
          .map(
            (value) =>
              [
                String(value).trim().toLowerCase(),
                String(value).trim(),
              ] as const
          )
          .reverse()
      ).values(),
    ].reverse();
    if (
      recipients.length === 0 ||
      recipients.some((value) => !isEmail(value) || value.endsWith(".invalid"))
    ) {
      return fail(
        "SHARE_MAIL_INVALID_RECIPIENT",
        "받는 사람 이메일 주소를 확인해 주세요."
      );
    }
    if (recipients.length > 10) {
      return fail(
        "SHARE_MAIL_TOO_MANY_RECIPIENTS",
        "받는 사람은 한 번에 10명까지 지정할 수 있습니다."
      );
    }
    if (String(form.get("message") ?? "").trim().length > 1000) {
      return fail(
        "SHARE_MAIL_MESSAGE_TOO_LONG",
        "메시지는 1000자까지 쓸 수 있습니다."
      );
    }
    if (file instanceof Blob && file.size > 10 * 1024 * 1024) {
      return fail(
        "SHARE_MAIL_FILE_TOO_LARGE",
        "첨부 파일은 10MB 이하여야 합니다."
      );
    }
    const head = file instanceof Blob ? await file.slice(0, 5).text() : "";
    if (head !== "%PDF-")
      return fail("SHARE_MAIL_NOT_PDF", "PDF 파일만 보낼 수 있습니다.");
    const slot = Math.floor(Date.now() / SHARE_MAIL_WINDOW_MS);
    const sent = shareMailSent.get(slot) ?? 0;
    if (sent >= SHARE_MAIL_HOURLY_LIMIT) {
      return fail(
        "SHARE_MAIL_RATE_LIMITED",
        "메일을 너무 자주 보냈습니다. 잠시 후 다시 시도해 주세요.",
        429
      );
    }
    shareMailSent.set(slot, sent + 1);
    const mailId = seedShareMail(String(params.noteId), recipients);
    return HttpResponse.json(
      { success: true, data: { mailId }, error: null },
      { status: 202 }
    );
  }),
  http.get("*/v1/notes/:noteId/share-mails/:mailId", ({ params }) => {
    const mail = shareMails.get(String(params.mailId));
    if (!mail || mail.noteId !== String(params.noteId)) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: "SHARE_MAIL_NOT_FOUND",
            message: "공유 메일을 찾을 수 없습니다.",
            details: null,
          },
        },
        { status: 404 }
      );
    }
    const settled = Date.now() - mail.requestedAt >= SHARE_MAIL_SETTLE_MS;
    const recipients = mail.recipients.map((email) => ({
      email,
      status: !settled
        ? "PENDING"
        : email.toLowerCase().endsWith("@reject.test")
          ? "FAILED"
          : "SENT",
    }));
    return HttpResponse.json({
      success: true,
      data: {
        mailId: String(params.mailId),
        requestedAt: new Date(mail.requestedAt).toISOString(),
        completed: recipients.every((row) => row.status !== "PENDING"),
        recipients,
      },
      error: null,
    });
  }),
  http.get("*/v1/notes/:noteId/proposals", ({ params }) => {
    if (id(params.noteId) === CONTEXT_FAILING_NOTE_ID) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: "INTERNAL", message: "…" },
        },
        { status: 500 }
      );
    }
    if (id(params.noteId) === LIVE_AGENDA_NOTE_ID) {
      return HttpResponse.json({
        success: true,
        data: { proposals: liveAgendaProposals(Date.now()), runs: [] },
        error: null,
      });
    }
    if (id(params.noteId) === CONTEXT_SWAP_NOTE_ID) {
      const data = isSwapFilled()
        ? { ...CONTEXT_SWAP_SNAPSHOT, runs: CONTEXT_SWAP_FILLED }
        : CONTEXT_SWAP_SNAPSHOT;
      return HttpResponse.json({ success: true, data, error: null });
    }
    if (id(params.noteId) === CONTEXT_SYNTHETIC_LEDGER_NOTE_ID) {
      return HttpResponse.json({
        success: true,
        data: SYNTHETIC_LEDGER_SNAPSHOT,
        error: null,
      });
    }
    return resultOf(
      () => {
        mockDb.getNote(id(params.noteId));
        return id(params.noteId) === CONTEXT_DEMO_NOTE_ID
          ? CONTEXT_SNAPSHOT
          : { proposals: [], runs: [] };
      },
      notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
    );
  }),
  http.get("*/v1/notes/:noteId/relations", ({ params }) =>
    resultOf(
      () => {
        mockDb.getNote(id(params.noteId));
        return { relations: [] };
      },
      notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
    )
  ),
  http.get("*/v1/notes/:noteId/proposals/:proposalId/revisions", ({ params }) =>
    resultOf(
      () => {
        mockDb.getNote(id(params.noteId));
        const proposalId = id(params.proposalId);
        const byRevision = new Map(
          [
            ...CONTEXT_TIMELINE.filter(
              (entry) => entry.proposal.proposalId === proposalId
            ).map((entry) => entry.proposal),
            ...CONTEXT_SNAPSHOT.proposals.filter(
              (proposal) => proposal.proposalId === proposalId
            ),
          ].map((proposal) => [proposal.revision, proposal] as const)
        );
        const revisions = [...byRevision.values()].sort(
          (a, b) => a.revision - b.revision
        );
        return { proposalId, revisions };
      },
      notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
    )
  ),
  http.put("*/v1/notes/:noteId/participants", async ({ request, params }) =>
    resultOf(async () => {
      const body = (await request.json()) as {
        userIds?: string[];
        expectedUserIds?: string[];
      };
      return mockDb.replaceNoteParticipants(
        id(params.noteId),
        body.userIds ?? [],
        body.expectedUserIds
      );
    }, NOT_WORKSPACE_MEMBER)
  ),
  http.post(
    "*/v1/notes/:noteId/participants/guests",
    async ({ request, params }) =>
      resultOf(
        async () =>
          mockDb.createNoteGuestParticipant(
            id(params.noteId),
            ((await request.json()) as { displayName?: string }).displayName ??
              ""
          ),
        notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다."),
        201
      )
  ),
  http.put(
    "*/v1/notes/:noteId/participants/guests",
    async ({ request, params }) =>
      resultOf(
        async () => {
          const body = (await request.json()) as {
            guestIds?: string[];
            expectedGuestIds?: string[];
          };
          return mockDb.replaceNoteGuestParticipants(
            id(params.noteId),
            body.guestIds ?? [],
            body.expectedGuestIds
          );
        },
        notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
      )
  ),
  http.get("*/v1/workspaces/:workspaceId/guests", ({ params, request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit")) || null;
    const afterName = url.searchParams.get("afterDisplayName");
    const afterId = url.searchParams.get("afterGuestId");
    return commandResult(() => {
      const { guests: all } = mockDb.listWorkspaceGuests(
        id(params.workspaceId)
      );
      const rest =
        afterName !== null && afterId
          ? all.filter(
              (guest) =>
                guest.displayName.localeCompare(afterName) > 0 ||
                (guest.displayName === afterName && guest.guestId > afterId)
            )
          : all;
      const guests = limit ? rest.slice(0, limit) : rest;
      const last = guests.at(-1);
      const hasMore = limit !== null && guests.length < rest.length && !!last;
      return {
        guests,
        totalCount: all.length,
        hasMore,
        nextDisplayName: hasMore ? last.displayName : null,
        nextGuestId: hasMore ? last.guestId : null,
      };
    });
  }),
  http.post(
    "*/v1/workspaces/:workspaceId/guests",
    async ({ request, params }) =>
      resultOf(
        async () =>
          mockDb.createWorkspaceGuest(
            id(params.workspaceId),
            ((await request.json()) as { displayName?: string }).displayName ??
              ""
          ),
        notFound("WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다."),
        201
      )
  ),
  http.patch(
    "*/v1/workspaces/:workspaceId/guests/:guestId",
    async ({ request, params }) =>
      resultOf(
        async () =>
          mockDb.renameWorkspaceGuest(
            id(params.workspaceId),
            id(params.guestId),
            ((await request.json()) as { displayName?: string }).displayName ??
              ""
          ),
        notFound("WORKSPACE_GUEST_NOT_FOUND", "임시 참여자를 찾을 수 없습니다.")
      )
  ),
  http.delete("*/v1/workspaces/:workspaceId/guests/:guestId", ({ params }) =>
    commandResult(() =>
      mockDb.deleteWorkspaceGuest(id(params.workspaceId), id(params.guestId))
    )
  ),
  http.post(
    "*/v1/workspaces/:workspaceId/guests/:guestId/link-preview",
    async ({ request, params }) =>
      resultOf(
        async () =>
          mockDb.previewWorkspaceGuestLink(
            id(params.workspaceId),
            id(params.guestId),
            ((await request.json()) as { targetUserId?: string })
              .targetUserId ?? ""
          ),
        notFound("WORKSPACE_GUEST_NOT_FOUND", "임시 참여자를 찾을 수 없습니다.")
      )
  ),
  http.post(
    "*/v1/workspaces/:workspaceId/guests/:guestId/link",
    async ({ request, params }) =>
      resultOf(
        async () =>
          mockDb.linkWorkspaceGuest(
            id(params.workspaceId),
            id(params.guestId),
            ((await request.json()) as { targetUserId?: string })
              .targetUserId ?? ""
          ),
        notFound("WORKSPACE_GUEST_NOT_FOUND", "임시 참여자를 찾을 수 없습니다.")
      )
  ),
  http.patch("*/v1/notes/:noteId", async ({ request, params }) =>
    resultOf(
      async () =>
        mockDb.updateNote(
          id(params.noteId),
          (await request.json()) as NoteRequest
        ),
      BAD_REQUEST
    )
  ),

  http.put("*/v1/notes/:noteId/context", async ({ request, params }) =>
    resultOf(
      async () =>
        mockDb.updateNoteContext(
          id(params.noteId),
          (await request.json().catch(() => ({}))) as {
            topic?: string | null;
            background?: string | null;
          }
        ),
      BAD_REQUEST
    )
  ),

  http.delete("*/v1/notes/:noteId", ({ params }) => {
    try {
      mockDb.deleteNote(id(params.noteId));
      return new HttpResponse(null, { status: 204 });
    } catch (error) {
      const code =
        error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
      const notFound = code === "NOTE_NOT_FOUND";
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code,
            message: notFound ? "노트를 찾을 수 없습니다." : code,
            details: null,
          },
        },
        { status: notFound ? 404 : 409 }
      );
    }
  }),

  http.get("*/v1/transcription-sessions/:sessionId", ({ params }) =>
    resultOf(
      () => mockDb.getSession(id(params.sessionId)),
      notFound(
        "TRANSCRIPTION_SESSION_NOT_FOUND",
        "스크립트 세션을 찾을 수 없습니다."
      )
    )
  ),
  http.put("*/v1/notes/:noteId/speakers", async ({ params, request }) => {
    const body = (await request.json()) as {
      assignments?: Array<{
        label: string;
        participantId?: string | null;
        userId?: string | null;
        guestId?: string | null;
      }>;
    };
    return resultOf(
      () => {
        let speakers = mockDb.getTranscript(id(params.noteId)).diarization
          .speakers;
        for (const assignment of body.assignments ?? []) {
          speakers = mockDb.assignSpeaker(id(params.noteId), assignment.label, {
            participantId: assignment.participantId ?? null,
            userId: assignment.userId ?? null,
            guestId: assignment.guestId ?? null,
          });
        }
        return { speakers };
      },
      notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
    );
  }),
  http.put(
    "*/v1/notes/:noteId/speakers/:label",
    async ({ params, request }) => {
      const body = (await request.json()) as {
        participantId?: string | null;
        userId?: string | null;
        guestId?: string | null;
      };
      return resultOf(
        () => ({
          speakers: mockDb.assignSpeaker(
            id(params.noteId),
            String(params.label),
            {
              participantId: body.participantId ?? null,
              userId: body.userId ?? null,
              guestId: body.guestId ?? null,
            }
          ),
        }),
        notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
      );
    }
  ),
  http.put(
    "*/v1/notes/:noteId/segments/:segmentId/speaker",
    async ({ params, request }) => {
      const body = (await request.json()) as {
        participantId?: string | null;
        userId?: string | null;
        guestId?: string | null;
      };
      return resultOf(
        () =>
          mockDb.assignSegmentSpeaker(
            id(params.noteId),
            String(params.segmentId),
            {
              participantId: body.participantId ?? null,
              userId: body.userId ?? null,
              guestId: body.guestId ?? null,
            }
          ),
        notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
      );
    }
  ),
  http.get("*/v1/notes/:noteId/transcript", ({ params }) =>
    resultOf(
      () => mockDb.getTranscript(id(params.noteId)),
      notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
    )
  ),
  http.get("*/v1/notes/:noteId/transcript/segments", ({ params, request }) =>
    resultOf(
      () => {
        const url = new URL(request.url);
        const afterStartedAtMs = Number(
          url.searchParams.get("afterStartedAtMs") ?? 0
        );
        const afterSequence = Number(
          url.searchParams.get("afterSequence") ?? 0
        );
        const { segments } = mockDb.getTranscript(id(params.noteId));
        return {
          segments: segments.filter(
            (segment) =>
              segment.startedAtMs > afterStartedAtMs ||
              (segment.startedAtMs === afterStartedAtMs &&
                segment.sequence > afterSequence)
          ),
        };
      },
      notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
    )
  ),
  http.post(
    "*/v1/notes/:noteId/transcription-sessions",
    async ({ params, request }) => {
      const body = (await request.json().catch(() => ({}))) as {
        clientInstanceId?: string;
      };
      if (billingMock.quotaExceeded()) {
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: "RECORDING_QUOTA_EXCEEDED",
              message: "이번 달 무료 녹음 시간을 모두 사용했습니다.",
              details: null,
            },
          },
          { status: 409 }
        );
      }
      try {
        const data = mockDb.createSession(
          id(params.noteId),
          body.clientInstanceId
        );
        return HttpResponse.json(
          { success: true, data, error: null },
          { status: 201 }
        );
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        if (FORBIDDEN_CODES.has(msg)) {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: {
                code: msg,
                message: "회의 시작자만 조작할 수 있습니다.",
                details: null,
              },
            },
            { status: 403 }
          );
        }
        const conflict = SESSION_CONFLICTS[msg];
        if (conflict) {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: msg, message: conflict, details: null },
            },
            { status: 409 }
          );
        }
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: msg,
              message: CONTRACT_ERROR_MESSAGES[msg] ?? msg,
              details: null,
            },
          },
          { status: 404 }
        );
      }
    }
  ),

  http.get("*/v1/workspaces/:workspaceId/members", ({ params }) =>
    commandResult(() => ({
      members: mockDb.listMembers(id(params.workspaceId)),
    }))
  ),
  http.patch(
    "*/v1/workspaces/:workspaceId/members/:userId/display-name",
    async ({ request, params }) =>
      resultOf(
        async () =>
          mockDb.renameMember(
            id(params.workspaceId),
            id(params.userId),
            (
              (await request.json().catch(() => ({}))) as {
                displayName?: string | null;
              }
            ).displayName ?? null
          ),
        notFound(
          "WORKSPACE_MEMBER_NOT_FOUND",
          "워크스페이스 멤버를 찾을 수 없습니다."
        )
      )
  ),
  // 본문 파싱은 memberResult 안에서 합니다. 밖에서 파싱하면 SyntaxError 가 새어 MSW 가 500 과 스택을 돌려줍니다.
  http.patch(
    "*/v1/workspaces/:workspaceId/members/:userId",
    ({ params, request }) =>
      memberResult(async () => {
        const body = await request
          .json()
          .catch(() => {
            throw new Error("BAD_REQUEST");
          })
          .then((value) => value as { role?: string });
        mockDb.changeMemberRole(
          id(params.workspaceId),
          id(params.userId),
          body?.role ?? ""
        );
      })
  ),
  // 정적 경로(/members/me)가 :userId 보다 먼저 와야 합니다. MSW 는 등록 순서대로 매칭합니다.
  http.delete(
    "*/v1/workspaces/:workspaceId/members/me",
    ({ params, request }) =>
      memberResult(async () =>
        mockDb.leaveWorkspace(
          id(params.workspaceId),
          (await jsonBody(request)).workspaceName
        )
      )
  ),
  http.delete("*/v1/workspaces/:workspaceId/members/:userId", ({ params }) =>
    memberResult(() =>
      mockDb.removeMember(id(params.workspaceId), id(params.userId))
    )
  ),
  http.get("*/v1/workspaces/:workspaceId/invitations", ({ params }) =>
    commandResult(() => ({
      invitations: mockDb.listInvitations(id(params.workspaceId)),
    }))
  ),
  getGetNotificationsMockHandler(({ request }) => {
    billingMock.ensureBillingNotice();
    const query = new URL(request.url).searchParams;
    return {
      success: true,
      data: mockDb.listNotifications({
        filter: query.get("filter"),
        limit: query.get("limit"),
        schema: query.get("schema"),
        afterCreatedAt: query.get("afterCreatedAt"),
        afterNotificationId: query.get("afterNotificationId"),
      }),
      error: null,
    };
  }),
  http.get("*/v1/notifications/unread-count", ({ request }) =>
    commandResult(() => {
      billingMock.ensureBillingNotice();
      return {
        unreadCount: mockDb.unreadNotificationCount(
          new URL(request.url).searchParams.get("schema")
        ),
      };
    })
  ),
  http.put("*/v1/notifications/read", async ({ request }) => {
    const body = (await request.json()) as { upTo: string };
    return notified(
      commandResult(() => mockDb.markAllNotificationsRead(body.upTo))
    );
  }),
  http.get("*/v1/admin/users", ({ request }) =>
    adminPage(request, ADMIN_USERS, (users, next) => ({
      users,
      nextCreatedAt: next?.createdAt ?? null,
      nextUserId: next?.userId ?? null,
    }))
  ),
  http.get("*/v1/admin/feedbacks", ({ request }) =>
    adminPage(request, ADMIN_FEEDBACKS, (feedbacks, next) => ({
      feedbacks,
      nextCreatedAt: next?.createdAt ?? null,
      nextFeedbackId: next?.feedbackId ?? null,
    }))
  ),
  http.get("*/v1/billing/operator/reviews", () =>
    HttpResponse.json({
      success: true,
      data: { reviews: BILLING_REVIEWS },
      error: null,
    })
  ),
  http.get("*/v1/feedbacks", () => commandResult(() => mockDb.listFeedbacks())),
  http.post("*/v1/feedbacks/answers/seen", () => {
    mockDb.markFeedbackAnswersSeen();
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("*/v1/feedbacks", async ({ request }) => {
    const body = (await request.json()) as CreateFeedbackRequest;
    return commandResult(() => mockDb.createFeedback(body), 201);
  }),
  http.put("*/v1/notifications/:notificationId/read", ({ params }) =>
    notified(
      commandResult(() =>
        mockDb.markNotificationRead(id(params.notificationId))
      )
    )
  ),

  http.post(
    "*/v1/workspaces/:workspaceId/invitations",
    async ({ request, params }) => {
      const body = (await request.json()) as { email: string; role: string };
      return invitationResult(
        () => mockDb.createInvitation(id(params.workspaceId), body),
        201
      );
    }
  ),
  http.delete(
    "*/v1/workspaces/:workspaceId/invitations/:invitationId",
    ({ params }) =>
      invitationResult(() => mockDb.cancelInvitation(id(params.invitationId)))
  ),
  http.post("*/v1/invitations/:invitationId/accept", ({ params }) =>
    notified(
      invitationResult(() => mockDb.acceptInvitation(id(params.invitationId)))
    )
  ),
  http.post("*/v1/invitations/accept-by-token", async ({ request }) => {
    const body = (await request.json()) as { token?: string };
    return invitationResult(() =>
      mockDb.acceptInvitationByToken(body.token ?? "")
    );
  }),
  http.post("*/v1/invitations/:invitationId/decline", ({ params }) =>
    notified(
      invitationResult(() => mockDb.declineInvitation(id(params.invitationId)))
    )
  ),

  http.get("*/v1/agent-delegations", () =>
    commandResult(() => ({ delegations: mockDb.listAgentDelegations() }))
  ),
  http.post("*/v1/agent-delegations", async ({ request }) => {
    const body = (await request.json()) as {
      workspaceId: string;
      name: string;
      allowTaskChanges?: boolean;
    };
    const name = (body.name ?? "").trim();
    if (name.length < 1 || name.length > 50) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: BAD_REQUEST.code,
            message: BAD_REQUEST.message,
            details: null,
          },
        },
        { status: BAD_REQUEST.status }
      );
    }
    return commandResult(
      () =>
        mockDb.createAgentDelegation(
          body.workspaceId,
          name,
          body.allowTaskChanges ?? false
        ),
      201
    );
  }),
  http.get(
    "*/v1/agent-delegations/:delegationId/usages",
    ({ params, request }) => {
      const query = new URL(request.url).searchParams;
      return commandResult(() =>
        mockDb.listAgentDelegationUsages(
          id(params.delegationId),
          query.get("afterOccurredAt"),
          query.get("afterUsageId")
        )
      );
    }
  ),
  http.get("*/v1/agent-oauth/consent", ({ request }) => {
    const consentState = new URL(request.url).searchParams.get("state") ?? "";
    return commandResult(() => mockDb.getAgentOAuthConsent(consentState));
  }),
  http.post("*/v1/agent-oauth/consent/approve", async ({ request }) => {
    const body = (await request.json()) as {
      state: string;
      workspaceId: string;
      allowTaskChanges?: boolean;
    };
    return commandResult(() =>
      mockDb.approveAgentOAuthConsent(
        body.state,
        body.workspaceId,
        body.allowTaskChanges ?? false
      )
    );
  }),
  http.post("*/v1/agent-oauth/consent/deny", async ({ request }) => {
    const body = (await request.json()) as { state: string };
    return commandResult(() => mockDb.denyAgentOAuthConsent(body.state));
  }),
  http.delete("*/v1/agent-delegations/:delegationId", ({ params }) => {
    try {
      mockDb.revokeAgentDelegation(id(params.delegationId));
    } catch (error) {
      const code = (error as Error).message;
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code,
            message: CONTRACT_ERROR_MESSAGES[code] ?? code,
            details: null,
          },
        },
        { status: 404 }
      );
    }
    return new HttpResponse(null, { status: 204 });
  }),
  http.put("*/v1/workspaces/:workspaceId/agent-access", ({ params, request }) =>
    memberResult(async () => {
      const body = (await request.json().catch(() => null)) as {
        allowed?: unknown;
      } | null;
      if (typeof body?.allowed !== "boolean") throw new Error("BAD_REQUEST");
      mockDb.changeWorkspaceAgentAccess(id(params.workspaceId), body.allowed);
    })
  ),
  http.get("*/v1/workspaces/:workspaceId/agent-delegations", ({ params }) =>
    commandResult(() => ({
      delegations: mockDb.listWorkspaceAgentDelegations(id(params.workspaceId)),
    }))
  ),
  http.delete(
    "*/v1/workspaces/:workspaceId/agent-delegations/:delegationId",
    ({ params }) =>
      memberResult(() =>
        mockDb.revokeWorkspaceAgentDelegation(
          id(params.workspaceId),
          id(params.delegationId)
        )
      )
  ),

  http.get("*/v1/notes/:noteId/analyses/latest", ({ params }) =>
    commandResult(() => mockDb.getLatestAnalysis(id(params.noteId)))
  ),
  http.get("*/v1/workspaces/:workspaceId/integrations", ({ params }) =>
    commandResult(() => ({
      integrations: mockDb.listIntegrations(id(params.workspaceId)),
    }))
  ),

  http.post("*/v1/notes/:noteId/meeting-end", ({ params }) => {
    const noteId = id(params.noteId);
    return commandResult(() => {
      const note = mockDb.endMeeting(noteId);
      meetingFlow.onMeetingEnded(noteId);
      return note;
    });
  }),
  http.delete(
    "*/v1/workspaces/:workspaceId/integrations/:provider",
    ({ params }) => {
      try {
        mockDb.disconnectIntegration(
          id(params.workspaceId),
          id(params.provider)
        );
      } catch (error) {
        const code = (error as Error).message;
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code, message: code, details: null },
          },
          { status: NOT_FOUND_CODES.has(code) ? 404 : 409 }
        );
      }
      return new HttpResponse(null, { status: 204 });
    }
  ),

  http.get(
    "*/v1/workspaces/:workspaceId/integrations/:provider/authorize",
    ({ params }) => {
      const workspaceId = id(params.workspaceId);
      const provider = id(params.provider);
      return new HttpResponse(null, {
        status: 302,
        headers: {
          Location: `/mock-oauth?workspaceId=${workspaceId}&provider=${provider}`,
        },
      });
    }
  ),
  http.get("*/v1/integrations/:provider/callback", ({ request, params }) => {
    const workspaceId = new URL(request.url).searchParams.get("state") ?? "";
    try {
      mockDb.connectIntegration(workspaceId, id(params.provider));
    } catch {}
    return new HttpResponse(null, {
      status: 302,
      headers: { Location: `/w/${workspaceId}` },
    });
  }),

  http.post(
    "*/v1/workspaces/:workspaceId/agent-chats",
    async ({ request, params }) => {
      const body = (await request.json()) as { title?: string | null };
      const response = commandResult(
        () =>
          mockDb.createAgentChat({
            workspaceId: id(params.workspaceId),
            ...body,
          }),
        201
      );
      emitChatsChanged();
      return response;
    }
  ),
  http.get(
    "*/v1/workspaces/:workspaceId/agent-chats",
    ({ params, request }) => {
      const workspaceId = id(params.workspaceId);
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit")) || 50;
      const afterUpdatedAt = url.searchParams.get("afterUpdatedAt");
      const afterChatId = url.searchParams.get("afterChatId");
      return commandResult(() => {
        const all = mockDb.listAllAgentChats(workspaceId);
        const rest =
          afterUpdatedAt && afterChatId
            ? all.filter(
                (chat) =>
                  chat.updatedAt < afterUpdatedAt ||
                  (chat.updatedAt === afterUpdatedAt &&
                    chat.chatId < afterChatId)
              )
            : all;
        const page = rest.slice(0, limit);
        const last = page.at(-1);
        const hasMore = page.length < rest.length && last !== undefined;
        return {
          chats: page.map((chat) => ({
            ...chat,
            runningTurn: runningTurnOf(chat.chatId),
          })),
          hasMore,
          nextUpdatedAt: hasMore ? last.updatedAt : null,
          nextChatId: hasMore ? last.chatId : null,
        };
      });
    }
  ),
  http.patch("*/v1/agent-chats/:chatId", async ({ params, request }) => {
    const { title } = (await request.json()) as { title: string };
    if (title.includes("오류")) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: "INTERNAL_ERROR",
            message: "잠시 후 다시 시도해 주세요.",
            details: null,
          },
        },
        { status: 500 }
      );
    }
    return commandResult(() => {
      const chat = mockDb.findAgentChat(id(params.chatId));
      if (!chat) throw new Error("AGENT_CHAT_NOT_FOUND");
      const next = title.replace(/\s+/g, " ").trim();
      if (!next || next.length > 100) throw new Error("BAD_REQUEST");
      if (next !== chat.title) {
        chat.title = next;
        chat.titleSource = "USER";
        emitChatsChanged();
      }
      return chat;
    });
  }),
  http.delete("*/v1/agent-chats/:chatId", ({ params }) => {
    const chat = mockDb.findAgentChat(id(params.chatId));
    const response = commandResult(
      () => mockDb.deleteAgentChat(id(params.chatId)),
      204
    );
    if (response.status !== 204) return response;
    if (chat) emitChatsChanged();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/v1/agent-chats/:chatId/messages", ({ params }) =>
    commandResult(() => ({
      messages: mockDb.getAgentChatMessages(id(params.chatId)),
      ...agentChatTurnState(id(params.chatId)),
    }))
  ),
];
