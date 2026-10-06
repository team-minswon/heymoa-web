// `/oauth/*` 는 외부 에이전트 인가 흐름이다(APP-888) — 로그인 뒤 인가 요청·동의 화면으로 쿼리째 돌아온다.
const allowedReturnPaths = new Set([
  "/",
  "/terms",
  "/privacy",
  "/settings",
  "/invite",
  "/oauth/authorize",
  "/oauth/consent",
]);
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

/**
 * 외부 에이전트의 인가 요청을 server 인가 엔드포인트로 되돌린다(APP-888). server 는 로그인 안 된 인가 요청을
 * web `/oauth/authorize?<받은 쿼리>` 로 보내므로, web 이 로그인을 확인한 뒤 받은 쿼리를 그대로 붙여 돌려보낸다.
 *
 * **보내는 곳은 여기서 정한다.** 쿼리의 어떤 값(`redirect_uri` 등)도 주소로 쓰지 않는다 — 검사는 server 가
 * 하고, 이 경로로 다른 주소에 보낼 길이 없다.
 */
export function buildAgentAuthorizeUrl(query: URLSearchParams) {
  return buildApiUrl(`/oauth2/authorize?${query.toString()}`);
}

/** 페이지가 받은 `searchParams` 를 이름·값·순서 그대로 옮긴다. 같은 이름이 여러 번 오면 모두 옮긴다. */
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
