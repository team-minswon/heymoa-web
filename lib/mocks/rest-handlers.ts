import { HttpResponse, http } from "msw";
import { mockDb } from "@/lib/mocks/db";

// 생성 mock 래퍼는 **실패 경로가 없는 조회**에만 쓴다 — 래퍼가 항상 200을 주기 때문이다.
// 나머지는 아래 `resultOf`와 함께 직접 `http.*`로 쓴다.
import { getGetCurrentUserMockHandler } from "@/lib/api/generated/users/users.msw";
import { getGetWorkspacesMockHandler } from "@/lib/api/generated/workspaces/workspaces.msw";
import { getGetNotificationsMockHandler } from "@/lib/api/generated/notifications/notifications.msw";
import { getGetActiveAgentChatMockHandler } from "@/lib/api/generated/agent-chat/agent-chat.msw";

import type {
  ActionItemUpdateRequest,
  GetActionItemsParams,
  GetNotesParams,
  GetWorkspaceNotesParams,
  NoteCreateRequest,
  SpeakerAssignmentRequest,
  NoteUpdateRequest,
  ChangeDefaultWorkspaceRequest,
  NotificationPreferences,
  CreateWorkspaceRequest,
  ProjectRequest,
  UpdateWorkspaceRequest,
} from "@/lib/api/generated/models";

function id(value: string | readonly string[] | undefined) {
  return Array.isArray(value) ? value[0] : String(value ?? "");
}

/**
 * 초대 관련 명령은 실패 코드에 따라 상태 코드가 갈린다 — 없는 초대는 404, 이미 확정된
 * 초대나 중복·기존 멤버는 409다. 화면이 이 셋을 다르게 다뤄야 해서 목도 갈라 준다.
 */
const INVITATION_NOT_FOUND_CODES = new Set([
  "INVITATION_NOT_FOUND",
  "INVITEE_NOT_FOUND",
  "WORKSPACE_NOT_FOUND",
]);

/**
 * 실서버 봉투는 코드별 한국어 메시지를 담는데(openapi3.yml) 목은 코드를 그대로 넣고 있었다.
 * dev는 MSW로 도니 web이 `errorMessageOf`로 서버 문구를 그리려면 목도 같은 메시지를 줘야 한다.
 */
const INVITATION_ERROR_MESSAGES: Record<string, string> = {
  ALREADY_WORKSPACE_MEMBER: "이미 워크스페이스 멤버입니다.",
  DUPLICATE_PENDING_INVITATION: "이미 대기 중인 초대가 있습니다.",
  INVITEE_NOT_FOUND: "초대할 사용자를 찾을 수 없습니다.",
};

/**
 * 전사 세션 생성이 409로 거절되는 이유들. 문구는 계약(`openapi3.yml`)의 409 예시 그대로다.
 */
const SESSION_CONFLICTS: Record<string, string> = {
  ACTIVE_TRANSCRIPTION_SESSION: "이미 진행 가능한 전사 세션이 있습니다.",
  MEETING_ALREADY_ENDED: "이미 종료된 회의입니다.",
};

/** 권한 문제는 403이다 — 없음(404)이나 상태 충돌(409)과 구분해야 화면이 다르게 다룬다. */
const FORBIDDEN_CODES = new Set(["NOT_MEETING_STARTER"]);

const NOT_FOUND_CODES = new Set([
  "ACTION_ITEM_NOT_FOUND",
  "NOTE_NOT_FOUND",
  "WORKSPACE_NOT_FOUND",
  "PROJECT_NOT_FOUND",
  "TRANSCRIPTION_SESSION_NOT_FOUND",
  "ANALYSIS_JOB_NOT_FOUND",
  "INTEGRATION_NOT_FOUND",
  "NOTIFICATION_NOT_FOUND",
  "AGENT_CHAT_NOT_FOUND",
]);

/** mockDb가 던지는 계약 코드. 이것 말고는 목 자신의 버그이므로 fallback으로 떨어뜨린다. */
const KNOWN_CODES = new Set([
  "ACTION_ITEM_NOT_FOUND",
  "MEETING_IN_PROGRESS",
  ...NOT_FOUND_CODES,
  ...FORBIDDEN_CODES,
  ...INVITATION_NOT_FOUND_CODES,
  "PROJECT_HAS_NOTES",
  "MEETING_NOT_ACTIVE",
  "CHAT_LOCKED",
  "NOT_MEETING_STARTER",
]);

function statusOf(code: string) {
  if (FORBIDDEN_CODES.has(code)) return 403;
  if (NOT_FOUND_CODES.has(code)) return 404;
  return 409;
}

/** 목의 실패 코드를 화면이 구분할 수 있는 상태 코드로 옮긴다 — 없으면 404, 상태 위반이면 409. */
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
        error: { code, message: code, details: null },
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

/**
 * orval이 만든 `get*MockHandler`는 **항상 200을 준다.** 실패 봉투를 그 안에 넣으면
 * `200 success:false`가 되어 계약을 어긴다 — 계약의 성공 응답은 `error`가 null로 못박혀
 * 있고, 실패는 4xx + AppErrorResponse다. 실패 경로가 있는 operation은 직접 `http.*`로
 * 쓰고 이 헬퍼로 상태 코드를 붙인다. 생성 mock 래퍼는 실패가 없는 조회에만 쓴다.
 */
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
    // mockDb가 계약 코드를 던졌으면 그걸 그대로 쓴다. 한 operation에 실패가 여럿인데
    // 기본값으로 덮으면(예: createProject의 WORKSPACE_NOT_FOUND → 400) 계약과 어긋난다.
    const thrown = error instanceof Error ? error.message : "";
    const code = KNOWN_CODES.has(thrown) ? thrown : onError.code;
    return HttpResponse.json(
      {
        success: false,
        data: null,
        error: {
          code,
          message: code === onError.code ? onError.message : code,
          details: null,
        },
      },
      { status: code === onError.code ? onError.status : statusOf(code) }
    );
  }
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
      { status: INVITATION_NOT_FOUND_CODES.has(code) ? 404 : 409 }
    );
  }
}


/**
 * 쿼리 문자열을 orval 파라미터 타입으로 옮긴다. 목이 파라미터를 무시하면 화면의 필터가
 * 목에서는 늘 통과하고 실서버에서 처음 틀린다.
 */
const MEETING_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PAUSED", "ENDED"];
const NOTE_SORTS = ["scheduledAt_asc", "startedAt_desc", "updatedAt_desc"];

/** 계약의 enum·범위를 어기면 빈 목록이 아니라 400이다 — 목이 봐주면 실서버에서 처음 틀린다. */
function enumOrThrow<T extends string>(
  value: string | null,
  allowed: string[]
): T | undefined {
  if (value === null) return undefined;
  if (!allowed.includes(value)) throw new Error("BAD_REQUEST");
  return value as T;
}

function limitOrThrow(value: string | null, max: number): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error("BAD_REQUEST");
  }
  return parsed;
}

function searchToNoteParams(search: URLSearchParams): GetWorkspaceNotesParams {
  const status = search.get("meetingStatus");
  return {
    q: search.get("q") ?? undefined,
    meetingStatus: status
      ? (status
          .split(",")
          .map((value) =>
            enumOrThrow(value, MEETING_STATUSES)
          ) as GetWorkspaceNotesParams["meetingStatus"])
      : undefined,
    projectId: search.get("projectId") ?? undefined,
    sort: enumOrThrow<NonNullable<GetWorkspaceNotesParams["sort"]>>(
      search.get("sort"),
      NOTE_SORTS
    ),
    cursor: search.get("cursor") ?? undefined,
    limit: limitOrThrow(search.get("limit"), 100),
  };
}

function searchToProjectNoteParams(search: URLSearchParams): GetNotesParams {
  return {
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    sort: enumOrThrow<NonNullable<GetNotesParams["sort"]>>(
      search.get("sort"),
      NOTE_SORTS
    ),
  };
}

function searchToActionItemParams(
  search: URLSearchParams
): GetActionItemsParams {
  return {
    q: search.get("q") ?? undefined,
    assigneeId: search.get("assigneeId") ?? undefined,
    status: enumOrThrow<NonNullable<GetActionItemsParams["status"]>>(
      search.get("status"),
      ["OPEN", "DONE", "ALL"]
    ),
    dueBefore: search.get("dueBefore") ?? undefined,
    projectId: search.get("projectId") ?? undefined,
    cursor: search.get("cursor") ?? undefined,
    limit: limitOrThrow(search.get("limit"), 100),
  };
}

export const restHandlers = [
  // Users
  getGetCurrentUserMockHandler(() => ({
    success: true,
    data: mockDb.getCurrentUser(),
    error: null,
  })),

  // Workspaces
  getGetWorkspacesMockHandler(() => ({
    success: true,
    data: { workspaces: mockDb.listWorkspaces() },
    error: null,
  })),
  // 계약상 생성은 201이다. 생성 mock 래퍼는 200만 줄 수 있어 화면의
  // `status === 201` 분기가 통과하지 못했다 — 목에서 워크스페이스가 만들어지지 않던 원인이다.
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
  // workspaceId는 path가 아니라 **본문**으로 온다 (PUT /v1/users/me/default-workspace).
  // params에서 읽으면 언제나 없는 워크스페이스라 기본 워크스페이스가 바뀌지 않았다.
  http.put("*/v1/users/me/default-workspace", async ({ request }) =>
    resultOf(
      async () => {
        const body = (await request.json()) as ChangeDefaultWorkspaceRequest;
        return mockDb.setDefaultWorkspace(String(body.workspaceId ?? ""));
      },
      notFound("WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다.")
    )
  ),

  // Projects
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
  // Hand-written (not the Orval getDeleteProjectMockHandler): needs 204/409
  // status codes the generated wrapper can't express.
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

  // Notes
  http.get("*/v1/projects/:projectId/notes", ({ params, request }) =>
    resultOf(
      () => ({
        notes: mockDb.listNotes(
          id(params.projectId),
          searchToProjectNoteParams(new URL(request.url).searchParams)
        ),
      }),
      notFound("PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.")
    )
  ),
  http.post("*/v1/projects/:projectId/notes", async ({ request, params }) =>
    resultOf(
      async () =>
        mockDb.createNote(
          id(params.projectId),
          (await request.json()) as NoteUpdateRequest
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
  http.patch("*/v1/notes/:noteId", async ({ request, params }) =>
    resultOf(
      async () =>
        mockDb.updateNote(
          id(params.noteId),
          (await request.json()) as NoteUpdateRequest
        ),
      BAD_REQUEST
    )
  ),

  // Transcription
  http.get("*/v1/transcription-sessions/:sessionId", ({ params }) =>
    resultOf(
      () => mockDb.getSession(id(params.sessionId)),
      notFound(
        "TRANSCRIPTION_SESSION_NOT_FOUND",
        "전사 세션을 찾을 수 없습니다."
      )
    )
  ),
  http.get(
    "*/v1/notes/:noteId/transcription-sessions/current",
    ({ params }) =>
      resultOf(
        () => mockDb.getCurrentSession(id(params.noteId)),
        notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
      )
  ),
  http.get("*/v1/notes/:noteId/transcript", ({ params }) =>
    resultOf(
      () => ({
        segments: mockDb.listSegments(id(params.noteId)),
        speakers: mockDb.listSpeakers(id(params.noteId)),
      }),
      notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
    )
  ),
  // Hand-written (not the Orval getStartTranscriptionSessionMockHandler): needs
  // 201/409 status codes the generated wrapper can't express.
  http.post("*/v1/notes/:noteId/transcription-sessions", async ({ params }) => {
    try {
      const data = mockDb.createSession(id(params.noteId));
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
      // 세션을 못 만드는 이유는 "노트가 없다"가 아니라 충돌이다. 404로 흘리면 web이
      // 노트 404 경로(빈 상태 + 재시도)로 갈라진다. 문구는 계약의 예시를 그대로 쓴다 —
      // web이 코드별 문구를 다시 만들면 서버가 바뀔 때마다 갈라진다.
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
            message: msg,
            details: null,
          },
        },
        { status: 404 }
      );
    }
  }),

  // Workspace members / invitations / notifications
  http.get("*/v1/workspaces/:workspaceId/members", ({ params }) =>
    commandResult(() => ({
      members: mockDb.listMembers(id(params.workspaceId)),
    }))
  ),
  http.get("*/v1/workspaces/:workspaceId/invitations", ({ params }) =>
    commandResult(() => ({
      invitations: mockDb.listInvitations(id(params.workspaceId)),
    }))
  ),
  getGetNotificationsMockHandler(() => ({
    success: true,
    data: mockDb.listNotifications(),
    error: null,
  })),
  http.put("*/v1/notifications/:notificationId/read", ({ params }) =>
    commandResult(() => mockDb.markNotificationRead(id(params.notificationId)))
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
    invitationResult(() => mockDb.acceptInvitation(id(params.invitationId)))
  ),
  http.post("*/v1/invitations/:invitationId/decline", ({ params }) =>
    invitationResult(() => mockDb.declineInvitation(id(params.invitationId)))
  ),
  // 초대받은 사람은 workspaceId 를 모른다 — 이 경로가 수락 전 미리보기를 준다.
  http.get("*/v1/invitations/:invitationId", ({ params }) =>
    invitationResult(() => mockDb.getInvitationPreview(id(params.invitationId)))
  ),
  http.get("*/v1/users/me/notification-preferences", () =>
    resultOf(() => mockDb.getNotificationPreferences(), BAD_REQUEST)
  ),
  http.put("*/v1/users/me/notification-preferences", async ({ request }) =>
    resultOf(
      async () =>
        mockDb.updateNotificationPreferences(
          (await request.json()) as NotificationPreferences
        ),
      BAD_REQUEST
    )
  ),
  http.delete("*/v1/workspaces/:workspaceId", ({ params }) => {
    try {
      mockDb.deleteWorkspace(id(params.workspaceId));
    } catch (error) {
      const code = (error as Error).message;
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code, message: code, details: null },
        },
        { status: code === "WORKSPACE_NOT_FOUND" ? 404 : 409 }
      );
    }
    // 계약은 bodyless 204다.
    return new HttpResponse(null, { status: 204 });
  }),

  // Meeting / analysis / integrations
  http.get("*/v1/notes/:noteId/analyses/latest", ({ params }) =>
    commandResult(() => mockDb.getLatestAnalysis(id(params.noteId)))
  ),
  http.get("*/v1/workspaces/:workspaceId/integrations", ({ params }) =>
    commandResult(() => ({
      integrations: mockDb.listIntegrations(id(params.workspaceId)),
    }))
  ),

  http.post("*/v1/notes/:noteId/meeting-end", ({ params }) =>
    commandResult(() => mockDb.endMeeting(id(params.noteId)), 202)
  ),
  http.post("*/v1/notes/:noteId/analyses", ({ params }) =>
    commandResult(() => mockDb.requestAnalysis(id(params.noteId)), 202)
  ),
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
      // 계약은 bodyless 204다.
      return new HttpResponse(null, { status: 204 });
    }
  ),

  // OAuth는 외부 도메인으로 리다이렉트하는 흐름이라 서비스 워커가 가로챌 수 없다.
  // 목에서는 우리 도메인의 목 전용 승인 화면으로 보내고 거기서 callback으로 돌려보낸다.
  // 이 경로는 fetch 대상이 아니다. 계약이 302 리다이렉트라 생성 훅으로 부르면 응답 본문이
  // HTML이고 apiFetch의 JSON 파싱이 깨진다 — 실제 서버(Linear·GitHub로 이동)도 마찬가지다.
  // web은 window.location으로 이동해야 한다. 목은 계약대로 302를 돌려준다.
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
    } catch {
      // 이미 연결된 상태로 돌아오는 것은 왕복의 정상 재시도다. 화면은 결과만 보면 된다.
    }
    // 설정 화면은 아직 없다(APP-115). 존재하는 워크스페이스 화면으로 돌려보낸다.
    return new HttpResponse(null, {
      status: 302,
      headers: { Location: `/w/${workspaceId}` },
    });
  }),

  // Agent chat sessions (SSE 전송은 sse-handler.ts가 맡는다)
  http.post("*/v1/agent-chats", async ({ request }) => {
    const body = (await request.json()) as {
      scope: string;
      workspaceId?: string | null;
      noteId?: string | null;
    };
    return commandResult(() => mockDb.createAgentChat(body), 201);
  }),
  getGetActiveAgentChatMockHandler(({ request }) => {
    const url = new URL(request.url);
    return {
      success: true,
      data: mockDb.getActiveAgentChat({
        scope: url.searchParams.get("scope") ?? "workspace",
        workspaceId: url.searchParams.get("workspaceId"),
        noteId: url.searchParams.get("noteId"),
      }),
      error: null,
    };
  }),
  http.get("*/v1/agent-chats/:chatId/messages", ({ params }) =>
    commandResult(() => ({
      messages: mockDb.getAgentChatMessages(id(params.chatId)),
    }))
  ),
  http.get("*/v1/notes/:noteId/chat/messages", ({ params }) =>
    commandResult(() => mockDb.getNoteSharedChat(id(params.noteId)))
  ),

  // 목 전용(계약 밖, `_mock` 접두사): 관전자 화면을 재현하려고 남의 잠금을 심는다.
  // e2e는 페이지 안에서 fetch로 이 경로를 쳐 서비스 워커가 상태를 세우게 한다.
  http.post(
    "*/v1/notes/:noteId/_mock/foreign-lock",
    async ({ request, params }) => {
      const body = (await request.json().catch(() => ({}))) as {
        lockedBy?: string | null;
      };
      // 명시적 null은 잠금 해제다 — 생략했을 때만 기본 이름을 넣는다(`??`는 null도 덮어 해제를 막는다).
      const lockedBy = body.lockedBy === undefined ? "김민수" : body.lockedBy;
      mockDb.seedForeignLock(id(params.noteId), lockedBy);
      return new HttpResponse(null, { status: 204 });
    }
  ),

  // ── MVP2 ────────────────────────────────────────────────────────────────
  http.get("*/v1/workspaces/:workspaceId/notes", ({ params, request }) =>
    resultOf(
      () =>
        mockDb.listWorkspaceNotes(
          id(params.workspaceId),
          searchToNoteParams(new URL(request.url).searchParams)
        ),
      notFound("WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다.")
    )
  ),
  http.post("*/v1/workspaces/:workspaceId/notes", async ({ request, params }) =>
    resultOf(
      async () => {
        const body = (await request.json()) as NoteCreateRequest;
        const workspaceId = id(params.workspaceId);
        const projects = mockDb.listProjects(workspaceId);
        const projectId =
          body.projectId ??
          projects.find((project) => project.isDefault)?.projectId ??
          projects[0]?.projectId;
        if (!projectId) throw new Error("PROJECT_NOT_FOUND");
        return mockDb.createNote(projectId, body);
      },
      BAD_REQUEST,
      201
    )
  ),
  // 204는 본문이 없어야 한다. resultOf는 모든 성공을 JSON 봉투로 만들어
  // `HttpResponse.json(..., {status: 204})`가 TypeError를 던진다 — 직접 응답한다.
  http.delete("*/v1/notes/:noteId", ({ params }) => {
    try {
      mockDb.deleteNote(id(params.noteId));
      return new HttpResponse(null, { status: 204 });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "MEETING_IN_PROGRESS") {
        return HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code,
              message: "기록 중인 회의는 삭제할 수 없습니다.",
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
            code: "NOTE_NOT_FOUND",
            message: "노트를 찾을 수 없습니다.",
            details: null,
          },
        },
        { status: 404 }
      );
    }
  }),
  http.put("*/v1/notes/:noteId/speakers", async ({ request, params }) =>
    resultOf(() => {
      const noteId = id(params.noteId);
      return request
        .json()
        .then((body) => {
          mockDb.assignSpeaker(noteId, body as SpeakerAssignmentRequest);
          return {
            segments: mockDb.listSegments(noteId),
            speakers: mockDb.listSpeakers(noteId),
          };
        });
    }, notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다."))
  ),
  http.put("*/v1/notifications/read-all", () =>
    resultOf(() => mockDb.readAllNotifications(), BAD_REQUEST)
  ),
  http.get("*/v1/workspaces/:workspaceId/action-items", ({ params, request }) =>
    resultOf(
      () =>
        mockDb.listActionItems(
          id(params.workspaceId),
          searchToActionItemParams(new URL(request.url).searchParams)
        ),
      notFound("WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다.")
    )
  ),
  http.patch("*/v1/action-items/:actionItemId", async ({ request, params }) =>
    resultOf(
      async () =>
        mockDb.updateActionItem(
          id(params.actionItemId),
          (await request.json()) as ActionItemUpdateRequest
        ),
      notFound("ACTION_ITEM_NOT_FOUND", "액션 아이템을 찾을 수 없습니다.")
    )
  ),
];
