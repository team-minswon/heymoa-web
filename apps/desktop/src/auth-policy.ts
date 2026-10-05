import type { DesktopConnection } from "@heymoa/desktop-contracts";
export type {
  DesktopConnectionProvider as Provider,
  DesktopConnection as ConnectionRequest,
  DesktopAuthOutcome as AuthOutcome,
} from "@heymoa/desktop-contracts";
import type { DesktopConnectionProvider as Provider } from "@heymoa/desktop-contracts";
export const AUTH_TIMEOUT_MS = 5 * 60 * 1000;
export const PRODUCTION_API_ORIGIN = "https://api.heymoa.app";
const secret = /^[A-Za-z0-9_-]{43}$/;

export function connectionRequest(value: unknown): DesktopConnection {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_CONNECTION_REQUEST");
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 2 ||
    typeof input.workspaceId !== "string" ||
    !/^[0-9A-HJKMNP-TV-Z]{13}$/.test(input.workspaceId) ||
    (input.provider !== "LINEAR" && input.provider !== "GITHUB")
  )
    throw new Error("INVALID_CONNECTION_REQUEST");
  return { workspaceId: input.workspaceId, provider: input.provider };
}

export function authorizeUrl(value: unknown, apiOrigin: string): string {
  if (typeof value !== "string" || value.length > 2048)
    throw new Error("INVALID_AUTHORIZE_URL");
  const url = new URL(value);
  if (
    url.origin !== apiOrigin ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname !== "/v1/auth/desktop/authorize" ||
    [...url.searchParams.keys()].length !== 1 ||
    !secret.test(url.searchParams.get("ticket") ?? "")
  )
    throw new Error("INVALID_AUTHORIZE_URL");
  return url.href;
}

export type NativeCallback =
  | { kind: "login"; state: string; code: string }
  | { kind: "login"; state: string; error: true }
  | {
      kind: "connection";
      state: string;
      provider: Provider;
      status: "success" | "error";
    };

export function nativeCallback(value: string): NativeCallback | null {
  if (value.length > 2048 || !/^app\.heymoa:\/(?!\/)/.test(value)) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "app.heymoa:" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash ||
      url.hostname !== "" ||
      !["/auth/callback", "/integrations/callback"].includes(url.pathname)
    )
      return null;
    const params = url.searchParams;
    const keys = [...params.keys()];
    if (
      new Set(keys).size !== keys.length ||
      !secret.test(params.get("state") ?? "")
    )
      return null;
    const state = params.get("state")!;
    if (
      url.pathname === "/auth/callback" &&
      keys.length === 2 &&
      keys.includes("state")
    ) {
      if (secret.test(params.get("code") ?? ""))
        return { kind: "login", state, code: params.get("code")! };
      if (params.get("error") === "authentication_failed")
        return { kind: "login", state, error: true };
    }
    if (
      url.pathname === "/integrations/callback" &&
      keys.length === 3 &&
      keys.includes("state")
    ) {
      const provider = params.get("provider");
      const status = params.get("status");
      if (
        (provider === "LINEAR" || provider === "GITHUB") &&
        (status === "success" || status === "error")
      )
        return { kind: "connection", state, provider, status };
    }
  } catch {
    /* An unsolicited URL must not affect the current app. */
  }
  return null;
}
