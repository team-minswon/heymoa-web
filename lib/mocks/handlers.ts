import { http, HttpResponse } from "msw";
import type { AppResponse } from "@/lib/api/generated";
import {
  mockApiKeys,
  mockMembers,
  mockOrganization,
  mockUser,
} from "@/lib/mocks/data";

function success<T>(data: T): AppResponse<T> {
  return {
    success: true,
    data,
    error: null,
  };
}

function createdApiKeyName(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "name" in value &&
    typeof value.name === "string" &&
    value.name.trim()
  ) {
    return value.name.trim();
  }

  return "New API key";
}

export const handlers = [
  http.get("*/v1/users/me", () => HttpResponse.json(success(mockUser))),

  http.post("*/v1/auth/refresh", () =>
    HttpResponse.json(success<Record<string, never>>({}))
  ),

  http.post("*/v1/auth/logout", () =>
    HttpResponse.json(success<Record<string, never>>({}))
  ),

  http.post("*/v1/onboarding/profile", () =>
    HttpResponse.json(success({ onboardingCompleted: true }))
  ),

  http.get("*/v1/organizations", () =>
    HttpResponse.json(success([mockOrganization]))
  ),

  http.get("*/v1/organizations/:publicId", ({ params }) => {
    if (params.publicId !== mockOrganization.publicId) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(success(mockOrganization));
  }),

  http.get("*/v1/organizations/:publicId/members", ({ params }) => {
    if (params.publicId !== mockOrganization.publicId) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(success(mockMembers));
  }),

  http.patch("*/v1/organizations/:publicId", async ({ params, request }) => {
    if (params.publicId !== mockOrganization.publicId) {
      return new HttpResponse(null, { status: 404 });
    }

    const body = (await request.json()) as { name?: string };

    return HttpResponse.json(
      success({
        ...mockOrganization,
        name: body.name?.trim() || mockOrganization.name,
      })
    );
  }),

  http.get("*/v1/organizations/:publicId/api-keys", ({ params }) => {
    if (params.publicId !== mockOrganization.publicId) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(success({ items: mockApiKeys }));
  }),

  http.post(
    "*/v1/organizations/:publicId/api-keys",
    async ({ params, request }) => {
      if (params.publicId !== mockOrganization.publicId) {
        return new HttpResponse(null, { status: 404 });
      }

      const body = await request.json();
      const now = new Date().toISOString();

      return HttpResponse.json(
        success({
          id: "key_mock_created",
          name: createdApiKeyName(body),
          secretKey: "ril_live_mock_secret_only_shown_once",
          maskedKey: "ril_live_************************mock",
          status: "ACTIVE",
          createdAt: now,
        }),
        { status: 201 }
      );
    }
  ),

  http.patch(
    "*/v1/organizations/:publicId/api-keys/:keyId",
    async ({ params, request }) => {
      if (params.publicId !== mockOrganization.publicId) {
        return new HttpResponse(null, { status: 404 });
      }

      const key = mockApiKeys.find((item) => item.id === params.keyId);

      if (!key) {
        return new HttpResponse(null, { status: 404 });
      }

      const body = (await request.json()) as { name?: string };

      return HttpResponse.json(
        success({
          ...key,
          name: body.name?.trim() || key.name,
        })
      );
    }
  ),

  http.post(
    "*/v1/organizations/:publicId/api-keys/:keyId/revoke",
    ({ params }) => {
      if (params.publicId !== mockOrganization.publicId) {
        return new HttpResponse(null, { status: 404 });
      }

      const key = mockApiKeys.find((item) => item.id === params.keyId);

      if (!key) {
        return new HttpResponse(null, { status: 404 });
      }

      return HttpResponse.json(
        success({
          ...key,
          status: "REVOKED",
        })
      );
    }
  ),
];
