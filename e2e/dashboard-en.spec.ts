import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import ts from "typescript";

/**
 * 영어 계정으로 제품 화면을 열면 화면 문구에 한글이 없다.
 *
 * 화면에 보이는 텍스트 노드와 `aria-label`·`placeholder`·`title`, 문서 제목에서 한글을 모은다. 목 데이터(노트 제목·전사·
 * 채팅·사람 이름·목 서버의 오류 문구)는 사용자 데이터·AI 결과물 자리라 한국어로 남는다. 그 문자열은 손으로 고르지 않고
 * `lib/mocks/**` 원본의 문자열 리터럴에서 끌어온다 — 목이 바뀌면 허용 목록도 같이 바뀐다.
 */

test.describe.configure({ timeout: 240_000 });

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const WS = "/w/01K0000000000";
const MENTORING_NOTE = "01K0000000920";
/** 타임라인 항목이 있는 맥락 데모 노트(`proposals.spec` 과 같다). 멘토링 회의는 타임라인이 비어 있다. */
const CONTEXT_NOTE = "01K0000000005";

const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;

/**
 * 화면 언어와 무관하게 두 언어로 적는 이름표. 설정의 「언어 · Language」 탭은 지금 언어를 못 읽는 사람도 찾아야 해서
 * 두 언어로 둔다(decisions.md D13). 언어 고르기의 「한국어」도 같은 이유로 자기 언어 이름이다.
 */
const BILINGUAL = ["언어 · Language", "한국어"];

/**
 * 한국어 언어 파일(`messages/ko/*.json`)의 문구 조각. ICU 자리(`{name}`)·태그(`<link>`)에서 끊는다. 목 데이터와 같은 낱말
 * (「알림」)이 화면에 남으면 그것이 목 데이터인지 남은 문구인지 가를 수 없으니, 허용 목록에서 이 조각을 뺀다.
 *
 * 마케팅 면 이름공간과 입력 예시(`*Placeholder`)는 뺀다. 예시는 목 시드와 같은 이름(「주간 제품 회의」)을 일부러 쓴다.
 * 그래서 입력 예시가 한국어로 남고 그 값이 목 데이터와 같으면 이 검사가 놓친다.
 */
const MARKETING_NAMESPACES = ["landing", "legal", "help", "download"];

function koMessagePieces() {
  const dir = join(__dirname, "..", "messages", "ko");
  const out = new Set<string>();
  const walk = (value: unknown, key = "") => {
    if (/Placeholder$/.test(key)) return;
    if (typeof value === "string") {
      for (const piece of value.split(/[{}<>#\n]/)) {
        const text = piece.replace(/\s+/g, " ").trim();
        if (HANGUL.test(text)) out.add(text);
      }
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([k, v]) => walk(v, k));
    }
  };
  for (const name of readdirSync(dir)) {
    if (MARKETING_NAMESPACES.includes(name.replace(/\.json$/, ""))) continue;
    walk(JSON.parse(readFileSync(join(dir, name), "utf8")));
  }
  return out;
}

const KO_PIECES = koMessagePieces();
/**
 * 문구 하나와 같은가. 일부까지 보면 언어 파일 속 예시(「예: 주간 제품 회의 · …」)가 같은 목 데이터를 막는다. 문구가
 * 강조·링크로 쪼개져 그려지는 조각은 태그에서 끊어 두었으므로 같음으로 충분하다.
 */
const isKoMessage = (text: string) => KO_PIECES.has(text);

/** `dirs` 아래 시험이 아닌 원본에서 한글이 든 문자열 리터럴(템플릿의 고정 조각, JSX 글자 포함)을 모은다. 주석은 안 본다. */
function sourceStrings(dirs: string[], skip: RegExp = /^$/) {
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (skip.test(path)) continue;
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        const source = ts.createSourceFile(
          path,
          readFileSync(path, "utf8"),
          ts.ScriptTarget.Latest,
          false,
          path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        );
        const visit = (node: ts.Node) => {
          if (
            ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node) ||
            ts.isTemplateHead(node) ||
            ts.isTemplateMiddle(node) ||
            ts.isTemplateTail(node) ||
            ts.isJsxText(node)
          ) {
            for (const line of node.text.split("\n")) {
              const value = line.replace(/\s+/g, " ").trim();
              if (HANGUL.test(value)) out.add(value);
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    }
  };
  dirs.forEach((dir) => walk(join(__dirname, "..", dir)));
  return out;
}

/**
 * 제품 코드(`app/`·`components/`·`lib/` 중 목 밖)에 한국어로 박힌 문자열. 언어 파일로 옮기지 않은 문구가 목 데이터와
 * 우연히 같아도 허용 목록이 감싸지 않게, 이것도 허용 목록에서 뺀다.
 */
const PRODUCT_LITERALS = sourceStrings(
  ["app", "components", "lib"],
  // 목·목 화면, 계약 예시가 든 orval 산출물, 마케팅 면은 제품 화면 문구가 아니다
  /\/(mocks|mock-[^/]*)(\/|$)|\/api\/generated(\/|$)|\/\[lang\](\/|$)|\/heymoa\/landing(\/|$)/
);

/**
 * 허용 목록: `lib/mocks/**` 의 문자열. 한국어 문구(`koMessagePieces`)나 제품 코드의 한국어 리터럴과 같은 것은 뺀다 —
 * 화면에 그것이 보이면 목 데이터인지 남은 문구인지 가를 수 없다.
 */
function mockStrings() {
  const out = [...sourceStrings(["lib/mocks"])].filter(
    (value) => !KO_PIECES.has(value) && !PRODUCT_LITERALS.has(value)
  );
  // 긴 것부터 지워야 짧은 이름(「한지원」)이 긴 문장 일부를 먼저 지우지 않는다
  // 첨부 파일명에는 사용자 제목의 파일명 금지 문자만 치환되어 남는다.
  const fileNames = out.map((value) => value.replace(/[\\/:*?"<>|]/g, "_").slice(0, 50));
  return [...out, ...fileNames, ...BILINGUAL].sort((a, b) => b.length - a.length);
}

const MOCK_STRINGS = mockStrings();
/** 줄바꿈·강조로 쪼개진 목 문장의 한 조각이 이만큼 길면 그 문장의 일부로 본다. 짧은 조각은 UI 낱말과 겹칠 수 있다. */
const FRAGMENT_MIN = 8;

/** 목 문자열을 지운 뒤에도 한글이 남는 문자열만 돌려준다. 한국어 문구의 조각과 같은 문자열은 목에 있어도 남긴다. */
function leftoverHangul(texts: string[]) {
  return [...new Set(texts)].filter((raw) => {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!HANGUL.test(text)) return false;
    if (BILINGUAL.includes(text)) return false;
    // 한국어 문구나 제품 코드의 한국어 리터럴 그대로면 더 긴 목 문장의 일부여도 남은 문구다
    if (isKoMessage(text) || PRODUCT_LITERALS.has(text)) return true;
    if (
      text.length >= FRAGMENT_MIN &&
      MOCK_STRINGS.some((value) => value.includes(text))
    ) {
      return false;
    }
    let rest = text;
    for (const value of MOCK_STRINGS) {
      if (rest.includes(value)) rest = rest.replaceAll(value, " ");
      if (!HANGUL.test(rest)) return false;
    }
    // 아바타 이니셜처럼 목 이름의 첫 글자 하나
    const initial = rest.trim();
    if (/^[가-힣]$/.test(initial)) {
      return !MOCK_STRINGS.some((value) => value.startsWith(initial));
    }
    return true;
  });
}

/** 보이는 텍스트 노드와 사람이 읽는 속성, 문서 제목. 숨은 요소(`display:none`·`visibility:hidden`)는 뺀다. */
async function screenTexts(page: Page) {
  return page.evaluate(() => {
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        r.width > 0 &&
        r.height > 0 &&
        s.visibility !== "hidden" &&
        s.display !== "none"
      );
    };
    const texts: string[] = [document.title];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (
        el &&
        !el.closest("script,style,noscript") &&
        // 화면 언어와 상관없이 한국어로 나가는 것(서버가 한국어로 보내는 공유 메일의 미리보기)은 `lang="ko"` 로 표시돼 있다
        el.closest("[lang]")?.getAttribute("lang") !== "ko" &&
        shown(el)
      ) {
        texts.push(node.textContent ?? "");
      }
    }
    for (const el of document.querySelectorAll(
      "[aria-label],[placeholder],[title]"
    )) {
      // sr-only 는 1px 이라 shown 을 지난다. 여기서 빠지는 것은 정말 안 보이는 요소다
      if (!shown(el)) continue;
      for (const name of ["aria-label", "placeholder", "title"]) {
        const value = el.getAttribute(name);
        if (value) texts.push(value);
      }
    }
    return texts;
  });
}

async function expectEnglish(page: Page, screen: string) {
  // 각 호출자가 연 화면의 조회가 끝난 뒤 보이는 번역을 검사합니다.
  await expect(page.locator('[data-slot="skeleton"]:visible')).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect.poll(async () => leftoverHangul(await screenTexts(page)), { message: screen }).toEqual([]);
}

/**
 * 개발 모드 React 의 hydration 경고(`product-language.spec` 과 같다)와 next-intl 의 문구 오류를 모은다. 없는 키는 키 이름이
 * 영문으로 그려져 한글 검사에 안 걸리므로 콘솔로 잡는다.
 */
function collectHydrationWarnings(page: Page) {
  const warnings: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (
      /hydrat|MISSING_MESSAGE|INVALID_MESSAGE|FORMATTING_ERROR|INVALID_KEY/i.test(
        text
      )
    ) {
      warnings.push(text);
    }
  });
  return warnings;
}

async function englishPage(browser: Browser) {
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies(
    [
      { name: "heymoa-mock-account-lang", value: "en" },
      { name: "heymoa-lang", value: "en" },
    ].map((c) => ({ ...c, url: BASE }))
  );
  const page = await context.newPage();
  const warnings = collectHydrationWarnings(page);
  return { context, page, warnings };
}

async function open(page: Page, path: string, ready: Locator) {
  await page.goto(BASE + path);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(ready).toBeVisible({ timeout: 30_000 });
}

test("회의록 목록 · 할 일 · 알림 · 내 에이전트", async ({ browser }) => {
  const { context, page, warnings } = await englishPage(browser);

  // 목록 행이 도착한 뒤에 본다
  await open(page, WS, page.getByLabel(/^Open note /).first());
  await expectEnglish(page, "회의록 목록");

  await open(
    page,
    `${WS}/tasks`,
    page.getByRole("heading", { name: "Overdue", exact: false })
  );
  await expectEnglish(page, "할 일");

  await open(
    page,
    `${WS}?notifications=all`,
    page
      .getByRole("dialog", { name: "Notifications" })
      .getByRole("button")
      .filter({ hasText: HANGUL })
      .first()
  );
  await expectEnglish(page, "알림");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Open My agent" }).click();
  const panel = page.getByTestId("personal-chat-panel");
  await expect(panel).toBeVisible();
  await expectEnglish(page, "내 에이전트 첫 화면");
  await panel.getByRole("button", { name: "Chat history" }).click();
  const history = page.getByTestId("chat-history-view");
  await expect(history).toBeVisible();
  await expectEnglish(page, "내 에이전트 대화 기록");
  await history.getByRole("button").filter({ hasText: HANGUL }).first().click();
  await expect(history).toBeHidden();
  await expectEnglish(page, "내 에이전트 대화");

  expect(warnings).toEqual([]);
  await context.close();
});

test("노트 상세의 탭과 회의록 내보내기", async ({ browser }) => {
  const { context, page, warnings } = await englishPage(browser);
  const note = (id: string, tab: string, extra = "") =>
    `${WS}/notes/${id}?view=full&tab=${tab}${extra}`;
  const tabPanel = page.getByRole("tabpanel");

  // 탭 안에 목 데이터(참여자·발화·타임라인 항목)가 그려진 뒤에 본다
  for (const tab of ["details", "transcript"]) {
    await open(page, note(MENTORING_NOTE, tab), tabPanel);
    await expect(tabPanel).toContainText(HANGUL);
    await expectEnglish(page, `노트 ${tab}`);
  }
  await open(page, note(CONTEXT_NOTE, "context"), tabPanel);
  await expect(tabPanel).toContainText(HANGUL);
  await expectEnglish(page, "노트 타임라인");

  await open(
    page,
    note(MENTORING_NOTE, "summary", "&reviewCase=all-selected"),
    page.getByText("In review", { exact: true })
  );
  await expectEnglish(page, "노트 요약 · 검토");

  await page.getByRole("button", { name: "Export and share" }).click();
  await expectEnglish(page, "내보내기 메뉴");
  await page.getByRole("menuitem", { name: /Export as PDF/ }).click();
  const pdfDialog = page.getByRole("dialog", {
    name: "Export meeting notes as PDF",
  });
  await expect(pdfDialog).toBeVisible();
  await expectEnglish(page, "회의록 PDF 창");

  const downloading = page.waitForEvent("download", { timeout: 90_000 });
  await pdfDialog.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloading;
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  // 문서 언어는 카탈로그에 압축 없이 실린다. 본문 글자는 글꼴 부분집합으로 인코딩돼 바이트로 못 읽는다
  expect(bytes.toString("latin1")).toMatch(/\/Lang \(en\)/);
  // 제목은 목 데이터라 한국어로 남는다. 앞뒤 틀만 영어다
  expect(download.suggestedFilename()).toBe(
    "Meeting notes_9 11 팀 이동준 멘토님 - 정규멘토링_20260911.pdf"
  );
  await expect(pdfDialog).toBeHidden();

  await page.getByRole("button", { name: "Export and share" }).click();
  await page.getByRole("menuitem", { name: /email/i }).click();
  const mailDialog = page.getByRole("dialog", { name: "Send meeting notes" });
  await expect(mailDialog).toBeVisible();
  // 화면 언어의 예시를 보여 주고 실제 발송 언어는 수신자 설정을 따른다고 알린다.
  await mailDialog.getByText("Email example").click();
  await expect(mailDialog.getByText("The meeting notes are attached as a PDF.")).toBeVisible();
  await expect(mailDialog.getByText(/actual email uses the recipient/)).toBeVisible();
  await expectEnglish(page, "회의록 메일 창");

  expect(warnings).toEqual([]);
  await context.close();
});

test("설정의 모든 탭", async ({ browser }) => {
  const { context, page, warnings } = await englishPage(browser);
  const dialog = page.getByRole("dialog", { name: "Settings" });
  // 탭마다 조회가 도착했다는 표시(목 데이터나 서버 값으로 정해지는 컨트롤)
  const sections: Record<string, Locator> = {
    account: dialog.getByRole("textbox", { name: "Email" }),
    language: dialog.getByRole("radio", { name: "English", checked: true }),
    workspace: dialog.getByRole("textbox", { name: "Workspace name" }),
    members: dialog.getByText("jiwon@heymoa.com"),
    guests: dialog.getByText("1 meeting note").first(),
    terms: dialog
      .getByRole("button", { name: /^Remove / })
      .or(dialog.getByText("No terms yet."))
      .first(),
    integrations: dialog.getByText("Linear", { exact: true }),
    workspaceAgents: dialog.getByRole("switch", {
      name: /Allow MCP connections/,
    }),
    billing: dialog.getByRole("link", { name: "Plans and billing" }),
    agents: dialog.getByText("노트북 Claude Code").first(),
    notifications: dialog.getByText("Paused meetings"),
  };
  for (const [section, ready] of Object.entries(sections)) {
    await open(page, `${WS}?settings=${section}`, ready);
    // 입력 칸은 값이 채워져야 조회가 도착한 것이다
    if (section === "account") await expect(ready).toHaveValue(/@/);
    if (section === "workspace") await expect(ready).not.toHaveValue("");
    await expectEnglish(page, `설정 ${section}`);
  }

  // 메일·연동 복귀 주소는 워크스페이스의 설정 창으로 돌려보낸다. 도착한 탭과 연동 결과 토스트를 본다
  await open(page, "/settings/notifications", sections.notifications);
  await expect(page).toHaveURL(/settings=notifications/);
  await expectEnglish(page, "/settings/notifications");
  await open(
    page,
    "/settings/integrations?provider=LINEAR&status=connected",
    page.getByText("Connected Linear.")
  );
  await expect(page).toHaveURL(/settings=integrations/);
  await expect(sections.integrations).toBeVisible();
  await expectEnglish(page, "/settings/integrations");

  expect(warnings).toEqual([]);
  await context.close();
});

test("초대와 외부 에이전트 동의", async ({ browser }) => {
  const { context, page, warnings } = await englishPage(browser);

  await open(
    page,
    "/invite",
    page.getByRole("heading", { name: "This invitation link isn't valid" })
  );
  await expectEnglish(page, "토큰 없는 초대");
  // 만료된 초대(목 `01K0000000026`)
  await open(
    page,
    "/invite?token=01K0000000026",
    page.getByRole("heading", { name: "This invitation has expired" })
  );
  await expectEnglish(page, "만료된 초대");

  for (const state of ["mock-consent", "mock-consent-read"]) {
    await open(
      page,
      `/oauth/consent?state=${state}`,
      // 목 동의 요청의 에이전트 이름. 요청 내용이 도착한 뒤에 본다
      page.getByText("Codex").first()
    );
    await expectEnglish(page, `에이전트 동의 ${state}`);
  }
  await open(page, "/oauth/consent", page.getByRole("heading", { level: 1 }));
  await expectEnglish(page, "에이전트 동의 끝");

  expect(warnings).toEqual([]);
  await context.close();
});
