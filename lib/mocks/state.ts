import { faker } from "@faker-js/faker";

import {
  ApiKeyStatus,
  OrganizationRole,
  PlanCode,
} from "@/lib/api/generated/models";
import type {
  ApiKeyAppResponse,
  ApiKeyCreatedBy,
  ApiKeyListAppResponse,
  ApiKeyResponse,
  AuthUser,
  CreateApiKeyAppResponse,
  CreateApiKeyResponse,
  EmptyAppResponse,
  OrganizationDetail,
  OrganizationDetailAppResponse,
  OrganizationMember,
  OrganizationMemberListAppResponse,
  OrganizationSummary,
  OrganizationSummaryListAppResponse,
} from "@/lib/api/generated/models";

faker.seed(20260626);

const now = "2026-06-26T09:00:00.000Z";

function appSuccess<T>(data: T) {
  return {
    success: true,
    data,
    error: null,
  };
}

function appError(code: string, message: string) {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
    },
  };
}

function makeId(prefix: string) {
  return `${prefix}_${faker.string.alphanumeric({ length: 12 }).toLowerCase()}`;
}

function makeSecretKey() {
  return `sk_live_${faker.string.alphanumeric({ length: 32 }).toLowerCase()}`;
}

function maskSecretKey(secretKey: string) {
  return `sk_live_...${secretKey.slice(-4)}`;
}

function cloneUser(user: AuthUser): AuthUser {
  return { ...user };
}

function cloneOrganization(
  organization: OrganizationDetail
): OrganizationDetail {
  return { ...organization };
}

function cloneMember(member: OrganizationMember): OrganizationMember {
  return { ...member };
}

function cloneApiKey(apiKey: ApiKeyResponse): ApiKeyResponse {
  return { ...apiKey, createdBy: { ...apiKey.createdBy } };
}

type MockApiKeyRecord = ApiKeyResponse;

type MockState = {
  authenticated: boolean;
  user: AuthUser;
  organizations: OrganizationDetail[];
  membersByOrganizationId: Record<string, OrganizationMember[]>;
  apiKeysByOrganizationId: Record<string, MockApiKeyRecord[]>;
};

const owner: AuthUser = {
  id: 1,
  email: "owner@realillust.dev",
  name: "Realillust Owner",
  image: null,
  onboardingCompleted: true,
};

const secondaryUser: AuthUser = {
  id: 2,
  email: "reviewer@realillust.dev",
  name: "Design Reviewer",
  image: null,
  onboardingCompleted: true,
};

const baseOrganization: OrganizationDetail = {
  publicId: "org_demo",
  name: "Demo Organization",
  role: OrganizationRole.OWNER,
  planCode: PlanCode.FREE,
  memberCount: 2,
};

const seededMembers: OrganizationMember[] = [
  {
    userId: owner.id,
    name: owner.name,
    email: owner.email,
    image: owner.image,
    role: OrganizationRole.OWNER,
    joinedAt: "2026-06-20T02:30:00.000Z",
  },
  {
    userId: secondaryUser.id,
    name: secondaryUser.name,
    email: secondaryUser.email,
    image: secondaryUser.image,
    role: OrganizationRole.MEMBER,
    joinedAt: "2026-06-22T06:10:00.000Z",
  },
];

const seededApiKeys: MockApiKeyRecord[] = [
  {
    id: "key_demo_active",
    name: "Production",
    maskedKey: "sk_live_...A9x2",
    status: ApiKeyStatus.ACTIVE,
    createdAt: "2026-06-24T05:10:00.000Z",
    lastUsedAt: null,
    createdBy: {
      id: owner.id,
      name: owner.name,
    },
  },
  {
    id: "key_demo_revoked",
    name: "Old integration",
    maskedKey: "sk_live_...R7k1",
    status: ApiKeyStatus.REVOKED,
    createdAt: "2026-06-21T04:20:00.000Z",
    lastUsedAt: "2026-06-23T01:00:00.000Z",
    createdBy: {
      id: owner.id,
      name: owner.name,
    },
  },
];

const state: MockState = {
  authenticated: true,
  user: owner,
  organizations: [baseOrganization],
  membersByOrganizationId: {
    [baseOrganization.publicId]: seededMembers,
  },
  apiKeysByOrganizationId: {
    [baseOrganization.publicId]: seededApiKeys,
  },
};

function getOrganizationIndex(publicId: string) {
  return state.organizations.findIndex(
    (organization) => organization.publicId === publicId
  );
}

function getApiKeyIndex(organizationPublicId: string, keyId: string) {
  return state.apiKeysByOrganizationId[organizationPublicId]?.findIndex(
    (apiKey) => apiKey.id === keyId
  );
}

function getCreatedBy(): ApiKeyCreatedBy {
  return {
    id: state.user.id,
    name: state.user.name,
  };
}

function appSuccessResponse<T>(data: T) {
  return appSuccess(data);
}

function appErrorResponse(code: string, message: string) {
  return appError(code, message);
}

export const mockState = {
  appSuccess: appSuccessResponse,
  appError: appErrorResponse,
  getAuthenticatedUser(): AuthUser {
    return cloneUser(state.user);
  },
  setAuthenticated(authenticated: boolean) {
    state.authenticated = authenticated;
  },
  isAuthenticated() {
    return state.authenticated;
  },
  listOrganizations(): OrganizationSummary[] {
    return state.organizations.map(cloneOrganization);
  },
  updateOrganization(
    publicId: string,
    name: string
  ): OrganizationDetail | null {
    const index = getOrganizationIndex(publicId);

    if (index < 0) {
      return null;
    }

    const nextOrganization: OrganizationDetail = {
      ...state.organizations[index],
      name: name.trim() || state.organizations[index].name,
    };

    state.organizations[index] = nextOrganization;

    return cloneOrganization(nextOrganization);
  },
  getOrganization(publicId: string): OrganizationDetail | null {
    const organization = state.organizations.find(
      (item) => item.publicId === publicId
    );

    return organization ? cloneOrganization(organization) : null;
  },
  listMembers(publicId: string): OrganizationMember[] | null {
    const members = state.membersByOrganizationId[publicId];

    return members ? members.map(cloneMember) : null;
  },
  listApiKeys(
    organizationPublicId: string,
    filters?: { status?: string | null; limit?: number | null }
  ): ApiKeyListAppResponse["data"] {
    const items = (
      state.apiKeysByOrganizationId[organizationPublicId] ?? []
    ).filter((apiKey) => {
      const status = filters?.status ?? "active";

      if (status === "all") {
        return true;
      }

      return apiKey.status.toLowerCase() === status.toLowerCase();
    });

    const limit =
      typeof filters?.limit === "number" && Number.isFinite(filters.limit)
        ? Math.max(1, Math.floor(filters.limit))
        : 50;

    return {
      items: items.slice(0, limit).map(cloneApiKey),
    };
  },
  createApiKey(
    organizationPublicId: string,
    name?: string | null
  ): CreateApiKeyResponse | null {
    if (getOrganizationIndex(organizationPublicId) === -1) {
      return null;
    }

    const secretKey = makeSecretKey();
    const maskedKey = maskSecretKey(secretKey);
    const createdAt = now;
    const apiKey: MockApiKeyRecord = {
      id: makeId("key"),
      name: name?.trim() || "Untitled key",
      maskedKey,
      status: ApiKeyStatus.ACTIVE,
      createdAt,
      lastUsedAt: null,
      createdBy: getCreatedBy(),
    };

    state.apiKeysByOrganizationId[organizationPublicId] = [
      apiKey,
      ...(state.apiKeysByOrganizationId[organizationPublicId] ?? []),
    ];

    return {
      id: apiKey.id,
      name: apiKey.name,
      secretKey,
      maskedKey: apiKey.maskedKey,
      status: apiKey.status,
      createdAt: apiKey.createdAt,
    };
  },
  updateApiKey(
    organizationPublicId: string,
    keyId: string,
    name: string
  ): ApiKeyResponse | null {
    const apiKeys = state.apiKeysByOrganizationId[organizationPublicId];

    if (!apiKeys) {
      return null;
    }

    const index = getApiKeyIndex(organizationPublicId, keyId);

    if (index === undefined || index < 0) {
      return null;
    }

    const nextApiKey: MockApiKeyRecord = {
      ...apiKeys[index],
      name: name.trim() || apiKeys[index].name,
    };

    apiKeys[index] = nextApiKey;

    return cloneApiKey(nextApiKey);
  },
  revokeApiKey(
    organizationPublicId: string,
    keyId: string
  ): ApiKeyResponse | null {
    const apiKeys = state.apiKeysByOrganizationId[organizationPublicId];

    if (!apiKeys) {
      return null;
    }

    const index = getApiKeyIndex(organizationPublicId, keyId);

    if (index === undefined || index < 0) {
      return null;
    }

    const nextApiKey: MockApiKeyRecord = {
      ...apiKeys[index],
      status: ApiKeyStatus.REVOKED,
    };

    apiKeys[index] = nextApiKey;

    return cloneApiKey(nextApiKey);
  },
  getAuthResponse(): EmptyAppResponse {
    return appSuccess(null);
  },
  getMeResponse() {
    return appSuccess(state.authenticated ? cloneUser(state.user) : null);
  },
  logout() {
    state.authenticated = false;
    return appSuccess(null);
  },
  refreshAuth() {
    state.authenticated = true;
    return appSuccess(null);
  },
  getOrganizationMembersAppResponse(
    publicId: string
  ): OrganizationMemberListAppResponse {
    return appSuccess(this.listMembers(publicId) ?? []);
  },
  getOrganizationSummaryListAppResponse(): OrganizationSummaryListAppResponse {
    return appSuccess(this.listOrganizations());
  },
  getOrganizationDetailAppResponse(
    publicId: string
  ): OrganizationDetailAppResponse | null {
    const organization = this.getOrganization(publicId);

    return organization ? appSuccess(organization) : null;
  },
  getUpdateOrganizationAppResponse(
    publicId: string,
    name: string
  ): OrganizationDetailAppResponse | null {
    const updated = this.updateOrganization(publicId, name);

    return updated ? appSuccess(updated) : null;
  },
  getApiKeyAppResponse(
    organizationPublicId: string,
    keyId: string
  ): ApiKeyAppResponse | null {
    const apiKeys = state.apiKeysByOrganizationId[organizationPublicId];

    if (!apiKeys) {
      return null;
    }

    const apiKey = apiKeys.find((item) => item.id === keyId);

    return apiKey ? appSuccess(cloneApiKey(apiKey)) : null;
  },
  getCreateApiKeyAppResponse(
    organizationPublicId: string,
    name?: string | null
  ): CreateApiKeyAppResponse | null {
    const created = this.createApiKey(organizationPublicId, name);

    return created ? appSuccess(created) : null;
  },
};
