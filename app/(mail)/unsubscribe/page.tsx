import { UnsubscribeLanding } from "@/components/notification/unsubscribe-landing";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).t;
  const token = Array.isArray(raw) ? raw[0] : raw;
  return <UnsubscribeLanding token={token || null} />;
}
