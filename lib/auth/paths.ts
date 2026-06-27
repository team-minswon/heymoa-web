const allowedReturnPaths = new Set(["/", "/terms", "/privacy", "/settings"]);

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const isAuthApiConfigured = Boolean(apiBaseUrl);

export function normalizeReturnTo(value: string | null | undefined): string {
  if (!value) {
    return "/";
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("//") ||
    value.startsWith("javascript:")
  ) {
    return "/";
  }

  let path = value;

  try {
    const parsed = new URL(value, "http://realillust.local");
    path = `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }

  const pathname = path.split("?")[0] || "/";

  return allowedReturnPaths.has(pathname) ? path : "/";
}

export function getCurrentReturnTo() {
  if (typeof window === "undefined") {
    return "/";
  }

  return normalizeReturnTo(
    `${window.location.pathname}${window.location.search}`
  );
}

export function buildApiUrl(path: string) {
  if (!apiBaseUrl) {
    return path;
  }

  return new URL(path, apiBaseUrl).toString();
}

export function buildGoogleOAuthUrl(returnTo: string) {
  const normalizedReturnTo = normalizeReturnTo(returnTo);
  const authorizePath = `/v1/auth/oauth2/authorize/google?returnTo=${encodeURIComponent(
    normalizedReturnTo
  )}`;

  return buildApiUrl(authorizePath);
}
