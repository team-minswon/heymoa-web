import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * 로그인 뒤 화면과 토큰이 실리는 입구는 **운영에서도** 색인하지 않는다 (APP-1036).
 * 개인 회의 내용이라 robots.txt 가 아니라 페이지의 noindex 로 막는다(`lib/site.ts` 🔴).
 * 공개 페이지가 같이 막히지 않았는지도 본다 — 실수로 루트에 걸면 운영이 통째로 빠진다.
 *
 * 크롤러가 읽는 것은 서버 HTML 이라 브라우저 이동 없이 요청으로 본다. dev 서버가 처음 보는
 * 라우트를 컴파일하며 페이지를 다시 불러 `page.goto` 가 ERR_ABORTED 로 끊긴 적이 있다.
 */
const robotsOf = async (request: APIRequestContext, path: string) => {
  const html = await (await request.get(path)).text();
  return html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? null;
};

test("로그인 뒤 화면과 초대·인가 입구는 noindex 다", async ({ request }) => {
  for (const path of [
    "/w/01K0000000000",
    "/w/01K0000000000/tasks",
    "/invite?token=e2e",
    "/oauth/consent",
    "/auth/callback",
  ]) {
    expect(await robotsOf(request, path), path).toContain("noindex");
  }
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
  // 목 환경은 MockProvider 준비 전 본문을 비운다. JSON-LD는 준비된 화면에서 확인한다.
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
  expect(og).toContain("/download/opengraph-image");
  const res = await request.get(og);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
});

// 공유 카드의 og:url 이 홈 값이면 약관·다운로드 링크를 공유할 때 홈으로 묶인다(APP-1294).
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
