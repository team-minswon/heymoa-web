import { apiRequest, type ApiRequestOptions } from "@/lib/api/client";
import type {
  ApiKeyListResponse,
  ApiKeyResponse,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  OnboardingCompletionResponse,
  OrganizationMemberResponse,
  OrganizationResponse,
  SubmitOnboardingProfileRequest,
  UpdateApiKeyRequest,
  UpdateOrganizationRequest,
  UserMeResponse,
} from "@/lib/api/generated";

type ApiKeyStatusFilter = "active" | "revoked" | "all";

function organizationPath(publicId: string) {
  return `/v1/organizations/${encodeURIComponent(publicId)}`;
}

function apiKeyPath(organizationPublicId: string) {
  return `${organizationPath(organizationPublicId)}/api-keys`;
}

export function refreshAuthApi(options?: ApiRequestOptions) {
  return apiRequest<void>("/v1/auth/refresh", {
    method: "POST",
    allowEmptyData: true,
    ...options,
  });
}

export function logoutAuthApi(options?: ApiRequestOptions) {
  return apiRequest<void>("/v1/auth/logout", {
    method: "POST",
    allowEmptyData: true,
    ...options,
  });
}

export function getMeApi(options?: ApiRequestOptions) {
  return apiRequest<UserMeResponse>("/v1/users/me", {
    method: "GET",
    ...options,
  });
}

export function submitOnboardingProfileApi(
  body: SubmitOnboardingProfileRequest,
  options?: ApiRequestOptions
) {
  return apiRequest<OnboardingCompletionResponse>("/v1/onboarding/profile", {
    method: "POST",
    body,
    ...options,
  });
}

export function listOrganizationsApi(options?: ApiRequestOptions) {
  return apiRequest<OrganizationResponse[]>("/v1/organizations", {
    method: "GET",
    ...options,
  });
}

export function getOrganizationApi(
  publicId: string,
  options?: ApiRequestOptions
) {
  return apiRequest<OrganizationResponse>(organizationPath(publicId), {
    method: "GET",
    ...options,
  });
}

export function listOrganizationMembersApi(
  publicId: string,
  options?: ApiRequestOptions
) {
  return apiRequest<OrganizationMemberResponse[]>(
    `${organizationPath(publicId)}/members`,
    {
      method: "GET",
      ...options,
    }
  );
}

export function updateOrganizationApi(
  publicId: string,
  body: UpdateOrganizationRequest,
  options?: ApiRequestOptions
) {
  return apiRequest<OrganizationResponse>(organizationPath(publicId), {
    method: "PATCH",
    body,
    ...options,
  });
}

export function listApiKeysApi(
  organizationPublicId: string,
  params: { status?: ApiKeyStatusFilter; limit?: number } = {},
  options?: ApiRequestOptions
) {
  const searchParams = new URLSearchParams();

  if (params.status) {
    searchParams.set("status", params.status);
  }

  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }

  const query = searchParams.toString();

  return apiRequest<ApiKeyListResponse>(
    `${apiKeyPath(organizationPublicId)}${query ? `?${query}` : ""}`,
    {
      method: "GET",
      ...options,
    }
  );
}

export function createApiKeyApi(
  organizationPublicId: string,
  body: CreateApiKeyRequest,
  options?: ApiRequestOptions
) {
  return apiRequest<CreateApiKeyResponse>(apiKeyPath(organizationPublicId), {
    method: "POST",
    body,
    ...options,
  });
}

export function updateApiKeyApi(
  organizationPublicId: string,
  keyId: string,
  body: UpdateApiKeyRequest,
  options?: ApiRequestOptions
) {
  return apiRequest<ApiKeyResponse>(
    `${apiKeyPath(organizationPublicId)}/${encodeURIComponent(keyId)}`,
    {
      method: "PATCH",
      body,
      ...options,
    }
  );
}

export function revokeApiKeyApi(
  organizationPublicId: string,
  keyId: string,
  options?: ApiRequestOptions
) {
  return apiRequest<ApiKeyResponse>(
    `${apiKeyPath(organizationPublicId)}/${encodeURIComponent(keyId)}/revoke`,
    {
      method: "POST",
      ...options,
    }
  );
}
