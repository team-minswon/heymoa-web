import type { AppResponse } from "@/lib/auth/types";

export type OrganizationRole = "OWNER" | "MEMBER";
export type PlanCode = "FREE";

export type OrganizationSummary = {
  publicId: string;
  name: string;
  role: OrganizationRole;
  planCode: PlanCode;
};

export type OrganizationDetail = OrganizationSummary & {
  memberCount: number;
};

export class OrganizationApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "OrganizationApiError";
  }
}

export type OrganizationAppResponse<T> = AppResponse<T>;
