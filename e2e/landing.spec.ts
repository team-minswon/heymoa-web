import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

const inViewHidden = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("#meetings .tv-r")].filter((el) => {
        const box = el.getBoundingClientRect();
        return (
          box.top < window.innerHeight &&
          box.bottom > 0 &&
          getComputedStyle(el).opacity !== "1"
        );
      }).length
  );

const hiddenCards = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("#meetings .tv-r")].filter(
        (el) => getComputedStyle(el).opacity !== "1"
      ).length
  );

test("약관에서 회의 정리로 건너뛰어도 회의 카드가 보인다", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.locator("header.rounded-full")).toHaveCount(0);

  await page
    .locator("footer")
    .getByRole("link", { name: "회의 정리" })
    .first()
    .click();
  await page.waitForURL("**/#meetings");

  await expect(page.getByRole("heading", { name: /회의마다 남는 게/ })).toBeVisible();
  await expect.poll(() => inViewHidden(page)).toBe(0);

  await page.evaluate(() => window.scrollBy(0, 1200));
  await expect.poll(() => hiddenCards(page)).toBe(0);
});

test("랜딩 상단 바에서 회의 정리로 옮겨도 카드가 보인다", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header.rounded-full")).toHaveCount(0);

  await page.getByRole("link", { name: "회의 정리" }).first().click();
  await page.waitForURL("**/#meetings");

  await expect
    .poll(async () => {
      const a = await page.evaluate(() => Math.round(window.scrollY));
      await page.waitForTimeout(150);
      const b = await page.evaluate(() => Math.round(window.scrollY));
      return a === b;
    })
    .toBe(true);
  await expect.poll(() => inViewHidden(page)).toBe(0);
});

test("상단 바의 가격 안내는 가격 안내 페이지로 가고 랜딩에는 요금 구간이 없다", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#pricing")).toHaveCount(0);
  await page.getByRole("banner").getByRole("link", { name: "가격 안내", exact: true }).click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("인원이 늘어도 요금은 그대로입니다");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "가격 안내" })).toHaveAttribute("href", "/pricing");
});
