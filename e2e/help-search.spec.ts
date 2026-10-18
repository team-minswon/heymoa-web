import { expect, test, type Page } from "@playwright/test";

/**
 * 사용 가이드 검색 (APP-1232). 본문 DOM 은 건드리지 않고 CSS Custom Highlight API 로만 칠하므로, 칠해진 구간의 수는
 * `CSS.highlights` 로 읽는다. 정적 페이지라 목 서비스 워커와 무관하다.
 */
const highlightCount = (page: Page, name: string) =>
  page.evaluate(
    (key) => [...(CSS.highlights.get(key) ?? [])].length,
    name
  );

test("가이드 페이지에서 찾으면 본문이 칠해지고 이전·다음으로 오간다", async ({ page }) => {
  await page.goto("/help/record/terms-context");
  // 키 입력은 하이드레이션 뒤에 받는다
  await page.waitForLoadState("networkidle");
  const input = page.getByRole("searchbox", { name: "사용 가이드에서 찾기" });

  // `/` 는 입력 중이 아닐 때만 검색칸으로 온다
  await page.keyboard.press("/");
  await expect(input).toBeFocused();

  await input.fill("용어");
  await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
  const total = Number((await page.getByText(/^1 \/ \d+$/).textContent())!.split("/")[1]);
  expect(total).toBeGreaterThan(1);
  expect(await highlightCount(page, "help-search")).toBe(total);
  expect(await highlightCount(page, "help-search-active")).toBe(1);
  // 주소에 검색어가 남아 링크로 나눌 수 있다
  await expect(page).toHaveURL(/[?&]q=%EC%9A%A9%EC%96%B4/);

  await input.press("Enter");
  await expect(page.getByText(`2 / ${total}`)).toBeVisible();
  await input.press("Shift+Enter");
  await expect(page.getByText(`1 / ${total}`)).toBeVisible();

  // 활성 일치는 화면 안에 있다 — 이동이 부드러운 스크롤(APP-1237)이라 멈출 때까지 기다린다.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const range = [...(CSS.highlights.get("help-search-active") ?? [])][0] as Range;
        const box = range.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight;
      })
    )
    .toBe(true);

  // 일치가 없는 조항의 목차는 흐려진다. 없으면 안내한다
  await input.fill("ㅋㅋㅋ없는낱말");
  await expect(page.getByText(/다른 낱말로 찾아보세요/)).toBeVisible();
  expect(await highlightCount(page, "help-search")).toBe(0);

  // Esc 는 검색어를 지운다
  await input.fill("용어");
  await input.press("Escape");
  await expect(input).toHaveValue("");
  await expect(page.getByText("를 눌러 찾기")).toBeVisible();
  expect(await highlightCount(page, "help-search")).toBe(0);
});

test("허브에서 찾으면 결과를 누른 페이지가 같은 검색어로 칠해진다", async ({ page }) => {
  await page.goto("/help");
  await page.getByRole("searchbox", { name: "사용 가이드 전체에서 찾기" }).fill("권한");
  const first = page.getByRole("link", { name: /회의 기록과 마이크 · 기록 시작하기/ });
  await first.click();
  await expect(page).toHaveURL(/\/help\/record\/recording\?q=.*#start/);
  await expect(page.getByRole("searchbox", { name: "사용 가이드에서 찾기" })).toHaveValue("권한");
  await expect.poll(() => highlightCount(page, "help-search")).toBeGreaterThan(0);
});

test("⌘K · Ctrl+K 로 검색 팔레트가 열리고 Enter 로 이동한다", async ({ page }) => {
  await page.goto("/help/record/recording");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Control+k");
  const box = page.getByRole("combobox", { name: "사용 가이드 전체에서 찾기" });
  await expect(box).toBeFocused();
  await box.fill("용어 사전");
  await expect(page.getByRole("option").first()).toBeVisible();
  await box.press("Enter");
  await expect(page).toHaveURL(/\/help\/[^/]+\/[^/?]+\?q=/);
});

test("옛 /help#recording 링크는 새 주제 주소로 옮겨진다", async ({ page }) => {
  await page.goto("/help#trouble");
  await expect(page).toHaveURL(/\/help\/fix\/troubleshooting$/);
});

test("상황별 페이지는 단계 목록과 영상을 낸다 · 기능 페이지는 역링크를 낸다", async ({ page }) => {
  await page.goto("/help/situations/fix-speakers");
  await expect(page.getByRole("heading", { name: "이름이 잘못 나온 화자를 고치고 싶어요", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "이렇게 해 보세요" })).toBeVisible();
  await expect(page.locator("#help-article ol li").first()).toBeVisible();
  expect(await page.locator("video").first().evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
  // 기능 페이지 끝에 「이런 상황에서 보세요」가 이 레시피로 연결된다
  await page.goto("/help/record/speakers");
  await expect(page.getByRole("link", { name: "이름이 잘못 나온 화자를 고치고 싶어요" }).last()).toBeVisible();
});

test("움직임 줄이기 설정이면 영상은 자동 재생하지 않는다", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/help/situations/fix-speakers");
  const video = page.locator("video").first();
  await video.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  expect(await video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
  await context.close();
});

test("같은 페이지 목차는 부드럽게 스크롤하고 주소만 바꾼다 (APP-1237)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/help/record/recording");
  await page.waitForLoadState("networkidle");
  const link = page.locator("aside [data-toc-link]").nth(3);
  const id = (await link.getAttribute("href"))!.slice(1);
  const rsc: string[] = [];
  page.on("request", (r) => r.url().includes("_rsc") && rsc.push(r.url()));
  await link.click();
  await expect(page).toHaveURL(new RegExp(`#${id}$`));
  // 스크롤이 멈추면 제목이 고정 머리 아래(scroll-margin 96)에 선다
  await expect
    .poll(() => page.evaluate((i) => Math.round(document.getElementById(i)!.getBoundingClientRect().top), id))
    .toBe(96);
  await expect(page.locator(`#${id} h2`)).toBeFocused();
  expect(rsc).toEqual([]);
});

test("움직임 줄이기면 목차 이동이 바로 끝난다 (APP-1237)", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("/help/record/recording");
  await page.waitForLoadState("networkidle");
  await page.locator("aside [data-toc-link]").nth(3).click();
  const top = await page.evaluate(() => Math.round(document.getElementById(location.hash.slice(1))!.getBoundingClientRect().top));
  expect(top).toBe(96);
  await context.close();
});
