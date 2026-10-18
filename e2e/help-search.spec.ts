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

test("?q= 로 들어오면 본문이 칠해지고 막대의 이전·다음으로 오간다", async ({ page }) => {
  await page.goto("/help/record/terms-context?q=%EC%9A%A9%EC%96%B4");
  await page.waitForLoadState("networkidle");
  const bar = page.getByRole("search", { name: "본문에서 일치하는 곳" });
  await expect(bar.getByText(/^1 \/ \d+$/)).toBeVisible();
  const total = Number((await bar.getByText(/^1 \/ \d+$/).textContent())!.split("/")[1]);
  expect(total).toBeGreaterThan(1);
  expect(await highlightCount(page, "help-search")).toBe(total);
  expect(await highlightCount(page, "help-search-active")).toBe(1);

  await bar.getByRole("button", { name: "다음 일치" }).click();
  await expect(bar.getByText(`2 / ${total}`)).toBeVisible();
  await bar.getByRole("button", { name: "이전 일치" }).click();
  await expect(bar.getByText(`1 / ${total}`)).toBeVisible();

  // 활성 일치는 상단바(97) 아래 화면 안에 있다 — 이동이 부드러운 스크롤이라 멈출 때까지 기다린다.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const range = [...(CSS.highlights.get("help-search-active") ?? [])][0] as Range;
        const box = range.getBoundingClientRect();
        return box.top >= 97 && box.bottom <= innerHeight;
      })
    )
    .toBe(true);

  // 닫으면 막대와 칠이 사라지고 주소의 검색어도 지워진다
  await bar.getByRole("button", { name: "검색 닫기" }).click();
  await expect(bar).toHaveCount(0);
  expect(await highlightCount(page, "help-search")).toBe(0);
  await expect(page).not.toHaveURL(/[?&]q=/);
});

test("일치가 없는 검색어는 막대가 안내한다", async ({ page }) => {
  await page.goto("/help/record/terms-context?q=ㅋㅋㅋ없는낱말");
  await expect(page.getByText("일치하는 내용이 없어요")).toBeVisible();
  expect(await highlightCount(page, "help-search")).toBe(0);
});

test("허브에서 찾으면 결과를 누른 페이지가 같은 검색어로 칠해진다", async ({ page }) => {
  await page.goto("/help");
  await page.getByRole("searchbox", { name: "사용 가이드 전체에서 찾기" }).fill("권한");
  const first = page.getByRole("link", { name: /회의 기록과 마이크 · 기록 시작하는 법/ });
  await first.click();
  await expect(page).toHaveURL(/\/help\/record\/recording\?q=.*#start/);
  await expect(page.getByRole("search", { name: "본문에서 일치하는 곳" })).toContainText("권한");
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

// 허브 · 그룹 · 기능 · 상황 모두에서 ⌘K · Ctrl+K 가 열고, 입력칸에 포커스가 있어도 열며, 다시 누르면 닫는다.
for (const path of ["/help", "/help/record", "/help/record/recording", "/help/situations/fix-speakers"]) {
  test(`${path} 에서 Ctrl+K · ⌘K 로 검색 팔레트가 열리고 닫힌다`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const box = page.getByRole("combobox", { name: "사용 가이드 전체에서 찾기" });
    for (const key of ["Control+k", "Meta+k"]) {
      await page.keyboard.press(key);
      await expect(box).toBeFocused();
      await page.keyboard.press(key);
      await expect(box).toHaveCount(0);
    }
  });
}

test("입력칸에 포커스가 있어도 Ctrl+K 가 팔레트를 연다", async ({ page }) => {
  await page.goto("/help");
  await page.waitForLoadState("networkidle");
  await page.getByRole("searchbox", { name: "사용 가이드 전체에서 찾기" }).focus();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("combobox", { name: "사용 가이드 전체에서 찾기" })).toBeFocused();
});

test("/ 는 기능 페이지에서 팔레트를, 허브에서는 허브 검색칸을 연다", async ({ page }) => {
  await page.goto("/help/record/recording");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("/");
  await expect(page.getByRole("combobox", { name: "사용 가이드 전체에서 찾기" })).toBeFocused();
  await page.goto("/help");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox", { name: "사용 가이드 전체에서 찾기" })).toBeFocused();
});

test("사이드바는 선택한 축의 모든 그룹을 항상 펼쳐 두고 탭이 축을 바꾼다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/help/record/recording");
  await page.waitForLoadState("networkidle");
  const nav = page.getByRole("navigation", { name: "사용 가이드 주제" });
  await expect(page.locator("details", { has: nav })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "문제 해결", exact: true })).toBeVisible();
  await expect(nav.locator("[aria-current='page']")).toHaveText("회의 기록과 마이크");
  // 탭은 현재 페이지가 속한 축이 기본이고, 누르면 사이드바 내용만 바뀐다
  await expect(page.getByRole("button", { name: "기능별", pressed: true })).toBeVisible();
  await page.getByRole("button", { name: "상황별" }).click();
  await expect(page.getByRole("button", { name: "상황별", pressed: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "문제 해결", exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/help\/record\/recording$/);
  // 가로 스크롤 없음
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  // 기능 페이지 끝에 “이런 상황에서 보세요”가 이 레시피로 연결된다
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
  // 스크롤이 멈추면 제목이 고정 상단바(97) 아래(scroll-margin 97+16)에 선다 — 가려지지 않는다
  await expect
    .poll(() => page.evaluate((i) => Math.round(document.getElementById(i)!.getBoundingClientRect().top), id))
    .toBe(113);
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
  expect(top).toBe(113);
  await context.close();
});

test("영상을 누르면 확대 창이 열리고 Esc 로 닫히며 포커스가 크게 보기 버튼으로 돌아온다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/help/situations/fix-speakers");
  await page.waitForLoadState("networkidle");
  const video = page.locator("figure video").first();
  await video.scrollIntoViewIfNeeded();
  const before = await video.boundingBox();
  await video.click({ force: true }); // 마우스는 영상 위 덮개 버튼에 닿는다
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const big = await dialog.locator("video").boundingBox();
  expect(big!.width).toBeGreaterThan(before!.width);
  // 열린 동안 본문의 같은 영상은 멈춘다
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: /크게 보기/ }).first()).toBeFocused();
  // 자리는 그대로
  expect((await video.boundingBox())!.height).toBe(before!.height);
});

// 배경을 눌러 팔레트를 닫을 때 화면이 깜빡이던 문제: 오버레이의 backdrop-blur 가 닫힘 때 서서히 풀리지 않고 뚝 끊겼다.
test("검색 팔레트를 열고 배경을 눌러 닫아도 폭·스크롤이 그대로고 레이아웃이 밀리지 않으며 배경 흐림이 없다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/help/situations/fix-speakers");
  await page.waitForLoadState("networkidle");
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    (window as unknown as { __shifts: number }).__shifts = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) (window as unknown as { __shifts: number }).__shifts += e.value;
    }).observe({ type: "layout-shift", buffered: false });
  });
  const state = () =>
    page.evaluate(() => ({ width: document.documentElement.clientWidth, y: Math.round(scrollY) }));
  const before = await state();
  await page.keyboard.press("Control+k");
  const overlay = page.locator("[data-slot='dialog-overlay']");
  await expect(overlay).toBeVisible();
  expect(await overlay.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("none");
  await page.mouse.click(1380, 850);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await state()).toEqual(before);
  expect(await page.evaluate(() => (window as unknown as { __shifts: number }).__shifts)).toBe(0);
});

// 선택해도 굵기가 바뀌지 않아야 글자 폭 · 줄바꿈 · 목록 높이가 그대로다. 누르면 주소가 바뀌기 전에 활성 표시가 먼저 옮겨 간다.
test("사이드바 항목을 눌러도 모든 항목의 폭·높이가 그대로고 활성 표시가 바로 옮겨 간다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/help/situations/fix-speakers");
  await page.waitForLoadState("networkidle");
  const links = page.getByRole("navigation", { name: "사용 가이드 주제" }).getByRole("link");
  const sizes = () =>
    links.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return [el.textContent, Math.round(r.width), Math.round(r.height)];
      })
    );
  const before = await sizes();
  const target = links.nth(3);
  await target.click();
  await expect(target).toHaveAttribute("aria-current", "page", { timeout: 300 });
  await expect(page).toHaveURL(/\/help\/situations\/(?!fix-speakers)/);
  expect(await sizes()).toEqual(before);
});

// 뒤로 가기로 허브에 돌아오면 주소의 ?q= 를 지웠다 100ms 뒤 다시 붙이던 문제(마운트 효과가 주소를 썼다).
test("허브에서 검색해 결과를 눌렀다 뒤로 가면 주소가 바뀌지 않고 history 가 쌓이지 않는다", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __writes: string[] };
    w.__writes = [];
    for (const m of ["replaceState", "pushState"] as const) {
      const orig = history[m];
      history[m] = function (...args: Parameters<History["replaceState"]>) {
        w.__writes.push(`${m} ${String(args[2])}`);
        return orig.apply(this, args);
      };
    }
  });
  await page.goto("/help");
  await page.waitForLoadState("networkidle");
  await page.getByRole("searchbox", { name: "사용 가이드 전체에서 찾기" }).fill("녹음 상태");
  await expect(page).toHaveURL(/\/help\?q=/);
  await page.locator("ul a[href*='?q=']").first().click();
  await expect(page).toHaveURL(/\/help\/[^/]+\/[^/?]+\?q=/);
  await page.waitForLoadState("networkidle");
  const historyBefore = await page.evaluate(() => history.length);
  await page.goBack();
  await expect(page).toHaveURL(/\/help\?q=/);
  const right = page.url();
  await page.evaluate(() => ((window as unknown as { __writes: string[] }).__writes.length = 0));
  await page.waitForTimeout(1000);
  expect(page.url()).toBe(right); // 뒤늦게 바뀌지 않는다
  expect(await page.evaluate(() => history.length)).toBe(historyBefore);
  // 돌아온 뒤 우리 쪽에서 history 를 쓰지 않는다
  expect(await page.evaluate(() => (window as unknown as { __writes: string[] }).__writes)).toEqual([]);
  await expect(page.getByRole("searchbox", { name: "사용 가이드 전체에서 찾기" })).toHaveValue("녹음 상태");
});

// 이미지 확대 창이 본문보다 작게(488 < 694) 열리던 문제. 이미지·영상 확대 창은 한 컴포넌트(HelpZoomDialog)의 같은 규칙이다.
for (const width of [1024, 1440]) {
  test(`${width}px 에서 이미지 확대는 본문 이미지보다 1.2배 넘게 크고 Esc 로 닫히며 포커스가 돌아온다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/help/record/recording");
    await page.waitForLoadState("networkidle");
    const trigger = page.locator("figure button:has(img)").first();
    const img = trigger.locator("img");
    await img.scrollIntoViewIfNeeded();
    const small = (await img.boundingBox())!;
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(400);
    const big = (await dialog.locator("img").boundingBox())!;
    expect(big.width).toBeGreaterThan(small.width * 1.2);
    expect(big.x).toBeGreaterThanOrEqual(0);
    expect(big.x + big.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `test-results/zoom-image-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}
