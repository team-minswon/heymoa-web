import type { Metadata } from "next";

import { ReauthLanding } from "@/components/auth/reauth-landing";
import { privateRouteMetadata } from "@/lib/site";

// 증명이 주소에 실려 올 수 있는 입구라 noindex 다(콜백과 같은 까닭).
export const metadata: Metadata = privateRouteMetadata;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Google 재로그인 새 창이 돌아오는 곳(`lib/auth/reauth.ts`). */
export default async function ReauthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <ReauthLanding
      purpose={first(query.purpose) ?? ""}
      proof={first(query.proof)}
      failed={first(query.error) !== undefined}
    />
  );
}
