import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

/** 아직 안 뜬 카드 수. `toBeVisible`은 `opacity: 0`을 안 잡아서 직접 잰다. */
const hiddenCards = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("#features [data-reveal]")].filter(
        (el) => getComputedStyle(el).opacity !== "1"
      ).length
  );

/** **화면 안인데도** 안 뜬 카드 수. 이 값이 0이 아니면 그 자리가 비어 보인다. */
const inViewHidden = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("#features [data-reveal]")].filter((el) => {
        const box = el.getBoundingClientRect();
        return (
          box.top < window.innerHeight &&
          box.bottom > 0 &&
          getComputedStyle(el).opacity !== "1"
        );
      }).length
  );

/**
 * 랜딩의 스크롤 리빌은 **브라우저에서만 깨진다.** jsdom에는 `IntersectionObserver`도 해시
 * 점프도 없어서 vitest가 이 경로를 한 번도 지나지 않는다.
 *
 * 실제로 밟은 것: 약관에서 푸터의 「기능 소개」를 누르면 기능 카드가 통째로 안 보였다.
 * react가 ref를 붙였다 떼고 다시 붙이는 사이에 브라우저가 앵커로 점프해서, 첫 부착은
 * 「화면 밖」이라 감추고 재부착은 「이미 보임」이라 그냥 반환해 **감춘 표시만 남았다.**
 *
 * 화면 아래에 있는 카드가 아직 안 뜨는 것은 정상이다 — 그건 스크롤이 켠다. 여기서 지키는
 * 것은 「건너뛴 자리에 보일 것이 보이는가」와 「내리면 나머지가 뜨는가」 둘이다.
 */
test("약관에서 기능 소개로 건너뛰어도 카드가 보인다", async ({ page }) => {
  await page.goto("/terms");

  await page
    .locator("footer")
    .getByRole("button", { name: "기능 소개" })
    .first()
    .click();
  await page.waitForURL("**/#features");

  // 건너뛴 자리에서 이미 화면에 든 카드는 감춰져 있으면 안 된다.
  await expect(page.getByText("받아 적을 사람을 따로").first()).toBeVisible();
  await expect.poll(() => inViewHidden(page)).toBe(0);

  // 내리면 나머지도 뜬다.
  await page.evaluate(() => window.scrollBy(0, 1200));
  await expect.poll(() => hiddenCards(page)).toBe(0);
});

/**
 * 같은 링크를 랜딩 안에서 누르는 경우. 라우트가 안 바뀌고 스크롤만 옮겨서 조건이 다르다.
 */
test("랜딩 안에서 기능 소개로 옮겨도 카드가 보인다", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "기능 소개" }).first().click();

  // 이쪽은 부드러운 스크롤(`scrollIntoView({behavior:"smooth"})`)이라 멈출 때까지 기다린다.
  await expect
    .poll(async () => {
      const a = await page.evaluate(() => Math.round(window.scrollY));
      await page.waitForTimeout(150);
      const b = await page.evaluate(() => Math.round(window.scrollY));
      return a === b;
    })
    .toBe(true);

  // 화면에 든 카드는 감춰져 있으면 안 된다.
  await expect.poll(() => inViewHidden(page)).toBe(0);

  // 섹션을 지나가며 훑으면 나머지도 다 뜬다.
  for (let i = 0; i < 6; i += 1) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(200);
  }
  await expect.poll(() => hiddenCards(page)).toBe(0);
});
