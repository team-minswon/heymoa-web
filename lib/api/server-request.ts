import "server-only";

import { cookies } from "next/headers";

export async function getServerApiRequestOptions(): Promise<RequestInit> {
  const cookieStore = await cookies();
  const cookie = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  return {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  };
}
