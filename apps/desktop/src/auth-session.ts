import { PRODUCTION_API_ORIGIN } from "./auth-policy";

type Fetch = (url: string, options: RequestInit) => Promise<Response>;
export function authPost(fetch: Fetch, origin: string) {
  return async (
    route: string,
    body: Record<string, string>,
    signal: AbortSignal
  ) => {
    const connection =
      /^\/v1\/workspaces\/[0-9A-HJKMNP-TV-Z]{13}\/integrations\/(LINEAR|GITHUB)\/desktop-ticket$/.test(
        route
      );
    if (
      !connection &&
      !["/v1/auth/desktop/start", "/v1/auth/desktop/exchange"].includes(route)
    )
      throw new Error("INVALID_DESKTOP_AUTH_ROUTE");
    const request = (path: string, payload: Record<string, string>) =>
      fetch(new URL(path, PRODUCTION_API_ORIGIN).href, {
        method: "POST",
        credentials: "include",
        redirect: "error",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify(payload),
        signal,
      });
    let response = await request(route, body);
    // Native admission happens while the click is active. Refresh afterward
    // shares the window's jar; server refresh tokens do not rotate.
    if (response.status === 401 && connection) {
      const refresh = await request("/v1/auth/refresh", {});
      if (!refresh.ok) throw new Error("DESKTOP_AUTH_REQUEST_FAILED");
      const result = (await refresh.json()) as { success?: unknown };
      if (result.success !== true)
        throw new Error("DESKTOP_AUTH_REQUEST_FAILED");
      response = await request(route, body);
    }
    if (!response.ok) throw new Error("DESKTOP_AUTH_REQUEST_FAILED");
    const envelope = (await response.json()) as {
      success?: unknown;
      data?: unknown;
    };
    if (envelope.success !== true)
      throw new Error("DESKTOP_AUTH_REQUEST_FAILED");
    return envelope.data;
  };
}
