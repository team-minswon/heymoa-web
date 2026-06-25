import { cookies } from "next/headers";
import { cache } from "react";

import type { AppResponse } from "@/lib/auth/types";
import {
  OrganizationApiError,
  type OrganizationDetail,
  type OrganizationMember,
  type OrganizationSummary,
} from "@/lib/organization/types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function buildServerApiUrl(path: string) {
  if (!apiBaseUrl) {
    return null;
  }

  return new URL(path, apiBaseUrl).toString();
}

async function cookieHeader() {
  return (await cookies())
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function getServerData<T>(path: string): Promise<T> {
  const url = buildServerApiUrl(path);

  if (!url) {
    throw new OrganizationApiError("API server is not configured.", 503);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: { Cookie: await cookieHeader() },
    credentials: "include",
    cache: "no-store",
  });
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

export const getOrganizationMembersForSsr = cache((publicId: string) =>
  getServerData<OrganizationMember[]>(
    `/v1/organizations/${publicId}/members`
  )
);
