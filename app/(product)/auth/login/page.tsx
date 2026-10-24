import { BrowserLoginLanding } from "@/components/auth/browser-login-landing";
import { normalizeReturnTo } from "@/lib/auth/paths";
import { privateRouteMetadata } from "@/lib/site";

export const metadata = privateRouteMetadata;

export default async function BrowserLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? null;
  return (
    <BrowserLoginLanding returnTo={normalizeReturnTo(first(query.returnTo))} />
  );
}
