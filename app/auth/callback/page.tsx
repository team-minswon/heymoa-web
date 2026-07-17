import { AuthCallbackClient } from "@/components/auth/auth-callback-client";

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
  const returnTo = first(query.return_to);

  return <AuthCallbackClient urlError={urlError} returnTo={returnTo} />;
}
