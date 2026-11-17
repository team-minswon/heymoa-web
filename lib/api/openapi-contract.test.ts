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
  it("gives every schema a human name — no path hashes", () => {
    const generated = Object.keys(api().components.schemas).filter((name) =>
      /\d{6,}/.test(name)
    );

    expect(generated).toEqual([]);
  });

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

  it("exposes language only as the account display language and has no default-workspace surface", () => {
    expect(source).not.toContain("/v1/workspaces/default:");
    expect(source).not.toContain("/v1/users/me/default-workspace:");
    expect(source).not.toContain("isDefault:");
    const schemas = api().components.schemas as Record<string, unknown>;
    expect(
      Object.keys(schemas)
        .filter((name) => JSON.stringify(schemas[name]).includes('"language"'))
        .sort()
    ).toEqual([
      "AdminUserListResponse",
      "AuthSessionResponse",
      "CurrentUserResponse",
      "DesktopLoginStartRequest",
      "UpdateCurrentUserRequest",
    ]);
  });

  it("starts transcription with an optional clientInstanceId body", () => {
    const requestBody = api().paths["/v1/notes/{noteId}/transcription-sessions"]
      ?.post?.requestBody as
      | { required?: boolean; content: Record<string, { schema: unknown }> }
      | undefined;
    expect(requestBody?.required).toBeUndefined();
    expect(requestBody?.content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/StartTranscriptionSessionRequest",
    });
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
      "AnalysisCandidateEvidenceLink",
      "AnalysisCandidateLedger",
      "AnalysisCandidateLedgerEntry",
      "AnalysisFailedCallback",
      "AnalysisResultCallback",
      "AnalysisSection",
      "AnalysisSucceededCallback",
      "ApplyTranscriptAnalysisRunRequest",
      "DropReason",
      "InternalNoteContextResponse",
      "InternalTranscriptSegmentsResponse",
      "InternalTranscriptUpdatesResponse",
      "InternalWorkspaceNotesResponse",
      "MeetingItem",
      "ProposalChangesResponse",
      "ProposalHead",
      "SnapshotBatch",
      "SnapshotSegment",
      "TranscriptAnalysisRunResponse",
      "TranscriptAnalysisSnapshotResponse",
      "UtcMillisTimestamp",
    ]) {
      expect(schemaNames).not.toContain(name);
    }
  });

  it("APP-685의 네 경로와 필수 초대 필드를 이름으로 확인한다", () => {
    expect(
      api().paths["/v1/workspaces/{workspaceId}/notes"]?.get?.operationId
    ).toBe("getWorkspaceNotes");
    expect(
      api().paths["/v1/workspaces/{workspaceId}/tasks"]?.get?.operationId
    ).toBe("getWorkspaceTasks");
    expect(
      api().paths["/v1/notes/{noteId}/transcript/segments"]
    ).toBeUndefined();
    expect(api().paths["/v1/notes/{noteId}/speakers"]).toBeUndefined();

    const notifications = api().components.schemas.NotificationListResponse as {
      properties: {
        data: {
          properties: { notifications: { items: { required: string[] } } };
        };
      };
    };
    expect(
      notifications.properties.data.properties.notifications.items.required
    ).toContain("invitation");
  });

  it("omits the internal-only security scheme", () => {
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

  it("records login consent from the current-user consent state", () => {
    const record = (
      api().paths["/v1/users/me/consents"] as {
        post?: { operationId: string; responses: Record<string, unknown> };
      }
    ).post;
    const schemas = api().components.schemas as {
      CurrentUserResponse: {
        properties: { data: { required: string[] } };
      };
      RecordConsentRequest: {
        properties: {
          consents: {
            items: { properties: { documentType: { enum: string[] } } };
          };
        };
      };
    };

    expect(record?.operationId).toBe("recordConsents");
    expect(Object.keys(record?.responses ?? {}).sort()).toEqual([
      "204",
      "401",
      "409",
    ]);
    expect(schemas.CurrentUserResponse.properties.data.required).toEqual(
      expect.arrayContaining(["consentRequired", "consents"])
    );
    expect(
      schemas.RecordConsentRequest.properties.consents.items.properties
        .documentType.enum
    ).toEqual(["PRIVACY", "TERMS"]);
  });

  it("requires the current-user image and current session end reasons", () => {
    const schemas = api().components.schemas as {
      CurrentUserResponse: {
        properties: { data: { required: string[] } };
      };
      TranscriptionSessionResponse: {
        properties: {
          data: { properties: { endReason: { enum: string[] } } };
        };
      };
    };

    expect(schemas.CurrentUserResponse.properties.data.required).toContain(
      "image"
    );
    expect(
      schemas.TranscriptionSessionResponse.properties.data.properties.endReason
        .enum
    ).toEqual([
      "READY_TIMEOUT",
      "CLIENT_DISCONNECTED",
      "CLIENT_PROTOCOL_ERROR",
      "STT_PROVIDER_ERROR",
      "INTERNAL_ERROR",
      "MEETING_ENDED",
      "HEARTBEAT_TIMEOUT",
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
    expect(paths).toHaveLength(111);
    expect(paths.filter((path) => path.startsWith("/internal"))).toEqual([]);
  });

  it("public 경로에서 닿지 않는 스키마를 남기지 않는다", () => {
    const doc = api() as unknown as Record<string, unknown>;
    const components = doc.components as {
      schemas: Record<string, unknown>;
      responses?: Record<string, unknown>;
      securitySchemes?: Record<string, unknown>;
    };

    const collect = (node: unknown, into: Set<string>) => {
      if (Array.isArray(node)) {
        for (const item of node) collect(item, into);
        return;
      }
      if (!node || typeof node !== "object") return;
      for (const [key, value] of Object.entries(node)) {
        if (key === "$ref" && typeof value === "string") {
          const name = value.split("/").pop();
          if (value.includes("/schemas/") && name) into.add(name);
          continue;
        }
        collect(value, into);
      }
    };

    const seeds = new Set<string>();
    collect(doc.paths, seeds);
    collect(components.responses ?? {}, seeds);

    const reachable = new Set<string>();
    const stack = [...seeds];
    while (stack.length > 0) {
      const name = stack.pop()!;
      if (reachable.has(name) || !(name in components.schemas)) continue;
      reachable.add(name);
      const next = new Set<string>();
      collect(components.schemas[name], next);
      stack.push(...next);
    }

    expect(
      Object.keys(components.schemas).filter((name) => !reachable.has(name))
    ).toEqual([]);
    expect(Object.keys(components.securitySchemes ?? {})).toEqual([
      "accessCookie",
    ]);
  });

  it("명제 계약의 상태 행렬과 v1 생산값을 고정한다", () => {
    const schemas = (api() as unknown as Record<string, never>)
      .components as unknown as { schemas: Record<string, never> };
    const revision = schemas.schemas.ProposalRevision as unknown as {
      oneOf: { title: string }[];
      properties: Record<string, { enum?: unknown[]; nullable?: boolean }>;
    };

    expect(revision.oneOf.map((branch) => branch.title)).toEqual([
      "OpenProposal",
      "RetractedProposal",
      "ResolvedQuestion",
    ]);
    expect(revision.properties.status.enum).toEqual(["OPEN", "CLOSED"]);
    expect(revision.properties.closeReason.enum).toEqual([
      "RETRACTED",
      "RESOLVED",
      null,
    ]);
    expect(revision.properties.closeReason.nullable).toBe(true);
    expect(revision.properties.revisionSource.enum).toEqual(["LIVE"]);
  });

  it("명제 public 두 경로가 미러에 있다", () => {
    expect(api().paths["/v1/notes/{noteId}/proposals"]?.get?.operationId).toBe(
      "getProposals"
    );
    expect(
      api().paths["/v1/notes/{noteId}/proposals/{proposalId}/revisions"]?.get
        ?.operationId
    ).toBe("getProposalRevisions");
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
    expect(
      api().paths["/v1/workspaces/{workspaceId}/members/{userId}"]?.patch
        ?.operationId
    ).toBe("changeWorkspaceMemberRole");
    expect(
      api().paths["/v1/workspaces/{workspaceId}/members/{userId}"]?.delete
        ?.operationId
    ).toBe("removeWorkspaceMember");
    expect(
      api().paths["/v1/workspaces/{workspaceId}/members/me"]?.delete
        ?.operationId
    ).toBe("leaveWorkspace");
  });

  it("공유 챗봇 경로가 남아 있지 않다", () => {
    expect(
      Object.keys(api().paths).filter((path) => path.includes("/chat/messages"))
    ).toEqual([]);
  });

  it("exposes the chat, approval, meeting and analysis operations", () => {
    expect(
      api().paths["/v1/workspaces/{workspaceId}/agent-chats"]?.get?.operationId
    ).toBe("getAgentChats");
    expect(
      api().paths["/v1/workspaces/{workspaceId}/agent-chats"]?.post?.operationId
    ).toBe("createAgentChat");
    expect(
      api().paths["/v1/agent-chats/{chatId}/messages"]?.post?.operationId
    ).toBe("sendAgentChatMessage");
    expect(
      api().paths["/v1/agent-chats/{chatId}/turns/{turnId}/events"]?.get
        ?.operationId
    ).toBe("subscribeAgentChatTurnEvents");
    expect(
      api().paths["/v1/agent-chats/{chatId}/turns/{turnId}/cancel"]?.post
        ?.operationId
    ).toBe("cancelAgentChatTurn");
    expect(
      api().paths["/v1/agent-chats/{chatId}/approvals/{approvalId}/resolve"]
        ?.post?.operationId
    ).toBe("resolveToolApproval");
    expect(
      api().paths["/v1/notes/{noteId}/meeting-end"]?.post?.operationId
    ).toBe("endMeeting");
    expect(
      api().paths["/v1/notes/{noteId}/analyses/latest"]?.get?.operationId
    ).toBe("getLatestAnalysis");
  });
});

describe("desktop auth contract", () => {
  it("keeps login anonymous but binds integration tickets to the app session", () => {
    const paths = api().paths as unknown as Record<
      string,
      Record<
        string,
        {
          operationId: string;
          security: unknown[];
          requestBody?: {
            content: Record<string, { schema: { $ref: string } }>;
          };
        }
      >
    >;
    const commands = [
      [
        "/v1/auth/desktop/start",
        "startDesktopLogin",
        "DesktopLoginStartRequest",
      ],
      [
        "/v1/auth/desktop/exchange",
        "exchangeDesktopLogin",
        "DesktopLoginExchangeRequest",
      ],
      [
        "/v1/workspaces/{workspaceId}/integrations/{provider}/desktop-ticket",
        "createDesktopIntegrationTicket",
        "DesktopConnectionTicketRequest",
      ],
    ] as const;
    for (const [path, operationId, schema] of commands) {
      expect(paths[path].post.operationId).toBe(operationId);
      expect(
        paths[path].post.requestBody?.content["application/json"].schema.$ref
      ).toBe(`#/components/schemas/${schema}`);
    }
    expect(paths["/v1/auth/desktop/start"].post.security).toEqual([]);
    expect(paths["/v1/auth/desktop/exchange"].post.security).toEqual([]);
    expect(paths["/v1/auth/desktop/authorize"].get.operationId).toBe(
      "authorizeDesktopLogin"
    );
    expect(
      paths[
        "/v1/workspaces/{workspaceId}/integrations/{provider}/desktop-ticket"
      ].post.security
    ).toEqual([{ accessCookie: [] }]);
  });

  it("requires the PKCE/state binding and never puts session tokens in an exchange body", () => {
    const schemas = api().components.schemas as Record<
      string,
      {
        required: string[];
        properties: Record<string, { properties?: Record<string, unknown> }>;
      }
    >;
    expect(schemas.DesktopLoginStartRequest.required).toEqual(
      expect.arrayContaining(["state", "codeChallenge"])
    );
    expect(schemas.DesktopLoginExchangeRequest.required).toEqual(
      expect.arrayContaining(["state", "code", "codeVerifier"])
    );
    expect(schemas.DesktopConnectionTicketRequest.required).toContain("state");
    expect(
      Object.keys(schemas.DesktopLoginStartRequest.properties)
    ).not.toContain("redirectUri");
    expect(
      Object.keys(
        schemas.RefreshTokensResponse.properties.data.properties ?? {}
      )
    ).toEqual(["message"]);
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
