import { readFileSync } from "node:fs";
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
    expect(
      api().paths["/v1/workspaces/{workspaceId}"]?.put?.operationId
    ).toBe("updateWorkspace");
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

    expect(
      schemas.CurrentUserResponse.properties.data.required
    ).toContain("image");
    expect(
      schemas.StartTranscriptionSessionResponse.properties.data.properties
        .endReason.enum
    ).toEqual([
      "READY_TIMEOUT",
      "CLIENT_DISCONNECTED",
      "CLIENT_PROTOCOL_ERROR",
      "STT_PROVIDER_ERROR",
      "INTERNAL_ERROR",
    ]);
  });

  it("uses discriminated success envelopes", () => {
    const schemas = api().components.schemas as Record<
      string,
      { required?: string[]; properties?: { success?: { type?: string } } }
    >;
    const successEnvelopes = Object.entries(schemas).filter(([name]) =>
      name.endsWith("Response") && !name.endsWith("Request")
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
