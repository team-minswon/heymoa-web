import { expect, test } from "@playwright/test";

for (const width of [1440, 1024]) {
  for (const language of ["ko", "en"]) {
    test(`legacy update stays inline without overlap at ${width}px in ${language}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        locale: language === "ko" ? "ko-KR" : "en-US",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36 HeyMoa/0.1.2 Electron/44.5.1",
      });
      await context.addInitScript(() => {
        Object.defineProperty(window, "heymoaDesktop", {
          value: {
            getCapabilities: async () => ({
              platform: "win32",
              supported: true,
            }),
          },
        });
      });
      const page = await context.newPage();
      await page.goto("/w/01K0000000000");
      const notice = page.getByRole("complementary", {
        name: language === "ko" ? "앱 업데이트 안내" : "App update notice",
      });
      await expect(notice).toBeVisible();
      await expect(notice).toHaveCount(1);
      const download = notice.getByRole("link");
      await expect(download).toHaveAttribute(
        "href",
        "https://github.com/team-minswon/homebrew-tap/releases/latest/download/HeyMoa-win-x64.exe"
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const geometry = await notice.evaluate((element) => {
        const rect = element.getBoundingClientRect(),
          button = element.querySelector("a")!.getBoundingClientRect();
        const text = element.querySelector("div")!.getBoundingClientRect();
        return {
          position: getComputedStyle(element).position,
          height: rect.height,
          overflow: element.scrollWidth > element.clientWidth,
          gap: button.left - text.right,
          buttonInside: button.right <= rect.right,
          verticalOffset: Math.abs(
            button.top + button.height / 2 - (rect.top + rect.height / 2)
          ),
        };
      });
      expect(geometry.position).toBe("static");
      expect(geometry.overflow).toBe(false);
      expect(geometry.height).toBeLessThanOrEqual(130);
      expect(geometry.gap).toBeGreaterThanOrEqual(12);
      expect(geometry.buttonInside).toBe(true);
      expect(geometry.verticalOffset).toBeLessThan(1);
      await page.screenshot({
        path: `/tmp/app-1553-notice-${width}-${language}.png`,
      });
      await context.close();
    });
  }
}

test("an updatable native app never gets the legacy install notice", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "heymoaDesktop", {
      value: {
        getUpdateState: async () => ({
          currentVersion: "0.1.4",
          automatic: false,
          status: "idle",
          canRestart: false,
        }),
        checkForUpdates() {},
        setAutomaticUpdates() {},
        restartForUpdate() {},
        subscribeUpdates: () => () => {},
      },
    });
  });
  await page.goto("/w/01K0000000000");
  await expect(
    page.getByRole("heading", { name: "모든 노트", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "앱 업데이트 안내" })
  ).toHaveCount(0);
});
