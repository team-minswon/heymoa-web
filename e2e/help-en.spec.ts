import { expect, test } from "@playwright/test";

/**
 * 사용 가이드 영어판(APP-1282). 영어 본문 · 영어 검색 색인 · `/en` 링크를 브라우저로 본다. 정적 페이지라 목 서비스 워커와 무관하다.
 */
const HANGUL = /[가-힣ㄱ-ㆎ]/;

// dev 서버가 처음 보는 라우트를 컴파일하느라 첫 요청이 느리다.
test.describe.configure({ timeout: 180_000 });

test("/en/help 와 주제 페이지에 한글이 남지 않는다", async ({ page }) => {
  for (const path of [
    "/en/help",
    "/en/help/start",
    "/en/help/start/desktop",
    "/en/help/fix/troubleshooting",
    "/en/help/situations/fix-speakers",
  ]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    // 상단바 · 사이드바 · 본문 · 푸터까지, 화면에 보이는 글 전부. 푸터 언어 선택의 「한국어」(`lang="ko"`)는 일부러 그 언어로 쓴다.
    // dev 서버는 다른 워커가 새 라우트를 컴파일할 때 HMR 로 문서를 다시 불러, 읽는 도중 실행 문맥이
    // 사라질 수 있다(전체 e2e 에서만 가끔). 읽기를 poll 로 감싸 그때는 다시 읽는다.
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
            .then((text) => text.match(new RegExp(`.{0,20}${HANGUL.source}.{0,20}`, "g")))
            .catch((error: Error) => [`(읽기 실패) ${error.message}`]),
        { message: path }
      )
      .toBeNull();
  }
});

test("영어 검색은 영어 결과와 /en 링크를 내고, 한국어판 색인과 섞이지 않는다", async ({
  page,
}) => {
  // 한국어판에서 먼저 검색해 한국어 색인을 받아 둔다
  await page.goto("/help");
  await page
    .getByRole("searchbox", { name: "사용 가이드 전체에서 찾기" })
    .fill("용어");
  await expect(page.getByRole("link", { name: /용어/ }).first()).toBeVisible();

  // 푸터의 언어 선택으로 영어판으로 넘어간다
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/help$/);
  await page
    .getByRole("searchbox", { name: "Search the whole guide" })
    .fill("glossary");
  const results = page.locator("a[href*='?q=']");
  await expect(results.first()).toBeVisible();
  const hrefs = await results.evaluateAll((links) =>
    links.map((a) => a.getAttribute("href"))
  );
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(href).toMatch(/^\/en\/help\//);
  expect(await page.locator("main").innerText()).not.toMatch(HANGUL);

  await results.first().click();
  await expect(page).toHaveURL(/\/en\/help\/[^/]+\/[^/?]+\?q=glossary/);
});

test("⌘K 팔레트도 영어판 색인으로 찾는다", async ({ page }) => {
  await page.goto("/en/help/record/recording");
  await page.waitForLoadState("networkidle");
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
