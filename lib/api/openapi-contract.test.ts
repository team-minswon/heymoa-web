import { readdirSync, readFileSync } from "node:fs";
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";

const source = readFileSync("openapi3.yml", "utf8");
const document = parseDocument(source, { uniqueKeys: true });

function api() {
  return document.toJS() as {
    paths: Record<
      string,
      Record<string, { operationId?: string; requestBody?: unknown }>
    >;
    components: {
      schemas: Record<string, unknown>;
      securitySchemes: Record<string, unknown>;
    };
  };
}

describe("OpenAPI contract", () => {
  it("has no duplicate YAML keys", () => {
    expect(document.errors).toEqual([]);
  });

  it("gives every operation a unique operationId", () => {
    const ids = Object.values(api().paths).flatMap((path) =>
      Object.values(path)
        .map((operation) => operation?.operationId)
        .filter((id): id is string => Boolean(id))
    );

    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it("defines the minimal user and workspace commands", () => {
    expect(api().paths["/v1/users/me"]?.get?.operationId).toBe(
      "getCurrentUser"
    );
    expect(api().paths["/v1/workspaces"]?.get?.operationId).toBe(
      "getWorkspaces"
    );
    expect(api().paths["/v1/workspaces"]?.post?.operationId).toBe(
      "createWorkspace"
    );
    expect(api().paths["/v1/workspaces/{workspaceId}"]?.put?.operationId).toBe(
      "updateWorkspace"
    );
  });

  /**
   * 기본 워크스페이스는 서버에서 사라졌다(APP-401) — 「로그인 후 어디로 갈지」는 브라우저의
   * 마지막 방문 기록으로 옮겼다. 계약에 다시 들어오면 그 규칙이 두 벌이 된다.
   */
  it("does not expose a language field or any default-workspace surface", () => {
    expect(source).not.toContain("/v1/workspaces/default:");
    expect(source).not.toContain("/v1/users/me/default-workspace:");
    expect(source).not.toContain("isDefault:");
    expect(source).not.toMatch(/^\s+language:/m);
  });

  it("starts transcription without a request body", () => {
    expect(
      api().paths["/v1/notes/{noteId}/transcription-sessions"]?.post
        ?.requestBody
    ).toBeUndefined();
  });

  it("models the four meeting states and required timing snapshots", () => {
    const schemas = api().components.schemas as Record<
      string,
      {
        properties: {
          data: {
            required: string[];
            properties: {
              meetingStatus?: { enum: string[] };
              notes?: {
                items: {
                  required: string[];
                  properties: { meetingStatus?: { enum: string[] } };
                };
              };
            };
          };
        };
      }
    >;

    expect(
      schemas.NoteResponse.properties.data.properties.meetingStatus?.enum
    ).toEqual(["NOT_STARTED", "IN_PROGRESS", "PAUSED", "ENDED"]);
    expect(schemas.NoteResponse.properties.data.required).toEqual(
      expect.arrayContaining(["recordedDurationMs", "activeSessionStartedAt"])
    );
    expect(
      schemas.NoteListResponse.properties.data.properties.notes?.items.required
    ).toEqual(
      expect.arrayContaining([
        "recordedDurationMs",
        "activeSessionStartedAt",
        "lastRecordedAt",
      ])
    );
    expect(
      schemas.NoteListResponse.properties.data.properties.notes?.items
        .properties.meetingStatus?.enum
    ).toEqual(["NOT_STARTED", "IN_PROGRESS", "PAUSED", "ENDED"]);
  });

  it("omits schemas reachable only from internal routes", () => {
    const schemaNames = Object.keys(api().components.schemas);
    for (const name of [
      "AnalysisResultCallback",
      "AnalysisSucceededCallback",
      "AnalysisFailedCallback",
    ]) {
      expect(schemaNames).not.toContain(name);
    }
  });

  it("omits the internal-only security scheme", () => {
    // 경로만 지우면 securitySchemes에 내부 전용 항목이 남는다 — APP-380 계약 갱신에서 실제로
    // `internalToken`이 딸려 왔고, 경로와 생성 클라이언트만 보는 다른 검사들은 못 잡았다.
    expect(source).not.toContain("X-Internal-Token");
    expect(Object.keys(api().components.securitySchemes)).toEqual([
      "accessCookie",
    ]);
  });

  it("has no pause or resume HTTP operations", () => {
    expect(Object.keys(api().paths)).not.toEqual(
      expect.arrayContaining([
        "/v1/notes/{noteId}/meeting-pause",
        "/v1/notes/{noteId}/meeting-resume",
      ])
    );
  });

  it("requires the current-user image and current session end reasons", () => {
    const schemas = api().components.schemas as {
      CurrentUserResponse: {
        properties: { data: { required: string[] } };
      };
      StartTranscriptionSessionResponse: {
        properties: {
          data: { properties: { endReason: { enum: string[] } } };
        };
      };
    };

    expect(schemas.CurrentUserResponse.properties.data.required).toContain(
      "image"
    );
    expect(
      schemas.StartTranscriptionSessionResponse.properties.data.properties
        .endReason.enum
    ).toEqual([
      "READY_TIMEOUT",
      "CLIENT_DISCONNECTED",
      "CLIENT_PROTOCOL_ERROR",
      "STT_PROVIDER_ERROR",
      "INTERNAL_ERROR",
      // 회의 상태 머신(APP-120)이 추가한 둘. `MEETING_PAUSED`는 이전 세션의 종료 사유라
      // 현재 MeetingStatus에 PAUSED가 있어도 역직렬화를 위해 남겨 둔다.
      "MEETING_ENDED",
      "MEETING_PAUSED",
    ]);
  });

  it("uses discriminated success envelopes", () => {
    const schemas = api().components.schemas as Record<
      string,
      { required?: string[]; properties?: { success?: { type?: string } } }
    >;
    const successEnvelopes = Object.entries(schemas).filter(
      ([name]) => name.endsWith("Response") && !name.endsWith("Request")
    );

    expect(successEnvelopes.length).toBeGreaterThan(0);
    for (const [, schema] of successEnvelopes) {
      expect(schema.required).toEqual(
        expect.arrayContaining(["success", "data"])
      );
      expect(schema.properties?.success?.type).toBe("boolean");
    }
  });
});

describe("contract sync 2026-07-29", () => {
  it("mirrors the public paths and excludes internal ones", () => {
    const paths = Object.keys(api().paths);
    // APP-281에서 현재 전사 세션 조회 경로가 하나 추가됐다 (32 → 33).
    // APP-340에서 참여자 교체 경로가 하나 더 늘었다 (33 → 34).
    // APP-185에서 토큰 초대 수락 경로가 추가됐다 (34 → 35).
    // APP-379에서 멤버 관리 경로 둘이 늘었다 (35 → 37) — `members/me`(나가기)와
    // `members/{userId}`(역할 변경 PATCH · 추방 DELETE). 후자는 경로 하나에 메서드 둘이다.
    // APP-401에서 `users/me/default-workspace`가 사라졌다 (37 → 36).
    expect(paths).toHaveLength(36);
    expect(paths.filter((path) => path.startsWith("/internal"))).toEqual([]);
  });

  it("exposes the invitation, notification and member operations", () => {
    expect(
      api().paths["/v1/workspaces/{workspaceId}/invitations"]?.post?.operationId
    ).toBe("createWorkspaceInvitation");
    expect(
      api().paths["/v1/invitations/{invitationId}/accept"]?.post?.operationId
    ).toBe("acceptWorkspaceInvitation");
    expect(api().paths["/v1/notifications"]?.get?.operationId).toBe(
      "getNotifications"
    );
    expect(
      api().paths["/v1/workspaces/{workspaceId}/members"]?.get?.operationId
    ).toBe("getWorkspaceMembers");
    // APP-379. 역할 변경과 추방이 같은 경로의 다른 메서드다 — 하나만 검사하면
    // 다른 하나가 계약에서 빠져도 이 테스트가 통과한다.
    expect(
      api().paths["/v1/workspaces/{workspaceId}/members/{userId}"]?.patch
        ?.operationId
    ).toBe("changeWorkspaceMemberRole");
    expect(
      api().paths["/v1/workspaces/{workspaceId}/members/{userId}"]?.delete
        ?.operationId
    ).toBe("removeWorkspaceMember");
    expect(
      api().paths["/v1/workspaces/{workspaceId}/members/me"]?.delete?.operationId
    ).toBe("leaveWorkspace");
  });

  it("exposes the chat, approval, meeting and analysis operations", () => {
    expect(
      api().paths["/v1/agent-chats/{chatId}/messages"]?.post?.operationId
    ).toBe("sendAgentChatMessage");
    expect(
      api().paths["/v1/notes/{noteId}/chat/messages"]?.post?.operationId
    ).toBe("sendNoteSharedChatMessage");
    expect(
      api().paths["/v1/agent-chats/{chatId}/approvals/{approvalId}"]?.post
        ?.operationId
    ).toBe("resolveToolApproval");
    expect(
      api().paths["/v1/notes/{noteId}/meeting-end"]?.post?.operationId
    ).toBe("endMeeting");
    expect(
      api().paths["/v1/notes/{noteId}/analyses/latest"]?.get?.operationId
    ).toBe("getLatestAnalysis");
  });
});

describe("generated client", () => {
  it("never generates a client for internal paths", () => {
    const files = readdirSync("lib/api/generated", { recursive: true })
      .map(String)
      .filter((name) => name.endsWith(".ts"));
    const offenders = files.filter((name) =>
      readFileSync(`lib/api/generated/${name}`, "utf8").includes("/internal/")
    );

    expect(files.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
