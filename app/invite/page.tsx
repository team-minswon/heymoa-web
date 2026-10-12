import type { Metadata } from "next";

import { InviteLanding } from "@/components/workspace/invite-landing";
import { privateRouteMetadata } from "@/lib/site";

export const metadata: Metadata = privateRouteMetadata;

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const raw = query.token;
  const token = Array.isArray(raw) ? raw[0] : raw;
  return <InviteLanding token={token ?? null} />;
}
