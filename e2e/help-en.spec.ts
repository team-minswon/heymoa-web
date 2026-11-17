import { expect, test } from "@playwright/test";
import { openGuide } from "./helpers-ui";

const HANGUL = /[가-힣ㄱ-ㆎ]/;

test("/en/help 와 주제 페이지에 한글이 남지 않는다", async ({ page }) => {
  for (const path of [
    "/en/help",
    "/en/help/start",
    "/en/help/start/desktop",
    "/en/help/fix/troubleshooting",
    "/en/help/situations/fix-speakers",
  ]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect
      .poll(
        () =>
          page
            .evaluate(() => {
              const body = document.body.cloneNode(true) as HTMLElement;
              body
                .querySelectorAll('[lang="ko"], script, style')
                .forEach((el) => el.remove());
              return body.textContent ?? "";
            })
            .then((text) =>
              text.match(new RegExp(`.{0,20}${HANGUL.source}.{0,20}`, "g"))
            )
            .catch((error: Error) => [`(읽기 실패) ${error.message}`]),
        { message: path }
      )
      .toBeNull();
  }
});

test("영어 검색은 영어 결과와 /en 링크를 내고, 한국어판 색인과 섞이지 않는다", async ({
  page,
}) => {
  await page.goto("/help");
  await page
    .getByRole("searchbox", { name: "사용 가이드 전체에서 찾기" })
    .fill("용어");
  await expect(page.getByRole("link", { name: /용어/ }).first()).toBeVisible();

  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/help$/);
  await page
    .getByRole("searchbox", { name: "Search the whole guide" })
    .fill("vocabulary");
  const results = page.locator("a[href*='?q=']");
  await expect(results.first()).toBeVisible();
  const hrefs = await results.evaluateAll((links) =>
    links.map((a) => a.getAttribute("href"))
  );
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(href).toMatch(/^\/en\/help\//);
  expect(await page.locator("main").innerText()).not.toMatch(HANGUL);

  await results.first().click();
  await expect(page).toHaveURL(/\/en\/help\/[^/]+\/[^/?]+\?q=vocabulary/);
});

test("⌘K 팔레트도 영어판 색인으로 찾는다", async ({ page }) => {
  await openGuide(page, "/en/help/record/recording");
  await page.keyboard.press("Control+k");
  const box = page.getByRole("combobox", { name: "Search the whole guide" });
  await expect(box).toBeFocused();
  await box.fill("microphone");
  await expect(page.getByRole("option").first()).toBeVisible();
  expect(await page.getByRole("listbox").innerText()).not.toMatch(HANGUL);
  await box.press("Enter");
  await expect(page).toHaveURL(/\/en\/help\/[^/]+\/[^/?]+\?q=microphone/);
});

test("영어판 사이드바 · 이전/다음 링크가 /en 아래에 머문다", async ({
  page,
}) => {
  await page.goto("/en/help/record/speakers");
  await expect(page.locator("h1")).toBeVisible();
  const hrefs = await page
    .locator("a[data-help-nav]")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""));
  expect(hrefs.length).toBeGreaterThan(10);
  for (const href of hrefs) expect(href).toMatch(/^(\/en\/help|#)/);
});
