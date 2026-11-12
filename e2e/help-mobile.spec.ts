import { expect, test } from "@playwright/test";
import { openGuide } from "./helpers-ui";

for (const locale of ["ko", "en"] as const) {
  test(`${locale} 모바일 가이드는 검색과 설치 탭을 유지하며 화면 밖으로 넘치지 않는다`, async ({ page }) => {
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await openGuide(page, `${locale === "en" ? "/en" : ""}/help/start/desktop`);
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      const search = page.locator('button[aria-keyshortcuts="Control+K Meta+K"]');
      await expect(search).toBeInViewport();
      await expect(page.locator("header").getByRole("link", { name: "HeyMoa", exact: true })).toBeInViewport();
      await page.getByRole("tab", { name: "Windows", exact: true }).click();
      await expect(page.getByRole("tabpanel")).toContainText("win-x64.exe");
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.getByRole("tab", { name: "Mac", exact: true }).click();
      await expect(page.getByRole("tabpanel")).toContainText("brew install");
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await search.click();
      await expect(page.getByRole("combobox", { name: locale === "ko" ? "사용 가이드 전체에서 찾기" : "Search the whole guide" })).toBeFocused();
      await page.keyboard.press("Escape");
    }
  });
}
