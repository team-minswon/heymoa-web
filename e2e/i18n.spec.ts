import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * 웹 국제화 기반(PRO-66-I01). 한국어는 무접두 주소 그대로, 영어는 `/en` 아래에 있고 설정 없이 검색에 공개된다(noindex 없음 · sitemap · hreflang).
 * 크롤러가 읽는 상태 코드·이동·`<head>` 는 서버 응답으로 보고, 화면 전환은 브라우저로 본다.
 */

/** 변경 전 운영 `sitemap.xml` 의 주소 전부(2026-10-21, `app/robots.test.ts` 의 옛 고정 목록). */
const PRODUCTION_SITEMAP = [
  "/",
  "/download",
  "/help",
  "/help/start",
  "/help/record",
  "/help/summary",
  "/help/team",
  "/help/connect",
  "/help/fix",
  "/help/situations",
  "/help/start/getting-started",
  "/help/start/workspace-basics",
  "/help/start/account",
  "/help/start/desktop",
  "/help/record/recording",
  "/help/record/speakers",
  "/help/record/terms-context",
  "/help/record/live-timeline",
  "/help/summary/meeting-end",
  "/help/summary/review",
  "/help/summary/export",
  "/help/team/tasks",
  "/help/team/agent",
  "/help/team/members",
  "/help/team/feedback",
  "/help/connect/integrations",
  "/help/connect/agent-mcp",
  "/help/fix/troubleshooting",
  "/help/fix/limits",
  "/help/situations/first-meeting",
  "/help/situations/summary-missing",
  "/help/situations/confirm-summary",
  "/help/situations/fix-speakers",
  "/help/situations/invite-team",
  "/help/situations/fix-terms",
  "/help/situations/assign-tasks",
  "/help/situations/find-decisions",
  "/help/situations/record-call-audio",
  "/help/situations/desktop-no-audio",
  "/help/situations/use-mcp",
  "/help/situations/data-privacy",
  "/terms",
  "/privacy",
];

// dev 서버가 처음 보는 라우트를 컴파일하느라 첫 요청이 느리다.
test.describe.configure({ timeout: 240_000 });

const get = (request: APIRequestContext, path: string) =>
  request.get(path, { maxRedirects: 0 });

const htmlLang = (html: string) =>
  html.match(/<html[^>]*\slang="([^"]*)"/)?.[1] ?? null;

test("변경 전 운영 sitemap 주소와 옛 가이드 주소가 같은 상태 코드·이동 목적지를 낸다", async ({
  request,
}) => {
  for (const path of PRODUCTION_SITEMAP) {
    const response = await get(request, path);
    expect(response.status(), path).toBe(200);
    expect(htmlLang(await response.text()), path).toBe("ko");
  }
  const legacy = await get(request, "/help/desktop");
  expect(legacy.status()).toBe(308);
  expect(legacy.headers().location).toBe("/help/start/desktop");
});

test("영어판은 /en 아래에서 lang=en 으로 열린다", async ({ request }) => {
  for (const path of ["/en", "/en/download", "/en/help", "/en/terms", "/en/privacy"]) {
    const response = await get(request, path);
    expect(response.status(), path).toBe(200);
    expect(htmlLang(await response.text()), path).toBe("en");
  }
  const legacy = await get(request, "/en/help/desktop");
  expect(legacy.status()).toBe(308);
  expect(legacy.headers().location).toBe("/en/help/start/desktop");
});

test("가이드 정적 파일은 한국어 rewrite 를 타지 않고 파일 그대로 나간다", async ({ request }) => {
  for (const [path, type] of [
    ["/help/getting-started/new-meeting.webp", "image/webp"],
    ["/help/clips/agent-ask.mp4", "video/mp4"],
    ["/help/search-index.json", "application/json"],
  ]) {
    const response = await get(request, path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain(type);
  }
});

test("/ko 접두 주소는 무접두 주소로 영구 이동한다", async ({ request }) => {
  for (const [from, to] of [
    ["/ko", "/"],
    ["/ko/help", "/help"],
    ["/ko/help/start/desktop", "/help/start/desktop"],
  ]) {
    const response = await get(request, from);
    expect(response.status(), from).toBe(308);
    expect(response.headers().location, from).toBe(to);
  }
});

async function expectNotFound(page: Page, lang: "ko" | "en") {
  const text =
    lang === "en"
      ? { title: "Page not found", home: "Back to home", href: "/en" }
      : { title: "페이지를 찾을 수 없습니다", home: "홈으로 돌아가기", href: "/" };
  await expect(page.getByRole("heading", { name: text.title })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", lang);
  await expect(page.getByRole("link", { name: text.home })).toHaveAttribute(
    "href",
    text.href
  );
}

/**
 * `/en` 아래 없는 주소는 `app/[lang]/[...rest]` 가 `notFound()` 를 불러 `app/[lang]/not-found.tsx` 가 그린다.
 * **상태 코드는 여기서 보지 않는다.** 목 모드에서는 `MockProvider` 가 SSR 에서 본문을 그리지 않아 `notFound()` 가
 * 응답 전에 불리지 않으므로 200 이다. 운영 빌드의 404 는 `scripts/check-route-status.mjs` 가 본다.
 */
for (const path of ["/en/없는-주소", "/en/w/x"]) {
  test(`${path} 는 직접 진입과 앱 안 이동 모두 영어 404 다`, async ({ page }) => {
    await page.goto(path);
    await expectNotFound(page, "en");

    await page.goto("/en/terms");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.evaluate((to) => {
      (window as unknown as { next: { router: { push(href: string): void } } }).next.router.push(to);
    }, path);
    await expect(page).toHaveURL(encodeURI(path));
    await expectNotFound(page, "en");
  });
}

test("언어도 제품 경로도 아닌 주소는 쿠키가 없으면 한국어 404, 고른 언어가 있으면 그 언어다", async ({
  page,
  context,
}) => {
  for (const path of ["/없는-주소", "/없는-주소/더-깊은"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expectNotFound(page, "ko");
  }

  await context.addCookies([
    { name: "heymoa-lang", value: "en", domain: "localhost", path: "/" },
  ]);
  const response = await page.goto("/없는-주소");
  expect(response?.status()).toBe(404);
  await expectNotFound(page, "en");
});

test("랜딩 푸터에서 언어를 고르면 같은 페이지의 다른 언어판으로 가고 쿠키가 남는다", async ({
  page,
  context,
}) => {
  const langCookie = async () =>
    (await context.cookies()).find((cookie) => cookie.name === "heymoa-lang")
      ?.value;

  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // `/en` 에 들어온 것만으로는 쿠키를 쓰지 않는다.
  expect(await langCookie()).toBeUndefined();

  await page.goto("/help/start/desktop");
  const picker = page.getByRole("navigation", { name: "언어" });
  await picker.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL("/en/help/start/desktop");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await langCookie()).toBe("en");

  await page
    .getByRole("navigation", { name: "Language" })
    .getByRole("link", { name: "한국어" })
    .click();
  await expect(page).toHaveURL("/help/start/desktop");
  expect(await langCookie()).toBe("ko");
});

test("/en 랜딩은 제목·설명·OpenGraph·본문이 영어이고 한글이 남지 않는다", async ({
  page,
  request,
}) => {
  const html = await (await request.get("/en")).text();
  const head = html.slice(0, html.indexOf("</head>"));
  expect(head).toContain("<title>HeyMoa | Real-time AI meeting notes</title>");
  expect(head).toContain('property="og:locale" content="en_US"');
  // 머리의 글(title · description · og · twitter · JSON-LD)에 한글이 없다. alternateName 의 「헤이모아」는 브랜드 표기라 뺀다.
  expect(head.replaceAll("헤이모아", "").replaceAll("헤이 모아", "")).not.toMatch(/[가-힣]/);

  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  // 대본이 한 바퀴 도는 사이 모든 장면의 글이 영어인지는 vitest(hero-stage)가 본다. 여기서는 첫 화면과 아래 구간 전부다.
  const korean = await page.evaluate(() => {
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      // 언어 선택의 「한국어」는 그 언어 자신의 이름으로 쓴다(`lang="ko"`).
      if (node.parentElement?.closest('[lang="ko"], script, style')) continue;
      if (/[가-힣]/.test(node.data)) found.push(node.data.trim());
    }
    return found;
  });
  expect(korean).toEqual([]);
});

test("영어판은 설정 없이 색인 대상이다 — noindex 가 없고 sitemap·hreflang 에 영어 주소가 오른다", async ({
  request,
}) => {
  const en = await (await request.get("/en/help")).text();
  expect(en).not.toMatch(/<meta name="robots" content="[^"]*noindex/);
  expect(en).toContain('<link rel="canonical" href="https://heymoa.app/en/help"/>');
  expect(en).toContain('hrefLang="ko" href="https://heymoa.app/help"');
  expect(en).toContain('hrefLang="en" href="https://heymoa.app/en/help"');
  expect(en).toContain('hrefLang="x-default" href="https://heymoa.app/help"');

  const ko = await (await request.get("/help")).text();
  expect(ko).not.toMatch(/<meta name="robots" content="[^"]*noindex/);
  expect(ko).toContain('<link rel="canonical" href="https://heymoa.app/help"/>');
  expect(ko).toContain('hrefLang="ko" href="https://heymoa.app/help"');
  expect(ko).toContain('hrefLang="en" href="https://heymoa.app/en/help"');
  expect(ko).toContain('hrefLang="x-default" href="https://heymoa.app/help"');

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://heymoa.app/help</loc>");
  expect(sitemap).toContain("<loc>https://heymoa.app/en/help</loc>");
  expect(sitemap).toContain("<loc>https://heymoa.app/en</loc>");
  expect(sitemap).toContain("<loc>https://heymoa.app/en/terms</loc>");
});

test("회의록 삭제 확인창의 긴 문구에서 한국어 낱말이 줄 끝에서 갈리지 않는다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(
    "/w/01K0000000000/notes/01K0000000021?view=full&tab=summary&reviewCase=all-selected"
  );
  await page.getByRole("button", { name: "노트 메뉴", exact: true }).click();
  await page.getByRole("menuitem", { name: "삭제", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();

  const result = await dialog.evaluate((root) => {
    const broken: string[] = [];
    let words = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      // 낱말은 공백과 가운뎃점·쉼표로 나눈다. 가운뎃점 뒤는 원래 줄을 바꿀 수 있는 자리다.
      for (const match of node.data.matchAll(/[^\s·,.]+/g)) {
        if (!/[가-힣]/.test(match[0])) continue;
        words += 1;
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const lines = new Set(
          [...range.getClientRects()].map((rect) => Math.round(rect.top))
        );
        if (lines.size > 1) broken.push(match[0]);
      }
    }
    const item = root.querySelector("p");
    return {
      broken,
      words,
      wordBreak: item ? getComputedStyle(item).wordBreak : null,
    };
  });
  expect(result.words).toBeGreaterThan(20);
  expect(result.wordBreak).toBe("keep-all");
  expect(result.broken).toEqual([]);
});

/** 화면의 글자(언어 선택의 「한국어」처럼 `lang="ko"` 로 표시한 것 제외)에서 한글을 모은다. */
const visibleHangul = (page: Page) =>
  page.evaluate(() => {
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.parentElement?.closest('[lang="ko"], script, style')) continue;
      if (/[가-힣]/.test(node.data)) found.push(node.data.trim());
    }
    for (const element of document.querySelectorAll("[aria-label], [title], [alt]")) {
      for (const name of ["aria-label", "title", "alt"]) {
        const value = element.getAttribute(name);
        if (value && /[가-힣]/.test(value) && !element.closest('[lang="ko"]')) found.push(value);
      }
    }
    return found;
  });

for (const { path, title } of [
  { path: "/en/download", title: "Download the desktop app | HeyMoa" },
  { path: "/en/terms", title: "Terms of Service | HeyMoa" },
  { path: "/en/privacy", title: "Privacy Policy | HeyMoa" },
]) {
  test(`${path} 는 제목·머리·본문이 영어이고 한글이 남지 않는다`, async ({ page, request }) => {
    const html = await (await request.get(path)).text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain(`<title>${title}</title>`);
    expect(head).toContain('property="og:locale" content="en_US"');
    expect(head.replaceAll("헤이모아", "").replaceAll("헤이 모아", "")).not.toMatch(/[가-힣]/);

    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(await visibleHangul(page)).toEqual([]);
  });
}

test("다운로드 공유 이미지는 언어마다 따로 나오고 alt 도 그 언어다", async ({ request }) => {
  const en = await (await request.get("/en/download")).text();
  expect(en).toContain('property="og:image" content="https://heymoa.app/en/download/opengraph-image"');
  expect(en).toContain('property="og:image:alt" content="Download the HeyMoa desktop app"');
  const ko = await (await request.get("/download")).text();
  expect(ko).toContain('property="og:image" content="https://heymoa.app/download/opengraph-image"');
  expect(ko).toContain('property="og:image:alt" content="HeyMoa(헤이모아) 데스크톱 앱 다운로드"');

  const [enImage, koImage] = await Promise.all(
    ["/en/download/opengraph-image", "/download/opengraph-image"].map((url) => request.get(url))
  );
  for (const image of [enImage, koImage]) {
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
  }
  // 글이 다르면 그림도 다르다.
  expect(Buffer.compare(await enImage.body(), await koImage.body())).not.toBe(0);
});

test("약관 영어판의 한국어본 링크는 같은 문서의 한국어 주소로 간다", async ({ page }) => {
  await page.goto("/en/privacy#section-5");
  await expect(page.locator("#section-5 h2")).toHaveText("5. Automatic Collection and How to Refuse It");
  await page.getByRole("link", { name: "Read the Korean version" }).click();
  await expect(page).toHaveURL("/privacy");
  await expect(page.locator("#section-5 h2")).toHaveText("제5조 (자동 수집 장치와 거부 방법)");
});
