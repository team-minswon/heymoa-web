import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

test.describe.configure({ timeout: 240_000 });

const BASE = "http://localhost:3100";
const WS = "/w/01K0000000000";
const ACCOUNT_COOKIE = "heymoa-mock-account-lang";

const cookie = (name: string, value: string) => ({
  name,
  value,
  url: BASE,
});

async function contextFor(
  browser: Browser,
  locale: "ko-KR" | "en-US",
  cookies: { name: string; value: string }[] = []
) {
  const context = await browser.newContext({ locale });
  if (cookies.length) {
    await context.addCookies(cookies.map((c) => cookie(c.name, c.value)));
  }
  return context;
}

async function cookieValue(context: BrowserContext, name: string) {
  return (await context.cookies(BASE)).find((c) => c.name === name)?.value;
}

function collectHydrationWarnings(page: Page) {
  const warnings: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (/hydrat/i.test(text)) warnings.push(text);
  });
  return warnings;
}

const get = (
  request: APIRequestContext,
  path: string,
  headers: Record<string, string>
) => request.get(path, { maxRedirects: 0, headers });

test.describe("랜딩 홈 첫 방문", () => {
  test("쿠키가 없고 브라우저 언어가 영어뿐이면 /en 으로 임시 이동한다", async ({
    request,
  }) => {
    const english = await get(request, "/", {
      "accept-language": "en-US,en;q=0.9",
    });
    expect(english.status()).toBe(307);
    expect(english.headers().location).toBe("/en");
  });

  test("한국어가 목록에 있거나 언어를 고른 적이 있으면 이동하지 않는다", async ({
    request,
  }) => {
    const cases: Record<string, string>[] = [
      { "accept-language": "en-US,en;q=0.9,ko;q=0.8" },
      { "accept-language": "ko-KR" },
      { "accept-language": "en-US", cookie: "heymoa-lang=ko" },
      { "accept-language": "en-US", cookie: "heymoa-lang=en" },
    ];
    for (const headers of cases) {
      expect(
        (await get(request, "/", headers)).status(),
        JSON.stringify(headers)
      ).toBe(200);
    }
  });

  test("홈 말고 다른 마케팅 주소는 브라우저 언어로 옮기지 않는다", async ({
    request,
  }) => {
    for (const path of ["/help", "/download", "/terms"]) {
      const response = await get(request, path, {
        "accept-language": "en-US,en",
      });
      expect(response.status(), path).toBe(200);
    }
  });

  test("푸터에서 한국어를 고른 뒤에는 영어 브라우저로 홈을 열어도 한국어다", async ({
    browser,
  }) => {
    const context = await contextFor(browser, "en-US");
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await page.getByRole("link", { name: "한국어" }).click();
    await expect(page).toHaveURL(`${BASE}/`);

    await page.goto("/");
    await expect(page).toHaveURL(`${BASE}/`);
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await context.close();
  });
});

test.describe("제품 면 언어", () => {
  test("계정·쿠키가 없는 영어 브라우저는 영어로 그리고, 그 값을 계정 초기값으로 한 번 저장한다", async ({
    browser,
  }) => {
    const context = await contextFor(browser, "en-US");
    const page = await context.newPage();
    const warnings = collectHydrationWarnings(page);
    const patches: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "PATCH" && r.url().endsWith("/v1/users/me")) {
        patches.push(r.postData() ?? "");
      }
    });

    await page.goto(WS);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect.poll(() => cookieValue(context, ACCOUNT_COOKIE)).toBe("en");
    expect(await cookieValue(context, "heymoa-lang")).toBe("en");
    expect(patches).toEqual([JSON.stringify({ language: "en" })]);
    expect(warnings).toEqual([]);
    await context.close();
  });

  test("계정 값이 en 이면 쿠키 없는 한국어 브라우저에서도 영어로 SSR 된다", async ({
    browser,
  }) => {
    const context = await contextFor(browser, "ko-KR", [
      { name: ACCOUNT_COOKIE, value: "en" },
    ]);
    const page = await context.newPage();
    const response = await page.goto(WS);
    expect(await response?.text()).toMatch(/<html[^>]*\slang="en"/);
    await expect.poll(() => cookieValue(context, "heymoa-lang")).toBe("en");
    await context.close();
  });

  test("계정 ko · 쿠키 en 이면 계정이 이기고 쿠키가 ko 로 바뀐다", async ({
    browser,
  }) => {
    const context = await contextFor(browser, "en-US", [
      { name: ACCOUNT_COOKIE, value: "ko" },
      { name: "heymoa-lang", value: "en" },
    ]);
    const page = await context.newPage();
    await page.goto(WS);
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect.poll(() => cookieValue(context, "heymoa-lang")).toBe("ko");
    await context.close();
  });

  test("설정에서 English 를 고르면 계정에 저장한 뒤 문서를 새로 열어 영어가 된다", async ({
    browser,
  }) => {
    const context = await contextFor(browser, "ko-KR");
    const page = await context.newPage();
    await page.goto(`${WS}?settings=language`);
    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    await expect(
      page.getByRole("button", { name: "언어 · Language" })
    ).toHaveAttribute("aria-current", "page");

    const saved = page.waitForResponse(
      (r) =>
        r.request().method() === "PATCH" && r.url().endsWith("/v1/users/me")
    );
    await page.getByText("English", { exact: true }).click();
    expect((await saved).status()).toBe(200);

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("radio", { name: "English" })).toBeChecked();
    expect(await cookieValue(context, ACCOUNT_COOKIE)).toBe("en");
    expect(await cookieValue(context, "heymoa-lang")).toBe("en");
    await context.close();
  });

  test("영어 화면에서 로그아웃하면 /en 으로 가고 다음 방문도 영어다", async ({
    browser,
  }) => {
    const context = await contextFor(browser, "ko-KR", [
      { name: ACCOUNT_COOKIE, value: "en" },
    ]);
    const page = await context.newPage();
    await page.goto(WS);
    await expect.poll(() => cookieValue(context, "heymoa-lang")).toBe("en");

    await page.getByRole("button", { name: /테스트 유저/ }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(`${BASE}/en`);

    await page.goto("/");
    await expect(page).toHaveURL(`${BASE}/`);
    await page.goto(WS);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await context.close();
  });

  test("영어 계정이면 없는 노트 주소도 영어 문서로 열린다", async ({
    browser,
  }) => {
    const context = await contextFor(browser, "ko-KR", [
      { name: ACCOUNT_COOKIE, value: "en" },
    ]);
    const page = await context.newPage();
    await page.goto(`${WS}/notes/does-not-exist`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await context.close();
  });
});
