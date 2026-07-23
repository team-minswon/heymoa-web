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
    components: { schemas: Record<string, unknown> };
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
    expect(
      api().paths["/v1/users/me/default-workspace"]?.put?.operationId
    ).toBe("changeDefaultWorkspace");
  });

  it("does not expose a language field or default-workspace read route", () => {
    expect(source).not.toContain("/v1/workspaces/default:");
    expect(source).not.toMatch(/^\s+language:/m);
  });

  it("starts transcription without a request body", () => {
    expect(
      api().paths["/v1/notes/{noteId}/transcription-sessions"]?.post
        ?.requestBody
    ).toBeUndefined();
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
      // 회의 상태 머신(APP-120)이 추가한 둘 — 시작자가 회의를 끝내거나 멈추면
      // 진행 중인 전사 세션이 이 사유로 종료된다.
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

describe("contract sync 2026-07-23", () => {
  it("mirrors 34 public paths and excludes internal ones", () => {
    const paths = Object.keys(api().paths);
    expect(paths).toHaveLength(34);
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
