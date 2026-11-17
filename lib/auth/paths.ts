const allowedReturnPaths = new Set([
  "/",
  "/terms",
  "/privacy",
  "/settings",
  "/settings/notifications",
  "/settings/payments",
  "/invite",
  "/oauth/authorize",
  "/oauth/consent",
  "/unsubscribe",
]);
const inquiryReturnPath = /^\/inquiries\/[0-9A-HJKMNP-TV-Z]{13}$/;
const workspaceReturnPath =
  /^\/w\/[0-9A-HJKMNP-TV-Z]{13}(?:\/notes\/(?:[0-9A-HJKMNP-TV-Z]{13}|new))?$/;

const billingReturnPath =
  /^\/(?:billing\/setups\/[0-9A-HJKMNP-TV-Z]{13}|billing\/checkout\/[0-9A-HJKMNP-TV-Z]{13})$/;

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
    const parsed = new URL(value, "http://heymoa.local");
    path = `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }

  const pathname = path.split("?")[0] || "/";

  if (billingReturnPath.test(pathname)) return path === pathname ? path : "/";

  return allowedReturnPaths.has(pathname) ||
    workspaceReturnPath.test(pathname) ||
    inquiryReturnPath.test(pathname)
    ? path
    : "/";
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

export function buildGoogleOAuthUrl(returnTo: string, language?: string) {
  const normalizedReturnTo = normalizeReturnTo(returnTo);
  const authorizePath = `/v1/auth/oauth2/authorize/google?returnTo=${encodeURIComponent(
    normalizedReturnTo
  )}`;

  const languageQuery =
    language === "ko" || language === "en" ? `&language=${language}` : "";
  return buildApiUrl(authorizePath + languageQuery);
}

export function buildAgentAuthorizeUrl(query: URLSearchParams) {
  return buildApiUrl(`/oauth2/authorize?${query.toString()}`);
}

export function searchParamsOf(
  query: Record<string, string | string[] | undefined>
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of [value].flat()) {
      if (item !== undefined) params.append(key, item);
    }
  }
  return params;
}
