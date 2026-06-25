import { apiFetch } from "@/lib/api/fetcher";
import type { AppResponse } from "@/lib/auth/types";
import type {
  OrganizationDetail,
  OrganizationSummary,
} from "@/lib/organization/types";

export async function updateOrganizationName(
  publicId: string,
  name: string
): Promise<OrganizationDetail> {
  const { data: resBody } = await apiFetch<{
    data: AppResponse<OrganizationDetail>;
    status: number;
    headers: Headers;
  }>(`/v1/organizations/${publicId}`, {
    method: "PATCH",
    data: { name },
  });

  if (!resBody || !resBody.success || !resBody.data) {
    throw new Error(resBody?.error?.message ?? "Organization update failed.");
  }

  return resBody.data;
}

export async function getOrganizations(): Promise<OrganizationSummary[]> {
  const { data: resBody } = await apiFetch<{
    data: AppResponse<OrganizationSummary[]>;
    status: number;
    headers: Headers;
  }>("/v1/organizations", {
    method: "GET",
  });

  if (!resBody || !resBody.success || !resBody.data) {
    throw new Error(
      resBody?.error?.message ?? "Failed to fetch organizations."
    );
  }

  return resBody.data;
}
