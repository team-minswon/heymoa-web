import { expect, test, type APIRequestContext } from "@playwright/test";

const robotsOf = async (request: APIRequestContext, path: string) => {
  const html = await (await request.get(path)).text();
  return html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? null;
};

const PRIVATE_PATHS = [
  "/w/01K0000000000",
  "/w/01K0000000000/tasks",
  "/invite?token=e2e",
  "/unsubscribe?t=e2e",
  "/oauth/consent",
  "/auth/callback",
  "/settings/integrations",
  "/help-samples",
];

test("로그인 뒤 화면과 초대·인가 입구는 noindex 다", async ({ request }) => {
  for (const path of PRIVATE_PATHS) {
    expect(await robotsOf(request, path), path).toContain("noindex");
  }
});

test("제품 면은 canonical·hreflang 을 내지 않는다", async ({ request }) => {
  for (const path of PRIVATE_PATHS) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toMatch(/<link rel="canonical"/);
    expect(html, path).not.toMatch(/<link rel="alternate" hrefLang=/i);
  }
});

test("robots.txt 는 어떤 경로도 막지 않는다", async ({ request }) => {
  const txt = await (await request.get("/robots.txt")).text();
  expect(txt).toMatch(/^Allow: \/$/m);
  expect(txt).not.toMatch(/^Disallow:/m);
});

test("공개 페이지는 색인을 막지 않는다", async ({ request }) => {
  for (const path of ["/", "/help", "/help/start/desktop", "/download"]) {
    expect(await robotsOf(request, path), path).toBe("index, follow");
  }
});

test("다운로드·약관·개인정보는 JSON-LD 를 내고 다운로드는 전용 OG 이미지를 가진다", async ({
  page,
  request,
}) => {
  for (const path of ["/download", "/terms", "/privacy"]) {
    await page.goto(path);
    await expect
      .poll(
        async () =>
          page
            .locator('script[type="application/ld+json"]')
            .evaluateAll((scripts) =>
              scripts.map(
                (script) => JSON.parse(script.textContent ?? "{}")["@type"]
              )
            ),
        { message: path }
      )
      .toEqual(expect.arrayContaining(["WebPage", "BreadcrumbList"]));
  }
  const html = await (await request.get("/download")).text();
  const og =
    html.match(/property="og:image" content="https?:\/\/[^/]+([^"]*)"/)?.[1] ??
    "";
  expect(og).toBe("/opengraph-image.png");
  const res = await request.get(og);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
});

test("공유 카드의 og:url 이 각 페이지의 canonical 과 같다", async ({
  request,
}) => {
  for (const path of ["/", "/en", "/download", "/en/download", "/terms", "/en/privacy"]) {
    const html = await (await request.get(path)).text();
    const ogUrl = html.match(/<meta property="og:url" content="([^"]*)"/)?.[1];
    const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];

    expect(canonical, path).toBeTruthy();
    expect(ogUrl, path).toBe(canonical);
  }
});
