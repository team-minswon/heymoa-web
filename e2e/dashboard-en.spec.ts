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

test.describe.configure({ timeout: 240_000 });

const BASE = process.env.E2E_BASE ?? "http://localhost:3100";
const WS = "/w/01K0000000000";
const MENTORING_NOTE = "01K0000000920";
const CONTEXT_NOTE = "01K0000000005";

const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;

const BILINGUAL = ["언어 · Language", "한국어"];

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
const isKoMessage = (text: string) => KO_PIECES.has(text);

function sourceStrings(dirs: string[], skip: RegExp = /^$/) {
  const out = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (skip.test(path)) continue;
      if (entry.isDirectory()) walk(path);
      else if (
        /\.tsx?$/.test(entry.name) &&
        !/\.test\.tsx?$/.test(entry.name)
      ) {
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

const PRODUCT_LITERALS = sourceStrings(
  ["app", "components", "lib"],
  /\/(mocks|mock-[^/]*)(\/|$)|\/api\/generated(\/|$)|\/\[lang\](\/|$)|\/heymoa\/landing(\/|$)/
);

function mockStrings() {
  const out = [...sourceStrings(["lib/mocks"])].filter(
    (value) => !KO_PIECES.has(value) && !PRODUCT_LITERALS.has(value)
  );
  const fileNames = out.map((value) =>
    value.replace(/[\\/:*?"<>|]/g, "_").slice(0, 50)
  );
  return [...out, ...fileNames, ...BILINGUAL].sort(
    (a, b) => b.length - a.length
  );
}

const MOCK_STRINGS = mockStrings();
const FRAGMENT_MIN = 8;

function leftoverHangul(texts: string[]) {
  return [...new Set(texts)].filter((raw) => {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!HANGUL.test(text)) return false;
    if (BILINGUAL.includes(text)) return false;
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
    const initial = rest.trim();
    if (/^[가-힣]$/.test(initial)) {
      return !MOCK_STRINGS.some((value) => value.startsWith(initial));
    }
    return true;
  });
}

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
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (
        el &&
        !el.closest("script,style,noscript") &&
        el.closest("[lang]")?.getAttribute("lang") !== "ko" &&
        shown(el)
      ) {
        texts.push(node.textContent ?? "");
      }
    }
    for (const el of document.querySelectorAll(
      "[aria-label],[placeholder],[title]"
    )) {
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
  await expect(page.locator('[data-slot="skeleton"]:visible')).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect
    .poll(async () => leftoverHangul(await screenTexts(page)), {
      message: screen,
    })
    .toEqual([]);
}

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
  expect(bytes.toString("latin1")).toMatch(/\/Lang \(en\)/);
  expect(download.suggestedFilename()).toBe(
    "Meeting notes_9 11 팀 이동준 멘토님 - 정규멘토링_20260911.pdf"
  );
  await expect(pdfDialog).toBeHidden();

  await page.getByRole("button", { name: "Export and share" }).click();
  await page.getByRole("menuitem", { name: /email/i }).click();
  const mailDialog = page.getByRole("dialog", { name: "Send meeting notes" });
  await expect(mailDialog).toBeVisible();
  await mailDialog.getByText("Email example").click();
  await expect(
    mailDialog.getByText("The meeting notes are attached as a PDF.")
  ).toBeVisible();
  await expect(
    mailDialog.getByText(/actual email uses the recipient/)
  ).toBeVisible();
  await expectEnglish(page, "회의록 메일 창");

  expect(warnings).toEqual([]);
  await context.close();
});

test("설정의 모든 탭", async ({ browser }) => {
  const { context, page, warnings } = await englishPage(browser);
  const dialog = page.getByRole("dialog", { name: "Settings" });
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
    billing: dialog.getByRole("button", { name: "Start Pro" }),
    payment: dialog.getByRole("region", { name: "Payment history" }),
    agents: dialog.getByText("노트북 Claude Code").first(),
    notifications: dialog.getByText("Paused meetings"),
  };
  for (const [section, ready] of Object.entries(sections)) {
    await open(page, `${WS}?settings=${section}`, ready);
    if (section === "account") await expect(ready).toHaveValue(/@/);
    if (section === "workspace") await expect(ready).not.toHaveValue("");
    await expectEnglish(page, `설정 ${section}`);
  }

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
      page.getByText("Codex").first()
    );
    await expectEnglish(page, `에이전트 동의 ${state}`);
  }
  await open(page, "/oauth/consent", page.getByRole("heading", { level: 1 }));
  await expectEnglish(page, "에이전트 동의 끝");

  expect(warnings).toEqual([]);
  await context.close();
});
