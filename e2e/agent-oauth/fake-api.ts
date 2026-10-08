/**
 * 외부 에이전트 OAuth e2e(APP-888)의 가짜 API.
 *
 * web 의 SSR(`getCurrentUserForSsr`)과 `proxy.ts` 의 토큰 갱신은 Node 쪽에서 API 를 부르므로 MSW 도 `page.route` 도
 * 못 가로챈다. 그래서 진짜 소켓으로 server 를 흉내 낸다. 응답 모양은 생성 타입으로 묶어, 계약 이름이 갈라지면
 * `pnpm typecheck` 가 깨진다. Node 의 타입 제거로 그대로 돈다(`node e2e/agent-oauth/fake-api.ts`) — 타입 전용
 * 가져오기만 쓴다.
 *
 * 흉내 내는 것: 세션 확인·갱신(refresh 회전), Google 로그인 왕복, server 인가 엔드포인트, 동의 API 셋, 워크스페이스
 * 목록, 에이전트 콜백. 시험은 `/__test/*` 로 기록을 읽고 세션을 만든다.
 */
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import type {
  AgentOAuthConsentRedirectResponseData,
  AgentOAuthConsentResponseData,
  AuthSessionResponseData,
  WorkspaceListResponseDataWorkspacesItem,
} from "../../lib/api/generated/models";

const PORT = Number(process.env.FAKE_API_PORT ?? 3199);
const WEB = process.env.WEB_ORIGIN ?? "http://localhost:3102";

const USER = {
  userId: "01K0000000000",
  name: "사용자",
  email: "user@example.com",
  image: null,
};
const WORKSPACE: WorkspaceListResponseDataWorkspacesItem = {
  workspaceId: "01K0000000001",
  name: "제품팀",
  description: null,
  role: "ADMIN",
  agentAccessAllowed: true,
};
const CLIENT_NAME = "E2E 에이전트";

type Pending = { agentState: string; redirectUri: string };
type Log = {
  authorize: string[];
  refresh: number;
  approve: unknown[];
  deny: unknown[];
  callbacks: string[];
};

let refreshTokens = new Set<string>();
let consents = new Map<string, Pending>();
let log: Log = emptyLog();
let seq = 0;

function emptyLog(): Log {
  return { authorize: [], refresh: 0, approve: [], deny: [], callbacks: [] };
}

function base64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** `proxy.ts` 는 access 의 `exp` 만 읽는다. 서명은 보지 않으므로 모양만 맞춘다. */
function accessToken(expiresInSeconds: number) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${base64Url({ alg: "none" })}.${base64Url({ sub: USER.userId, exp })}.e2e`;
}

function issueSession(expired = false) {
  const refresh = `refresh-${++seq}`;
  refreshTokens.add(refresh);
  return { access: accessToken(expired ? -60 : 30 * 60), refresh };
}

function sessionCookies({
  access,
  refresh,
}: {
  access: string;
  refresh: string;
}) {
  return [
    `access_token=${access}; Path=/; HttpOnly; SameSite=Lax`,
    `refresh_token=${refresh}; Path=/; HttpOnly; SameSite=Lax`,
  ];
}

function cookiesOf(request: IncomingMessage) {
  return Object.fromEntries(
    (request.headers.cookie ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name]) => name)
      .map(([name, ...value]) => [name, value.join("=")])
  );
}

function isAuthenticated(request: IncomingMessage) {
  const access = cookiesOf(request).access_token;
  if (!access) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(access.split(".")[1], "base64url").toString()
    ) as { exp: number };
    return payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

function withQuery(uri: string, params: Record<string, string>) {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function cors(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", WEB);
  response.setHeader("Access-Control-Allow-Credentials", "true");
}

function send(
  response: ServerResponse,
  status: number,
  body: unknown,
  cookies: string[] = []
) {
  cors(response);
  if (cookies.length) response.setHeader("Set-Cookie", cookies);
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function ok<T>(response: ServerResponse, data: T, cookies: string[] = []) {
  send(response, 200, { success: true, data, error: null }, cookies);
}

function fail(
  response: ServerResponse,
  status: number,
  code: string,
  message: string
) {
  send(response, status, {
    success: false,
    data: null,
    error: { code, message, details: null },
  });
}

function redirect(
  response: ServerResponse,
  location: string,
  cookies: string[] = []
) {
  if (cookies.length) response.setHeader("Set-Cookie", cookies);
  response.writeHead(302, { Location: location });
  response.end();
}

async function bodyOf(request: IncomingMessage) {
  let text = "";
  for await (const chunk of request) text += chunk;
  return text ? (JSON.parse(text) as Record<string, string>) : {};
}

const notFound = (response: ServerResponse) =>
  fail(
    response,
    404,
    "AGENT_OAUTH_REQUEST_NOT_FOUND",
    "연결 요청을 찾을 수 없습니다. 에이전트에서 다시 연결해 주세요."
  );

const unauthorized = (response: ServerResponse) =>
  fail(response, 401, "UNAUTHORIZED", "로그인이 필요합니다.");

async function handle(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  const rawQuery = url.search.slice(1);
  const route = `${request.method} ${url.pathname}`;

  if (request.method === "OPTIONS") {
    cors(response);
    response.writeHead(204, {
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE",
      "Access-Control-Allow-Headers": "content-type",
    });
    response.end();
    return;
  }

  switch (route) {
    case "GET /__test/state":
      return send(response, 200, log);
    case "POST /__test/reset":
      refreshTokens = new Set();
      consents = new Map();
      log = emptyLog();
      return send(response, 200, {});
    case "POST /__test/session":
      return send(
        response,
        200,
        issueSession(url.searchParams.get("expired") === "1")
      );

    case "GET /v1/auth/session": {
      const refresh = cookiesOf(request).refresh_token;
      const data: AuthSessionResponseData = isAuthenticated(request)
        ? { state: "authenticated", user: USER }
        : refresh && refreshTokens.has(refresh)
          ? { state: "refresh_required" }
          : { state: "anonymous" };
      return ok(response, data);
    }
    case "POST /v1/auth/refresh": {
      const refresh = cookiesOf(request).refresh_token;
      if (!refresh || !refreshTokens.has(refresh)) {
        return fail(
          response,
          401,
          "INVALID_REFRESH_TOKEN",
          "다시 로그인해 주세요."
        );
      }
      refreshTokens.delete(refresh);
      log.refresh += 1;
      return ok(response, null, sessionCookies(issueSession()));
    }
    // Google 로그인 왕복을 한 번에 끝낸다 — 쿠키를 심고 server 처럼 web 콜백으로 보낸다.
    case "GET /v1/auth/oauth2/authorize/google": {
      const returnTo = url.searchParams.get("returnTo") ?? "/";
      return redirect(
        response,
        `${WEB}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
        sessionCookies(issueSession())
      );
    }

    // server 인가 엔드포인트. 로그인 안 됐으면 받은 쿼리 그대로 web 입구로, 됐으면 동의 화면으로.
    case "GET /oauth2/authorize": {
      log.authorize.push(rawQuery);
      if (!isAuthenticated(request)) {
        return redirect(response, `${WEB}/oauth/authorize?${rawQuery}`);
      }
      const consentState = `consent-${++seq}`;
      consents.set(consentState, {
        agentState: url.searchParams.get("state") ?? "",
        redirectUri: url.searchParams.get("redirect_uri") ?? "",
      });
      const consentQuery = new URLSearchParams({
        client_id: url.searchParams.get("client_id") ?? "",
        scope: url.searchParams.get("scope") ?? "",
        state: consentState,
      });
      return redirect(response, `${WEB}/oauth/consent?${consentQuery}`);
    }

    case "GET /v1/agent-oauth/consent": {
      if (!isAuthenticated(request)) return unauthorized(response);
      const consent = consents.get(url.searchParams.get("state") ?? "");
      if (!consent) return notFound(response);
      const data: AgentOAuthConsentResponseData = {
        clientName: CLIENT_NAME,
        redirectHost: new URL(consent.redirectUri).host,
        scopes: ["mcp:read"],
      };
      return ok(response, data);
    }
    case "POST /v1/agent-oauth/consent/approve":
    case "POST /v1/agent-oauth/consent/deny": {
      if (!isAuthenticated(request)) return unauthorized(response);
      const body = await bodyOf(request);
      const consent = consents.get(body.state ?? "");
      if (!consent) return notFound(response);
      consents.delete(body.state);
      const approving = url.pathname.endsWith("/approve");
      (approving ? log.approve : log.deny).push(body);
      const data: AgentOAuthConsentRedirectResponseData = {
        redirectUri: withQuery(
          consent.redirectUri,
          approving
            ? { code: `code-${++seq}`, state: consent.agentState }
            : { error: "access_denied", state: consent.agentState }
        ),
      };
      return ok(response, data);
    }

    case "GET /v1/workspaces":
      if (!isAuthenticated(request)) return unauthorized(response);
      return ok(response, { workspaces: [WORKSPACE] });

    // 에이전트가 띄운 로컬 콜백 자리. 받은 쿼리를 남긴다.
    case "GET /agent/callback":
      log.callbacks.push(rawQuery);
      cors(response);
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<p>에이전트 콜백</p>");
      return;

    default:
      console.log(`[fake-api] 흉내 내지 않는 요청: ${route}`);
      return fail(response, 404, "NOT_FOUND", "찾을 수 없습니다.");
  }
}

createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    console.error("[fake-api] 처리 실패", error);
    fail(response, 500, "INTERNAL_SERVER_ERROR", "가짜 API 오류");
  });
}).listen(PORT, () => {
  console.log(`[fake-api] http://localhost:${PORT} (web ${WEB})`);
});
