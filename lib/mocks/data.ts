import type {
  ApiKeyResponse,
  OrganizationMemberResponse,
  OrganizationResponse,
  UserMeResponse,
} from "@/lib/api/generated";

export const mockUser: UserMeResponse = {
  id: 1,
  email: "demo@realillust.com",
  name: "Demo User",
  image: null,
  onboardingCompleted: true,
};

export const mockOrganization: OrganizationResponse = {
  publicId: "org_demo",
  name: "Demo Studio",
  role: "OWNER",
  planCode: "FREE",
  memberCount: 2,
};

export const mockMembers: OrganizationMemberResponse[] = [
  {
    userId: 1,
    name: "Demo User",
    email: "demo@realillust.com",
    image: null,
    role: "OWNER",
    joinedAt: "2026-06-01T00:00:00Z",
  },
  {
    userId: 2,
    name: "Design Partner",
    email: "partner@realillust.com",
    image: null,
    role: "MEMBER",
    joinedAt: "2026-06-10T00:00:00Z",
  },
];

export const mockApiKeys: ApiKeyResponse[] = [
  {
    id: "key_demo_live",
    name: "Production key",
    maskedKey: "ril_live_************************abcd",
    status: "ACTIVE",
    createdAt: "2026-06-20T00:00:00Z",
    lastUsedAt: "2026-06-26T10:30:00Z",
    createdBy: { id: 1, name: "Demo User" },
  },
  {
    id: "key_demo_dev",
    name: "Development key",
    maskedKey: "ril_test_************************wxyz",
    status: "ACTIVE",
    createdAt: "2026-06-22T00:00:00Z",
    lastUsedAt: null,
    createdBy: { id: 1, name: "Demo User" },
  },
];
