import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

/**
 * 제품 면 언어 결정과 계정 언어 연동(APP-1285).
 *
 * 언어 순서는 계정 → `heymoa-lang` 쿠키 → 브라우저 언어 → ko 다. 목 모드에서 계정 언어는 `heymoa-mock-account-lang`
 * 쿠키에 남는다 — 서버가 그린 첫 화면(SSR 목 사용자)과 브라우저 MSW 가 같이 읽어야 하기 때문이다(`lib/mocks/mock-user.ts`).
 * 그 쿠키를 다른 컨텍스트에 옮겨 심으면 「같은 계정으로 다른 브라우저에서 로그인」이 된다.
 *
 * 전체 설정은 한국어 브라우저(`locale: "ko-KR"`)로 돈다. 영어 브라우저가 필요한 시험은 자기 컨텍스트를 만든다.
 */

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

/** 개발 모드 React 가 콘솔에 남기는 hydration 경고를 모은다. */
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
    // 계정 언어가 영어라 사이드바 계정 메뉴도 영어다.
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(`${BASE}/en`);

    await page.goto("/");
    await expect(page).toHaveURL(`${BASE}/`);
    // 홈 첫 방문 이동은 쿠키가 있으면 걸리지 않는다. 고른 언어는 푸터와 제품 면이 쿠키로 읽는다.
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
