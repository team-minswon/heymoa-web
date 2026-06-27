export type AppResponse<T> = {
  success: boolean;
  data: T | null;
  error: AppErrorBody | null;
};

export type AppErrorBody = {
  code: string;
  message: string;
  details?: AppErrorDetail[] | null;
};

export type AppErrorDetail = {
  field?: string;
  message: string;
};

export type UserMeResponse = {
  id: number;
  email: string | null;
  name: string | null;
  image: string | null;
  onboardingCompleted: boolean;
};

export type SubmitOnboardingProfileRequest = {
  acquisitionSource: string;
  userType: string;
  primaryUseCase: string;
};

export type OnboardingCompletionResponse = {
  onboardingCompleted: boolean;
};

export type OrganizationRole = "OWNER" | "MEMBER";
export type PlanCode = "FREE";

export type OrganizationResponse = {
  publicId: string;
  name: string;
  role: OrganizationRole;
  planCode: PlanCode;
  memberCount: number | null;
};

export type OrganizationMemberResponse = {
  userId: number;
  name: string | null;
  email: string | null;
  image: string | null;
  role: OrganizationRole;
  joinedAt: string;
};

export type UpdateOrganizationRequest = {
  name: string;
};

export type ApiKeyListResponse = {
  items: ApiKeyResponse[];
};

export type ApiKeyResponse = {
  id: string;
  name: string;
  maskedKey: string;
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
  createdBy: ApiKeyCreatedByResponse;
};

export type ApiKeyCreatedByResponse = {
  id: number;
  name: string | null;
};

export type CreateApiKeyRequest = {
  name?: string | null;
};

export type CreateApiKeyResponse = {
  id: string;
  name: string;
  secretKey: string;
  maskedKey: string;
  status: string;
  createdAt: string;
};

export type UpdateApiKeyRequest = {
  name?: string | null;
};
