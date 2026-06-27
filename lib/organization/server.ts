import { cookies } from "next/headers";
import { cache } from "react";
import { buildApiUrl, isAuthApiConfigured } from "@/lib/auth/paths";
import type { AppResponse } from "@/lib/auth/types";
import {
  OrganizationApiError,
  type OrganizationDetail,
  type OrganizationSummary,
} from "@/lib/organization/types";

async function cookieHeader() {
  return (await cookies())
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function getServerData<T>(path: string): Promise<T> {
  if (!isAuthApiConfigured) {
    throw new OrganizationApiError("API server is not configured.", 503);
  }

  let response: Response;

  try {
    response = await fetch(buildApiUrl(path), {
      method: "GET",
      headers: { Cookie: await cookieHeader() },
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new OrganizationApiError("API server is unavailable.", 503);
  }

  const body = (await response.json()) as AppResponse<T>;

  if (!response.ok || !body.success || body.data === null) {
    throw new OrganizationApiError(
      body.error?.message ?? "Organization request failed.",
      response.status,
      body.error?.code
    );
  }

  return body.data;
}

export const getOrganizationsForSsr = cache(() =>
  getServerData<OrganizationSummary[]>("/v1/organizations")
);

export const getOrganizationForSsr = cache((publicId: string) =>
  getServerData<OrganizationDetail>(`/v1/organizations/${publicId}`)
);
