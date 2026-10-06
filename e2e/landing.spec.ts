import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

/**
 * 회의 카드 구간에서 **화면 안인데도** 아직 안 뜬 조각 수. 리빌은 감싼 `[data-reveal]` 이 아니라 안쪽
 * `.tv-r` 의 투명도로 숨긴다(`landing/motion.tsx`). `toBeVisible` 은 `opacity: 0` 을 안 잡아서 직접 잰다.
 */
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

/** 회의 카드 구간에서 아직 안 뜬 조각 수(화면 밖 포함). */
const hiddenCards = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll("#meetings .tv-r")].filter(
        (el) => getComputedStyle(el).opacity !== "1"
      ).length
  );

/**
 * 랜딩의 스크롤 리빌은 **브라우저에서만 깨진다.** jsdom 에는 `IntersectionObserver` 도 해시 점프도 없다.
 *
 * 실제로 밟은 것: 약관에서 푸터의 「기능 소개」(지금은 랜딩 푸터의 「회의 정리」)를 누르면 카드가 통째로 안 보였다.
 * react 가 ref 를 붙였다 떼고 다시 붙이는 사이에 브라우저가 앵커로 점프해서, 첫 부착은 「화면 밖」이라 감추고
 * 재부착은 「이미 보임」이라 그냥 반환해 **감춘 표시만 남았다**(`reveal.tsx`). 화면 아래의 조각이 아직 안 뜬 것은 정상이다.
 */
test("약관에서 회의 정리로 건너뛰어도 회의 카드가 보인다", async ({ page }) => {
  await page.goto("/terms");
  // 약관도 랜딩 크롬이다(`isLandingChromeRoute`) — 마케팅 Navbar(떠 있는 알약 `header.rounded-full`)가 서면 안 된다.
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

/** 같은 구간을 랜딩 안의 상단 바 링크로 옮기는 경우. 라우트가 안 바뀌고 스크롤만 옮겨서 조건이 다르다. */
test("랜딩 상단 바에서 회의 정리로 옮겨도 카드가 보인다", async ({ page }) => {
  await page.goto("/");
  // `/` 는 랜딩 자체 상단 바만 선다 — 마케팅 Navbar(떠 있는 알약 `header.rounded-full`)가 겹쳐 서면 안 된다.
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

/**
 * 「본문으로 건너뛰기」는 상단 바까지 건너뛴다. 랜딩 상단 바가 `<main>` 안에 있던 때는 건너뛴 뒤 다음
 * Tab 이 다시 로고 · 메뉴로 들어갔다 — 그래서 바는 `NavbarGate` 가 `<main>` 밖에 세운다. 약관도 같은 바를 쓴다.
 */
test("본문으로 건너뛰면 다음 Tab 이 상단 바로 돌아가지 않는다", async ({ page }) => {
  for (const path of ["/", "/terms"]) {
    await page.goto(path);
    // 첫 Tab 은 개발 서버의 도구 버튼이 먼저 받을 수 있어 링크에 바로 포커스를 준다.
    await page.getByRole("link", { name: "본문으로 건너뛰기" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
    await page.keyboard.press("Tab");

    const inTopBar = await page.evaluate(
      () => document.activeElement?.closest("header.sticky") !== null
    );
    expect(inTopBar, path).toBe(false);
  }
});
