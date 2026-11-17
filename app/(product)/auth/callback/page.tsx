import type { Metadata } from "next";

import { AuthCallbackClient } from "@/components/auth/auth-callback-client";

import { privateRouteMetadata } from "@/lib/site";

export const metadata: Metadata = privateRouteMetadata;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const urlError = first(query.error);
  // 쿼리 이름은 server 의 OAuth2AuthenticationSuccessHandler 가 정합니다(`?returnTo=`).
  const returnTo = first(query.returnTo);

  return <AuthCallbackClient urlError={urlError} returnTo={returnTo} />;
}
