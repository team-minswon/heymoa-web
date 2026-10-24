import { expect, test, type Page } from "@playwright/test";

// This suite runs with playwright.auth.config.ts: SSR must be anonymous, not the MSW preset's MOCK_USER.
const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const INSTAGRAM = `${SAFARI} Instagram 400.0.0.0`;
const CAMPAIGN =
  "utm_source=instagram&utm_medium=paid_social&utm_campaign=handoff_test&fbclid=sample-click";

async function externalNavigationAttempts(page: Page) {
  const attempts: string[] = [];
  const session = await page.context().newCDPSession(page);
  await session.send("Page.enable");
  // A simulator browser has no native Instagram handler. Observe the requested navigation,
  // rather than treating a blocked scheme or pageleave as a successful app handoff.
  session.on("Page.frameRequestedNavigation", ({ url }: { url: string }) => {
    if (url.startsWith("instagram://")) attempts.push(url);
  });
  return attempts;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test.beforeEach(async ({ page }) => {
  await page.route("**/v1/auth/session", (route) =>
    route.fulfill({
      json: { success: true, data: { state: "anonymous" }, error: null },
    })
  );
});

test.describe("Instagram landing entry", () => {
  test.use({ userAgent: INSTAGRAM, viewport: { width: 390, height: 844 } });

  test("requests an external browser on entry, keeps attribution, and leaves a retry/copy fallback", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const attempts = await externalNavigationAttempts(page);
    await page.goto(`/?${CAMPAIGN}`);

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "브라우저에서 이어갈게요" })
    ).toBeVisible();
    await expect.poll(() => attempts.length).toBeGreaterThanOrEqual(1);
    const launch = new URL(attempts[0]);
    const destination = new URL(launch.searchParams.get("url")!);
    expect(destination.pathname).toBe("/");
    expect(destination.searchParams.get("utm_source")).toBe("instagram");
    expect(destination.searchParams.get("utm_campaign")).toBe("handoff_test");
    expect(destination.searchParams.get("fbclid")).toBe("sample-click");
    await expect(dialog.getByRole("status")).toContainText(
      "외부 브라우저로 열기"
    );
    await expectNoHorizontalOverflow(page);

    const previousAttempts = attempts.length;
    await dialog.getByRole("button", { name: "브라우저에서 계속하기" }).click();
    await expect.poll(() => attempts.length).toBeGreaterThan(previousAttempts);
    await dialog
      .getByRole("button", { name: "링크 복사", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "복사했습니다" })
    ).toBeVisible();
    const copied = new URL(
      await page.evaluate(() => navigator.clipboard.readText())
    );
    expect(copied.pathname).toBe("/");
    expect(copied.searchParams.get("fbclid")).toBe("sample-click");

    // Reloading the same in-app tab must not keep launching the external app.
    const attemptsBeforeReload = attempts.length;
    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(attempts).toHaveLength(attemptsBeforeReload);
  });

  test("login continuation retains returnTo without automatically launching again", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const attempts = await externalNavigationAttempts(page);
    await page.goto(`/auth/login?returnTo=%2Fsettings&${CAMPAIGN}`);
    await expect(
      page.getByRole("heading", { name: "HeyMoa에 로그인" })
    ).toBeVisible();
    const open = page.getByRole("button", {
      name: "브라우저에서 Google 로그인",
    });
    await expect(open).toBeVisible();
    expect(attempts).toHaveLength(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);

    await open.click();
    await expect.poll(() => attempts.length).toBeGreaterThanOrEqual(1);
    await page.getByRole("button", { name: "로그인 링크 복사" }).click();
    await expect(
      page.getByRole("button", { name: "복사했습니다" })
    ).toBeVisible();
    const copied = new URL(
      await page.evaluate(() => navigator.clipboard.readText())
    );
    expect(copied.pathname).toBe("/auth/login");
    expect(copied.searchParams.get("returnTo")).toBe("/settings");
    expect(copied.searchParams.get("utm_source")).toBe("instagram");
    expect(copied.searchParams.get("fbclid")).toBe("sample-click");
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("regular Safari", () => {
  test.use({ userAgent: SAFARI });

  test("stays on the landing and uses the existing consent form at the destination", async ({
    page,
  }) => {
    const attempts = await externalNavigationAttempts(page);
    await page.goto(`/?${CAMPAIGN}`);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(attempts).toHaveLength(0);

    await page.goto(
      `/auth/login?returnTo=%2Fsettings&handoff_app=instagram&handoff_os=ios&${CAMPAIGN}`
    );
    await expect(
      page.getByRole("heading", { name: "HeyMoa에 로그인" })
    ).toBeVisible();
    const login = page.getByRole("button", { name: "Google로 로그인" });
    await expect(login).toHaveAttribute("aria-disabled", "true");
    const consent = page.getByRole("checkbox");
    await expect(consent).not.toBeChecked();
    await consent.check();
    await expect(login).not.toHaveAttribute("aria-disabled");
    await expect(page).toHaveURL(/returnTo=%2Fsettings/);
    await expect
      .poll(() => new URL(page.url()).searchParams.has("handoff_app"))
      .toBe(false);
    expect(new URL(page.url()).searchParams.get("utm_source")).toBe(
      "instagram"
    );
    expect(new URL(page.url()).searchParams.get("fbclid")).toBe("sample-click");
    expect(attempts).toHaveLength(0);
    // The no-API test server deliberately stops before OAuth; returnTo forwarding is unit-tested.
  });
});

for (const width of [1440, 1024, 390]) {
  test(`handoff loading and fallback fit the ${width}px bottom layout`, async ({
    page,
  }) => {
    // Freeze the real 1200ms handoff UI timer so the loading screenshot cannot miss it.
    await page.clock.install({ time: new Date("2026-10-24T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-24T00:00:01Z"));
    await page.addInitScript((ua) => {
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        get: () => ua,
      });
    }, INSTAGRAM);
    const height = width === 390 ? 844 : 900;
    await page.setViewportSize({ width, height });
    await page.goto(`/?${CAMPAIGN}`);
    const dialog = page.getByRole("dialog");
    const opening = dialog
      .getByRole("status")
      .filter({ hasText: "브라우저를 여는 중" });
    await expect
      .poll(async () => {
        if (await opening.isVisible()) return true;
        // Let hydration/query notifications advance without exhausting the opening interval.
        await page.clock.runFor(50);
        return opening.isVisible();
      })
      .toBe(true);
    await page.clock.runFor(200);
    await expect(dialog).toBeVisible();
    await expect(opening.locator("svg.animate-spin")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "링크 복사", exact: true })
    ).toHaveCount(0);
    await expectBottomDialog(page, height);
    await expectTwoLineDescription(page);
    await page.screenshot({
      path: test.info().outputPath(`handoff-opening-${width}.png`),
      animations: "disabled",
    });

    // Expiry exposes manual controls; it does not assert native handoff failure.
    await page.clock.runFor(1201);
    await expect(
      dialog.getByRole("button", { name: "링크 복사", exact: true })
    ).toBeVisible();
    await expect(opening).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectBottomDialog(page, height);
    await expectTwoLineDescription(page);
    await page.screenshot({
      path: test.info().outputPath(`handoff-fallback-${width}.png`),
      animations: "disabled",
    });
  });
}

async function expectBottomDialog(page: Page, viewportHeight: number) {
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width
  );
  expect(bounds!.y).toBeGreaterThan(viewportHeight / 2);
  expect(
    Math.abs(viewportHeight - bounds!.y - bounds!.height - 16)
  ).toBeLessThanOrEqual(2);
}

async function expectTwoLineDescription(page: Page) {
  const lines = await page
    .getByRole("dialog")
    .locator("p.whitespace-pre-line")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        whiteSpace: style.whiteSpace,
        count:
          element.getBoundingClientRect().height /
          Number.parseFloat(style.lineHeight),
      };
    });
  expect(lines.whiteSpace).toBe("pre-line");
  expect(lines.count).toBeCloseTo(2, 1);
}
