import { cookies } from "next/headers";
import { cache } from "react";
import { ApiClientError } from "@/lib/api/client";
import { getOrganizationApi, listOrganizationsApi } from "@/lib/api/endpoints";

async function cookieHeader() {
  return (await cookies()).toString();
}

async function withServerCookies<T>(request: (cookie: string) => Promise<T>) {
  try {
    return await request(await cookieHeader());
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    throw new ApiClientError("API server is unavailable.", 503);
  }
}

export const getOrganizationsForSsr = cache(() =>
  withServerCookies((cookie) =>
    listOrganizationsApi({
      headers: cookie ? { Cookie: cookie } : undefined,
      cache: "no-store",
    })
  )
);

export const getOrganizationForSsr = cache((publicId: string) =>
  withServerCookies((cookie) =>
    getOrganizationApi(publicId, {
      headers: cookie ? { Cookie: cookie } : undefined,
      cache: "no-store",
    })
  )
);
