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
  /**
   * ★ **지어낸 스키마 이름을 미러에 들이지 않는다.**
   *
   * `restdocs-api-spec` 은 서버 쪽에서 schema 이름을 못 찾으면 경로 + 해시로 짓는다
   * (`v1-notes-noteId-speakers-label-647408416`). 그대로 복사하면 orval 이 그 이름으로
   * 타입을 만들고, **경로가 바뀌면 타입 이름도 같이 바뀐다.**
   *
   * 서버가 생성 시점에 막게 했지만(`OpenApi3Normalizer.requireNamedSchemas`), 이 미러는
   * 손으로 쓰는 파일이라 그 게이트를 안 지난다. 여기서 한 번 더 본다.
   */
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
      "AmendDelta",
      "AnalysisCandidateEvidenceLink",
      "AnalysisCandidateLedger",
      "AnalysisCandidateLedgerEntry",
      "AnalysisSection",
      "AnalysisResultCallback",
      "AnalysisSucceededCallback",
      "AnalysisFailedCallback",
      "ApplyRunRequest",
      "CandidateHead",
      "ContextAnchors",
      "ContextCandidateOperationsResponse",
      "ContextClassificationRunResponse",
      "ContextClassificationSnapshotResponse",
      "CorrectDelta",
      "CreateDelta",
      "DropReason",
      "DroppedDelta",
      "Evidence",
      "InternalNoteContextResponse",
      "InternalTranscriptSegmentsResponse",
      "InternalTranscriptUpdatesResponse",
      "InternalWorkspaceNotesResponse",
      "MeetingItem",
      "ReaffirmDelta",
      "RenderedLine",
      "ResolveDelta",
      "ResolveResult",
      "ResolvedDelta",
      "RetractDelta",
      "Sha256",
      "ShortlistedCandidate",
      "SnapshotBatch",
      "SnapshotSegment",
      "UtcMillisTimestamp",
    ]) {
      expect(schemaNames).not.toContain(name);
    }
    expect(Object.keys(api().paths)).toHaveLength(45);
    // APP-551: 턴 스트림 계약이 `AgentChatTurnResponse`(202 {turnId}) 하나를 더한다.
    expect(schemaNames).toHaveLength(62);
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
      // 워치독이 조각이 끊긴 세션을 닫은 것(APP-531). `CLIENT_DISCONNECTED`와 가른 이유는
      // 워치독이 원인을 모르기 때문이다 — 브라우저가 끊었는지 서버가 죽었는지 구분이 안 된다.
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
    // APP-281에서 현재 전사 세션 조회 경로가 하나 추가됐다 (32 → 33).
    // APP-340에서 참여자 교체 경로가 하나 더 늘었다 (33 → 34).
    // APP-185에서 토큰 초대 수락 경로가 추가됐다 (34 → 35).
    // APP-379에서 멤버 관리 경로 둘이 늘었다 (35 → 37) — `members/me`(나가기)와
    // `members/{userId}`(역할 변경 PATCH · 추방 DELETE). 후자는 경로 하나에 메서드 둘이다.
    // APP-401에서 `users/me/default-workspace`가 사라졌다 (37 → 36).
    // APP-421에서 `notes/{noteId}/speakers/{label}`이 생겼다 (36 → 37).
    // APP-490·492에서 임시 참여자 경로 다섯이 늘었다 (37 → 42) —
    // `notes/{noteId}/participants/guests`(만들기 POST · 전체 교체 PUT),
    // `workspaces/{workspaceId}/guests`(목록),
    // `.../guests/{guestId}`(삭제), `.../guests/{guestId}/link`,
    // `.../guests/{guestId}/link-preview`.
    // V31에서 발화 단위 화자 지정이 생겼다 (42 → 43) —
    // `notes/{noteId}/segments/{segmentId}/speaker`.
    // APP-459에서 후보 조회와 revision 이력 둘이 늘었다 (43 → 45) —
    // `notes/{noteId}/context-candidates`와 `.../context-candidates/{candidateId}/revisions`.
    expect(paths).toHaveLength(45);
    expect(paths.filter((path) => path.startsWith("/internal"))).toEqual([]);
  });

  /**
   * **미러는 public 만 담는다.** internal 경로를 지우면서 그 경로에서만 닿던 스키마를 남기면
   * 계약에 죽은 정의가 쌓이고, orval 이 아무도 안 쓰는 타입을 만든다.
   *
   * 여기서는 **도달 가능성으로 판정한다** — 이름을 나열하면 계약이 바뀔 때마다 낡는다.
   */
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
    // internal 전용 인증 수단도 남기지 않는다.
    expect(Object.keys(components.securitySchemes ?? {})).toEqual([
      "accessCookie",
    ]);
  });

  /**
   * APP-459 후보 계약. **`oneOf` 세 갈래가 상태 행렬 자체다** — 하나라도 빠지면
   * 「OPEN 인데 RETRACTED」 같은 조합이 계약상 유효해진다.
   */
  it("후보 계약의 상태 행렬과 v1 생산값을 고정한다", () => {
    const schemas = (api() as unknown as Record<string, never>)
      .components as unknown as { schemas: Record<string, never> };
    const revision = schemas.schemas.ContextCandidateRevision as unknown as {
      oneOf: { title: string }[];
      properties: Record<string, { enum?: unknown[]; nullable?: boolean }>;
    };

    expect(revision.oneOf.map((branch) => branch.title)).toEqual([
      "OpenCandidate",
      "RetractedCandidate",
      "ResolvedQuestion",
    ]);
    expect(revision.properties.status.enum).toEqual(["OPEN", "CLOSED"]);
    expect(revision.properties.closeReason.enum).toEqual([
      "RETRACTED",
      "RESOLVED",
      null,
    ]);
    expect(revision.properties.closeReason.nullable).toBe(true);
    // POSTPROCESS 는 producer 가 없어 v1 계약에서 걷혔다.
    expect(revision.properties.revisionSource.enum).toEqual(["LIVE"]);
  });

  it("APP-459 public 두 경로가 미러에 있다", () => {
    expect(
      api().paths["/v1/notes/{noteId}/context-candidates"]?.get?.operationId
    ).toBe("getContextCandidates");
    expect(
      api().paths["/v1/notes/{noteId}/context-candidates/{candidateId}/revisions"]
        ?.get?.operationId
    ).toBe("getContextCandidateRevisions");
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
