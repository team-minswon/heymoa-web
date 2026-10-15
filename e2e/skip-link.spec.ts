import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * APP-1101. 「본문으로 건너뛰기」는 키보드로 닿을 때만 보이고, 마우스 뒤의 프로그램 포커스
 * (다이얼로그가 닫히며 포커스가 돌아오는 따위)에서는 숨는다. 보임은 sr-only(1px)가 풀렸는지로 잰다.
 */
const skip = (page: Page) =>
  page.getByRole("link", { name: "본문으로 건너뛰기" });
const width = (l: Locator) => l.evaluate((e) => e.getBoundingClientRect().width);

test("첫 Tab 에서 보이고 Enter 로 본문으로 간다", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // dev 에서는 Next 개발 도구(nextjs-portal)가 첫 Tab 을 먼저 받는다. 그 뒤가 skip link 다.
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press("Tab");
    if (await skip(page).evaluate((e) => e === document.activeElement)) break;
  }
  await expect(skip(page)).toBeFocused();
  expect(await width(skip(page))).toBeGreaterThan(20);
  await expect(skip(page)).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("마우스로 버튼을 누른 뒤의 프로그램 포커스로는 보이지 않는다", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button").first().click();
  await skip(page).evaluate((e) => (e as HTMLElement).focus());
  await expect(skip(page)).toBeFocused();
  expect(await width(skip(page))).toBeLessThanOrEqual(1);
});
