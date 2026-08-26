import { HttpResponse, http } from "msw";
import { mockDb } from "@/lib/mocks/db";
// 턴은 스트림의 사실이라 `mockDb`가 모른다 — 저장된 행만 안다.
import { agentChatTurnState, runningTurnOf } from "@/lib/mocks/sse-handler";

// 생성 mock 래퍼는 **실패 경로가 없는 조회**에만 쓴다 — 래퍼가 항상 200을 주기 때문이다.
// 나머지는 아래 `resultOf`와 함께 직접 `http.*`로 쓴다.
import { getGetCurrentUserMockHandler } from "@/lib/api/generated/users/users.msw";
import { getGetWorkspacesMockHandler } from "@/lib/api/generated/workspaces/workspaces.msw";
import { getGetNotificationsMockHandler } from "@/lib/api/generated/notifications/notifications.msw";

import type {
  CreateWorkspaceRequest,
  ProjectRequest,
  NoteRequest,
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
  "WORKSPACE_NOT_FOUND",
]);

const INVITATION_FORBIDDEN_CODES = new Set(["INVITATION_EMAIL_MISMATCH"]);

/**
 * 실서버 봉투는 코드별 한국어 메시지를 담는데(openapi3.yml) 목은 코드를 그대로 넣고 있었다.
 * dev는 MSW로 도니 web이 `errorMessageOf`로 서버 문구를 그리려면 목도 같은 메시지를 줘야 한다.
 */
const INVITATION_ERROR_MESSAGES: Record<string, string> = {
  ALREADY_WORKSPACE_MEMBER: "이미 워크스페이스 멤버입니다.",
  INVITATION_EXPIRED: "만료된 초대입니다.",
  INVITATION_EMAIL_MISMATCH: "초대 대상 이메일이 아닙니다.",
  DUPLICATE_PENDING_INVITATION: "이미 대기 중인 초대가 있습니다.",
};

/**
 * `resultOf`가 기본값이 아닌 코드로 떨어질 때 쓸 문구. 없으면 원시 코드가 그대로
 * `error.message`에 들어가 실서버 봉투와 갈라진다 — `errorMessageOf`가 그걸 그대로 그린다.
 */
const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  NOTE_NOT_FOUND: "노트를 찾을 수 없습니다.",
  WORKSPACE_NOT_FOUND: "워크스페이스를 찾을 수 없습니다.",
  PROJECT_NOT_FOUND: "프로젝트를 찾을 수 없습니다.",
  NOT_WORKSPACE_MEMBER: "워크스페이스 멤버만 참여자로 등록할 수 있습니다.",
  NOT_NOTE_PARTICIPANT: "회의 참석자만 화자를 확인할 수 있습니다.",
  SPEAKER_LABEL_NOT_FOUND: "해당 화자를 찾을 수 없습니다.",
  DIARIZATION_NOT_MAPPED: "화자 분리가 아직 끝나지 않았습니다.",
  PARTICIPANT_NOT_IN_NOTE: "회의 참여자가 아닌 사람은 연결할 수 없습니다.",
};

/**
 * 전사 세션 생성이 409로 거절되는 이유들. 문구는 계약(`openapi3.yml`)의 409 예시 그대로다.
 */
const SESSION_CONFLICTS: Record<string, string> = {
  ACTIVE_TRANSCRIPTION_SESSION: "이미 진행 가능한 전사 세션이 있습니다.",
  MEETING_ALREADY_ENDED: "이미 종료된 회의입니다.",
};

/** 권한 문제는 403이다 — 없음(404)이나 상태 충돌(409)과 구분해야 화면이 다르게 다룬다. */
const FORBIDDEN_CODES = new Set(["NOT_MEETING_STARTER", "NOT_NOTE_PARTICIPANT"]);

const NOT_FOUND_CODES = new Set([
  "NOTE_NOT_FOUND",
  "WORKSPACE_NOT_FOUND",
  "PROJECT_NOT_FOUND",
  "TRANSCRIPTION_SESSION_NOT_FOUND",
  "ANALYSIS_JOB_NOT_FOUND",
  "INTEGRATION_NOT_FOUND",
  "NOTIFICATION_NOT_FOUND",
  "AGENT_CHAT_NOT_FOUND",
  "SPEAKER_LABEL_NOT_FOUND",
]);

/** 요청 값이 틀린 것은 400이다 — 없음(404)이나 상태 충돌(409)과 구분한다. */
const BAD_REQUEST_CODES = new Set(["NOT_WORKSPACE_MEMBER"]);

const NOT_WORKSPACE_MEMBER = {
  code: "NOT_WORKSPACE_MEMBER",
  message: "워크스페이스 멤버만 참여자로 등록할 수 있습니다.",
  status: 400,
} as const;

/** mockDb가 던지는 계약 코드. 이것 말고는 목 자신의 버그이므로 fallback으로 떨어뜨린다. */
const KNOWN_CODES = new Set([
  ...NOT_FOUND_CODES,
  ...BAD_REQUEST_CODES,
  ...FORBIDDEN_CODES,
  ...INVITATION_NOT_FOUND_CODES,
  "PROJECT_HAS_NOTES",
  "NOT_MEETING_STARTER",
  "DIARIZATION_NOT_MAPPED",
  // 422 — 연결 대상이 참여자가 아니다. 부른 사람이 아닌 것(403)과 가른다
  "PARTICIPANT_NOT_IN_NOTE",
]);

function statusOf(code: string) {
  if (FORBIDDEN_CODES.has(code)) return 403;
  if (NOT_FOUND_CODES.has(code)) return 404;
  if (BAD_REQUEST_CODES.has(code)) return 400;
  if (code === "PARTICIPANT_NOT_IN_NOTE") return 422;
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

/**
 * 멤버 조작(역할 변경·추방·나가기)은 초대와 다른 상태 코드 집합을 쓴다 — 403 권한 없음,
 * 400 자기 자신 추방, 404 멤버/워크스페이스 없음, 409 마지막 ADMIN. 문구는 계약
 * (openapi3.yml)의 예시 그대로다. 성공은 셋 다 204 무본문이다.
 */
const MEMBER_ERROR_MESSAGES: Record<string, string> = {
  WORKSPACE_MEMBER_NOT_FOUND: "워크스페이스 멤버를 찾을 수 없습니다.",
  WORKSPACE_NOT_FOUND: "워크스페이스를 찾을 수 없습니다.",
  LAST_WORKSPACE_ADMIN: "워크스페이스에는 관리자가 최소 한 명 있어야 합니다.",
  WORKSPACE_ACCESS_DENIED: "워크스페이스를 변경할 권한이 없습니다.",
  BAD_REQUEST: "잘못된 요청입니다.",
};

const MEMBER_NOT_FOUND_CODES = new Set([
  "WORKSPACE_MEMBER_NOT_FOUND",
  "WORKSPACE_NOT_FOUND",
]);
const MEMBER_FORBIDDEN_CODES = new Set(["WORKSPACE_ACCESS_DENIED"]);
const MEMBER_BAD_REQUEST_CODES = new Set(["BAD_REQUEST"]);

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
  http.get("*/v1/projects/:projectId/notes", ({ params }) =>
    resultOf(
      () => ({ notes: mockDb.listNotes(id(params.projectId)) }),
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
  http.put("*/v1/notes/:noteId/participants", async ({ request, params }) =>
    resultOf(
      async () =>
        mockDb.replaceNoteParticipants(
          id(params.noteId),
          ((await request.json()) as { userIds?: string[] }).userIds ?? []
        ),
      // 기본 BAD_REQUEST를 쓰면 error.message에 원시 코드가 그대로 들어간다.
      // 계약의 400 문구를 그대로 돌려줘야 자동 토스트가 실제 서버와 같아진다.
      NOT_WORKSPACE_MEMBER
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

  // 손으로 쓴다(생성 목이 아니라): 204는 본문이 없어야 하는데 resultOf는 모든 성공을 JSON
  // 봉투로 만들어 `HttpResponse.json(..., {status: 204})`가 TypeError를 던진다.
  http.delete("*/v1/notes/:noteId", ({ params }) => {
    try {
      mockDb.deleteNote(id(params.noteId));
      return new HttpResponse(null, { status: 204 });
    } catch (error) {
      const code =
        error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
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
      const notFound = code === "NOTE_NOT_FOUND";
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code,
            // 문구는 서버 계약 것을 쓴다 — 원시 코드를 넣으면 토스트에 그대로 나온다.
            message: notFound ? "노트를 찾을 수 없습니다." : code,
            details: null,
          },
        },
        { status: notFound ? 404 : 409 }
      );
    }
  }),

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
  http.get("*/v1/notes/:noteId/transcription-sessions/current", ({ params }) =>
    resultOf(
      () => mockDb.getCurrentSession(id(params.noteId)),
      notFound("NOTE_NOT_FOUND", "노트를 찾을 수 없습니다.")
    )
  ),
  http.put(
    "*/v1/notes/:noteId/speakers/:label",
    async ({ params, request }) => {
      const body = (await request.json()) as { userId?: string | null };
      return resultOf(
        () => ({
          speakers: mockDb.assignSpeaker(
            id(params.noteId),
            String(params.label),
            body.userId ?? null
          ),
        }),
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
      // 노트가 지워졌거나(NOTE_NOT_FOUND) 권한 승인과 이 POST 사이에 추방된 경우다
      // (WORKSPACE_NOT_FOUND). 문구도 계약의 것을 준다 — 시작 실패는 전역 토스트를 끄고
      // 프로바이더가 이 문구를 그대로 그리므로, 코드를 문구 자리에 흘리면 화면에
      // `NOTE_NOT_FOUND`가 그대로 뜬다.
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
  }),

  // Workspace members / invitations / notifications
  http.get("*/v1/workspaces/:workspaceId/members", ({ params }) =>
    commandResult(() => ({
      members: mockDb.listMembers(id(params.workspaceId)),
    }))
  ),
  // 본문 파싱은 반드시 memberResult 안에서 한다. 생성 훅의 `data`가 optional이라 본문 없는
  // 요청이 실제로 날아올 수 있는데, 밖에서 파싱하면 SyntaxError가 그대로 새어 MSW가 500과
  // 스택 트레이스를 돌려준다 — 실제 서버는 같은 입력에 400 봉투를 준다.
  http.patch(
    "*/v1/workspaces/:workspaceId/members/:userId",
    ({ params, request }) =>
      memberResult(async () => {
        // 좁은 유니온으로 단언하지 않는다 — 단언은 런타임에 아무것도 막지 않으면서 검증이
        // 끝난 것처럼 보이게 한다. 계약에 없는 역할은 mockDb가 400으로 막는다.
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
  // 정적 경로(/members/me)가 :userId보다 먼저 와야 한다 — MSW는 등록 순서대로 매칭한다.
  http.delete("*/v1/workspaces/:workspaceId/members/me", ({ params }) =>
    memberResult(() => mockDb.leaveWorkspace(id(params.workspaceId)))
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
  // 목 세계의 토큰은 invitationId 그 자체다 — 실서버의 digest 매칭까지 흉내내지 않는다
  http.post("*/v1/invitations/accept-by-token", async ({ request }) => {
    const body = (await request.json()) as { token?: string };
    return invitationResult(() =>
      mockDb.acceptInvitationByToken(body.token ?? "")
    );
  }),
  http.post("*/v1/invitations/:invitationId/decline", ({ params }) =>
    invitationResult(() => mockDb.declineInvitation(id(params.invitationId)))
  ),

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
  http.post(
    "*/v1/workspaces/:workspaceId/agent-chats",
    async ({ request, params }) => {
      const body = (await request.json()) as { title?: string | null };
      return commandResult(
        () =>
          mockDb.createAgentChat({
            workspaceId: id(params.workspaceId),
            ...body,
          }),
        201
      );
    }
  ),
  /**
   * 대화 목록. **정렬·상한은 목 DB가, 도는 턴은 스트림이 안다** — 두 출처를 여기서 합친다.
   * 멤버가 아닌 워크스페이스는 `assertWorkspace`가 404로 은닉한다(계약).
   */
  http.get("*/v1/workspaces/:workspaceId/agent-chats", ({ params }) => {
    const workspaceId = id(params.workspaceId);
    return commandResult(() => ({
      chats: mockDb.listAgentChats({ workspaceId }).map((chat) => ({
        ...chat,
        runningTurn: runningTurnOf(chat.chatId),
      })),
    }));
  }),
  // 히스토리와 **이어받기 상태**를 함께 준다. 커서·도는 턴·마지막 턴이 없으면 돌아온
  // 브라우저는 무엇을 어디서부터 이어야 하는지 알 방법이 없다.
  http.get("*/v1/agent-chats/:chatId/messages", ({ params }) =>
    commandResult(() => ({
      messages: mockDb.getAgentChatMessages(id(params.chatId)),
      ...agentChatTurnState(id(params.chatId)),
    }))
  ),

  // 목 전용(계약 밖, `_mock` 접두사): 대기 중인 분석을 완료로 넘긴다.
  // 실제로는 heymoa-ai의 callback이 채우는데 목에는 그걸 밀어줄 주체가 없어,
  // 이게 없으면 **요약 화면(개요·액션 아이템·인사이트)을 목에서 한 번도 볼 수 없다.**
  http.post("*/v1/notes/:noteId/_mock/advance-analysis", ({ params }) => {
    mockDb.advanceAnalysis(id(params.noteId));
    return new HttpResponse(null, { status: 204 });
  }),

];
