import { InviteLanding } from "@/components/workspace/invite-landing";

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
