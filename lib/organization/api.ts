import { apiFetch } from "@/lib/api/fetcher";
import type { AppResponse } from "@/lib/auth/types";
import type { OrganizationDetail } from "@/lib/organization/types";

export async function updateOrganizationName(publicId: string, name: string) {
  const response = await apiFetch<AppResponse<OrganizationDetail>>(
    `/v1/organizations/${publicId}`,
    {
      method: "PATCH",
      data: { name },
    }
  );

  if (!response.success || response.data === null) {
    throw response.error ?? new Error("Organization update failed.");
  }

  return response.data;
}
