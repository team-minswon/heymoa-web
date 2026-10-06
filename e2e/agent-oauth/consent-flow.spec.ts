import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * 외부 에이전트가 연 브라우저의 흐름(APP-888). 가짜 API 가 server 인가 엔드포인트와 에이전트 콜백을 겸한다 —
 * 시험은 에이전트처럼 server 인가 주소를 열고, 에이전트 콜백에 무엇이 돌아오는지 본다.
 */
const API = "http://localhost:3199";
const CALLBACK = `${API}/agent/callback`;

const authorizeQuery = new URLSearchParams({
  response_type: "code",
  client_id: "e2e-client",
  redirect_uri: CALLBACK,
  scope: "mcp:read",
  state: "agent-state-1",
  code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  code_challenge_method: "S256",
  resource: `${API}/mcp`,
}).toString();

type FakeLog = {
  authorize: string[];
  refresh: number;
  approve: unknown[];
  deny: unknown[];
  callbacks: string[];
};

async function fakeLog(page: Page): Promise<FakeLog> {
  return (await page.request.get(`${API}/__test/state`)).json();
}

/** 가짜 API 에 세션을 만들고 그 쿠키를 브라우저에 심는다. 포트가 달라도 localhost 쿠키는 같이 간다. */
async function signIn(page: Page, context: BrowserContext, expired = false) {
  const session = (await (
    await page.request.post(
      `${API}/__test/session${expired ? "?expired=1" : ""}`
    )
  ).json()) as { access: string; refresh: string };
  await context.addCookies([
    {
      name: "access_token",
      value: session.access,
      domain: "localhost",
      path: "/",
    },
    {
      name: "refresh_token",
      value: session.refresh,
      domain: "localhost",
      path: "/",
    },
  ]);
}

test.beforeEach(async ({ page }) => {
  await page.request.post(`${API}/__test/reset`);
});

test("로그인 안 된 인가 요청이 로그인을 거쳐 동의 화면에 닿고, 허락하면 에이전트에 코드가 돌아간다", async ({
  page,
}) => {
  await page.goto(`${API}/oauth2/authorize?${authorizeQuery}`);

  await expect(
    page.getByRole("heading", {
      name: "에이전트를 HeyMoa 에 연결하려면 로그인하세요",
    })
  ).toBeVisible();
  await page.getByRole("link", { name: "Google로 계속하기" }).click();

  await expect(
    page.getByRole("heading", { name: "E2E 에이전트" })
  ).toBeVisible();
  await expect(page.getByText("HeyMoa 가 확인한 앱이 아닙니다")).toBeVisible();
  await expect(
    page.getByText("허락하면 localhost:3199 로 돌아갑니다")
  ).toBeVisible();
  await expect(
    page.getByText("회의 전사(참석자의 발화와 이름)도 에이전트가 읽습니다.")
  ).toBeVisible();

  await page.getByRole("button", { name: "허락", exact: true }).click();
  await page.waitForURL((url) => url.href.startsWith(CALLBACK));

  const callback = new URL(page.url());
  expect(callback.searchParams.get("state")).toBe("agent-state-1");
  expect(callback.searchParams.get("code")).toBeTruthy();
  const log = await fakeLog(page);
  // 처음 인가 요청과 web 입구가 로그인 뒤 돌려보낸 요청이 같은 쿼리다
  expect(log.authorize).toEqual([authorizeQuery, authorizeQuery]);
  expect(log.approve).toEqual([
    { state: expect.stringMatching(/^consent-/), workspaceId: "01K0000000001" },
  ]);
});

test("거절하면 에이전트에 access_denied 가 돌아가고 허락 요청은 없다", async ({
  page,
  context,
}) => {
  await signIn(page, context);
  await page.goto(`${API}/oauth2/authorize?${authorizeQuery}`);

  await expect(
    page.getByRole("heading", { name: "E2E 에이전트" })
  ).toBeVisible();
  await page.getByRole("button", { name: "거절", exact: true }).click();
  await page.waitForURL((url) => url.href.startsWith(CALLBACK));

  const callback = new URL(page.url());
  expect(callback.searchParams.get("error")).toBe("access_denied");
  expect(callback.searchParams.get("state")).toBe("agent-state-1");
  const log = await fakeLog(page);
  expect(log.approve).toEqual([]);
  expect(log.deny).toHaveLength(1);
});

test("access 쿠키만 만료된 인가 요청은 로그인 카드 없이 동의 화면에 닿는다", async ({
  page,
  context,
}) => {
  await signIn(page, context, true);
  const visited: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) visited.push(frame.url());
  });

  await page.goto(`${API}/oauth2/authorize?${authorizeQuery}`);

  await expect(
    page.getByRole("heading", { name: "E2E 에이전트" })
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/oauth/consent");
  await expect(
    page.getByText("에이전트를 HeyMoa 에 연결하려면 로그인하세요")
  ).toHaveCount(0);
  // proxy 가 한 번 갱신했고, 그 쿠키로 server 인가 엔드포인트를 다시 지났다
  const log = await fakeLog(page);
  expect(log.refresh).toBe(1);
  expect(log.authorize).toEqual([authorizeQuery, authorizeQuery]);
  expect(visited.some((url) => url.includes("/auth/callback"))).toBe(false);
});

test("동의 화면과 인가 입구는 프레임에 띄울 수 없다", async ({ request }) => {
  for (const path of [
    "/oauth/consent?state=x",
    `/oauth/authorize?${authorizeQuery}`,
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["content-security-policy"]).toBe(
      "frame-ancestors 'none'"
    );
  }
});
