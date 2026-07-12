import { readFileSync } from "node:fs";
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";

const source = readFileSync("openapi3.yml", "utf8");
const document = parseDocument(source, { uniqueKeys: true });

function api() {
  return document.toJS() as {
    paths: Record<string, Record<string, { operationId?: string }>>;
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
    expect(api().paths["/v1/users/me"]?.patch?.operationId).toBe(
      "updateCurrentUser"
    );
    expect(api().paths["/v1/workspaces"]?.get?.operationId).toBe(
      "listWorkspaces"
    );
    expect(api().paths["/v1/workspaces"]?.post?.operationId).toBe(
      "createWorkspace"
    );
    expect(
      api().paths["/v1/workspaces/{workspaceId}"]?.patch?.operationId
    ).toBe("updateWorkspace");
    expect(
      api().paths["/v1/workspaces/{workspaceId}/default"]?.put?.operationId
    ).toBe("setDefaultWorkspace");
  });

  it("does not expose a language field or default-workspace read route", () => {
    expect(source).not.toContain("/v1/workspaces/default:");
    expect(source).not.toMatch(/^\s+language:/m);
  });

  it("uses discriminated success envelopes", () => {
    const schemas = api().components.schemas as Record<
      string,
      { required?: string[]; properties?: { success?: { enum?: boolean[] } } }
    >;
    const successEnvelopes = Object.entries(schemas).filter(([name]) =>
      name.startsWith("AppResponse_")
    );

    expect(successEnvelopes.length).toBeGreaterThan(0);
    for (const [, schema] of successEnvelopes) {
      expect(schema.required).toEqual(
        expect.arrayContaining(["success", "data"])
      );
      expect(schema.properties?.success?.enum).toEqual([true]);
    }
  });
});
