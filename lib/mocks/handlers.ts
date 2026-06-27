import { HttpResponse, http } from "msw";

import { mockState } from "@/lib/mocks/state";

function organizationPublicId(params: Record<string, string | undefined>) {
  return params.organizationPublicId;
}

function keyId(params: Record<string, string | undefined>) {
  return params.keyId;
}

function jsonError(code: string, message: string, status: number) {
  return HttpResponse.json(mockState.appError(code, message), { status });
}

function jsonSuccess<T>(data: T, status = 200) {
  return HttpResponse.json(mockState.appSuccess(data), { status });
}

export const handlers = [
  http.get("*/v1/users/me", () => {
    const body = mockState.getMeResponse();

    if (body.data === null) {
      return jsonError("UNAUTHORIZED", "Authentication required.", 401);
    }

    return jsonSuccess(body.data);
  }),
  http.post("*/v1/auth/refresh", () => {
    mockState.refreshAuth();
    return jsonSuccess(null);
  }),
  http.post("*/v1/auth/logout", () => jsonSuccess(mockState.logout().data)),
  http.get("*/v1/organizations", () =>
    jsonSuccess(mockState.listOrganizations())
  ),
  http.patch(
    "*/v1/organizations/:organizationPublicId",
    async ({ params, request }) => {
      const body = (await request.json()) as { name?: string };
      const updated = mockState.updateOrganization(
        organizationPublicId(params as Record<string, string | undefined>) ??
          "",
        body.name ?? ""
      );

      if (!updated) {
        return jsonError("NOT_FOUND", "Organization not found.", 404);
      }

      return jsonSuccess(updated);
    }
  ),
  http.get("*/v1/organizations/:organizationPublicId", ({ params }) => {
    const organization = mockState.getOrganization(
      organizationPublicId(params as Record<string, string | undefined>) ?? ""
    );

    if (!organization) {
      return jsonError("NOT_FOUND", "Organization not found.", 404);
    }

    return jsonSuccess(organization);
  }),
  http.get("*/v1/organizations/:organizationPublicId/members", ({ params }) => {
    const members = mockState.listMembers(
      organizationPublicId(params as Record<string, string | undefined>) ?? ""
    );

    if (!members) {
      return jsonError("NOT_FOUND", "Organization not found.", 404);
    }

    return jsonSuccess(members);
  }),
  http.get(
    "*/v1/organizations/:organizationPublicId/api-keys",
    ({ params, request }) => {
      const publicId = organizationPublicId(
        params as Record<string, string | undefined>
      );

      if (!mockState.getOrganization(publicId ?? "")) {
        return jsonError("NOT_FOUND", "Organization not found.", 404);
      }

      const url = new URL(request.url);
      const items = mockState.listApiKeys(publicId ?? "", {
        status: url.searchParams.get("status"),
        limit: (() => {
          const value = url.searchParams.get("limit");
          return value ? Number(value) : undefined;
        })(),
      });

      return jsonSuccess(items);
    }
  ),
  http.post(
    "*/v1/organizations/:organizationPublicId/api-keys",
    async ({ params, request }) => {
      const body = (await request.json()) as { name?: string | null };
      const created = mockState.createApiKey(
        organizationPublicId(params as Record<string, string | undefined>) ??
          "",
        body.name
      );

      if (!created) {
        return jsonError("NOT_FOUND", "Organization not found.", 404);
      }

      return jsonSuccess(created, 201);
    }
  ),
  http.patch(
    "*/v1/organizations/:organizationPublicId/api-keys/:keyId",
    async ({ params, request }) => {
      const body = (await request.json()) as { name?: string };
      const updated = mockState.updateApiKey(
        organizationPublicId(params as Record<string, string | undefined>) ??
          "",
        keyId(params as Record<string, string | undefined>) ?? "",
        body.name ?? ""
      );

      if (!updated) {
        return jsonError("API_KEY_NOT_FOUND", "API key not found.", 404);
      }

      return jsonSuccess(updated);
    }
  ),
  http.post(
    "*/v1/organizations/:organizationPublicId/api-keys/:keyId/revoke",
    ({ params }) => {
      const revoked = mockState.revokeApiKey(
        organizationPublicId(params as Record<string, string | undefined>) ??
          "",
        keyId(params as Record<string, string | undefined>) ?? ""
      );

      if (!revoked) {
        return jsonError("API_KEY_NOT_FOUND", "API key not found.", 404);
      }

      return jsonSuccess(revoked);
    }
  ),
];
