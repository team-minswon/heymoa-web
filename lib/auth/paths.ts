const allowedReturnPaths = new Set(["/", "/terms", "/privacy", "/settings", "/invite"]);
// `notes/new` 는 새 회의 진입 주소다(APP-802) — 외부 에이전트가 준 링크를 로그인 전에 열어도
// 로그인 뒤 그 자리로 돌아온다.
const workspaceReturnPath =
  /^\/w\/[0-9A-HJKMNP-TV-Z]{13}(?:\/notes\/(?:[0-9A-HJKMNP-TV-Z]{13}|new))?$/;

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

  return allowedReturnPaths.has(pathname) || workspaceReturnPath.test(pathname)
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

export function buildGoogleOAuthUrl(returnTo: string) {
  const normalizedReturnTo = normalizeReturnTo(returnTo);
  const authorizePath = `/v1/auth/oauth2/authorize/google?returnTo=${encodeURIComponent(
    normalizedReturnTo
  )}`;

  return buildApiUrl(authorizePath);
}
