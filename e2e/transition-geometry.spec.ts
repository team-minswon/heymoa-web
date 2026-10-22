import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * **탭·단계·로딩을 오가도 그릇의 크기와 탭 줄 자리가 그대로인가(APP-1356).**
 *
 * 전수조사에서 어긋났던 곳마다 대표 전환 하나씩을 잰다. jsdom 은 레이아웃을 계산하지 않아 vitest 로는 못 잰다.
 * 같은 묶음의 다른 검사 — 문의·피드백 탭(`feedback-dialog-geometry`), 데스크톱 앱 안내 단계(`download`),
 * 스켈레톤 → 도착(`skeleton-geometry`) — 는 그 파일들에 있다.
 *
 * 절대 크기는 못박지 않는다. 문구가 바뀌면 값이 바뀌는 것이 정상이고, 재는 것은 **전환 전후의 차이**다.
 */

const WS = "01K0000000000";
const NOTE = `/w/${WS}/notes/01K0000000920`;

const rectOf = (locator: Locator) =>
  locator.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return [b.x, b.y, b.width, b.height].map(Math.round);
  });

/** 열리는 zoom 애니메이션이 끝난 뒤에 잰다 — 도는 동안은 scale 로 크기가 바뀐다. */
async function settled(locator: Locator) {
  await locator.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished))
  );
  return locator;
}

async function openNoteSummary(page: Page) {
  await page.goto(`${NOTE}?view=full&tab=summary`);
  await expect(page.getByText("검토 중", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

for (const width of [1440, 1024]) {
  test.describe(`${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
    });

    test("설정 탭을 모두 오가도 창 크기와 본문 왼쪽·폭이 같다", async ({
      page,
    }) => {
      await page.goto(`/w/${WS}?settings=workspace`);
      const dialog = await settled(page.locator("[data-slot=dialog-content]"));
      const content = page.getByTestId("settings-panel").locator("> *");
      const nav = page.getByRole("navigation", { name: "설정" });
      const seen = new Map<string, string>();
      for (const name of [
        "일반",
        "멤버",
        "임시 참여자",
        "용어 사전",
        "연동",
        "MCP 연결",
        "내 계정",
        "알림",
        "내 MCP 연결",
      ]) {
        await nav.getByRole("button", { name, exact: true }).click();
        await expect(
          nav.getByRole("button", { name, exact: true })
        ).toHaveAttribute("aria-current", "page");
        // skeleton 이 걷힌 뒤에 잰다 — 도착 전후의 차이는 `skeleton-geometry` 몫이다
        await expect(
          page.getByTestId("settings-panel").locator("[data-slot=skeleton]")
        ).toHaveCount(0, { timeout: 15_000 });
        const [x, , w] = await rectOf(content);
        seen.set(name, `창 ${await rectOf(dialog)} · 본문 x=${x} w=${w}`);
      }
      expect(new Set(seen.values()).size, JSON.stringify([...seen])).toBe(1);
    });

    test("회의록 보내기 — 쓰는 화면에서 보낸 결과로 넘어가도 창 크기가 같다", async ({
      page,
    }) => {
      await openNoteSummary(page);
      await page.getByRole("button", { name: "내보내기·공유" }).click();
      await page.getByRole("menuitem", { name: "이메일로 보내기" }).click();
      const dialog = page.getByRole("dialog", { name: "회의록 보내기" });
      const before = await rectOf(await settled(dialog));

      const input = dialog.getByRole("combobox", { name: "받는 사람" });
      await input.fill("partner@client.co.kr");
      await input.press("Enter");
      await dialog.getByRole("button", { name: "1명에게 보내기" }).click();
      await expect(
        dialog.getByRole("list", { name: "받는 사람별 결과" })
      ).toBeVisible({ timeout: 15_000 });

      expect(await rectOf(dialog)).toEqual(before);
    });

    test("회의록 PDF — 미리본 뒤 녹취록을 바꿔도 창이 접히지 않는다", async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await openNoteSummary(page);
      await page.getByRole("button", { name: "내보내기·공유" }).click();
      await page.getByRole("menuitem", { name: /PDF로 내보내기/ }).click();
      const dialog = page.getByRole("dialog", {
        name: "회의록 PDF로 내보내기",
      });
      await settled(dialog);
      await dialog.getByRole("button", { name: "PDF 미리보기" }).click();
      await expect(dialog.getByTitle("첨부할 회의록 PDF")).toBeVisible({
        timeout: 60_000,
      });
      const previewed = await rectOf(await settled(dialog));

      await dialog.getByRole("switch", { name: "녹취록" }).click();
      await expect(dialog.getByText(/PDF를 다시 확인해 주세요/)).toBeVisible();
      expect(await rectOf(await settled(dialog))).toEqual(previewed);
    });

    test("가이드 검색 — 주제·결과·결과 없음을 오가도 창 높이가 같다", async ({
      page,
    }) => {
      await page.goto("/help/record/recording");
      await page.waitForLoadState("networkidle");
      await page.keyboard.press("Control+k");
      const dialog = await settled(page.getByRole("dialog"));
      const box = page.getByRole("listbox");
      await expect(box.getByRole("button").first()).toBeVisible();
      const topics = await rectOf(dialog);

      await page.keyboard.type("녹음");
      await expect(box.locator("[id^=help-hit-]").first()).toBeVisible();
      expect(await rectOf(dialog)).toEqual(topics);

      await page.keyboard.type("zzzzqq");
      await expect(box.locator("[id^=help-hit-]")).toHaveCount(0);
      expect(await rectOf(dialog)).toEqual(topics);
    });

    test("가이드 본문 탭(Mac · Windows)을 오가도 상자 높이가 같다", async ({
      page,
    }) => {
      await page.goto("/help/start/desktop");
      const tabs = page.locator("[data-help-main] [role=tablist]").first();
      await expect(tabs).toBeVisible(); // 하이드레이션 뒤에만 선다
      const box = tabs.locator("..");
      const sizes = [];
      for (const tab of await tabs.getByRole("tab").all()) {
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        sizes.push(await rectOf(box));
      }
      expect(sizes.length).toBeGreaterThan(1);
      for (const size of sizes) expect(size).toEqual(sizes[0]);
    });

    test("내 MCP 연결 안내 — 앱 탭을 오가도 카드 높이가 같다", async ({
      page,
    }) => {
      await page.goto(`/w/${WS}?settings=agents`);
      await page.getByRole("button", { name: "새 연결" }).first().click();
      const guide = page.getByRole("region", { name: "OAuth 연결 안내" });
      const sizes = [];
      for (const tab of await guide.getByRole("tab").all()) {
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        sizes.push(await rectOf(guide));
      }
      expect(sizes).toHaveLength(4);
      for (const size of sizes) expect(size).toEqual(sizes[0]);
    });

    test("노트 상단바 — 노트가 도착해도 탭 줄이 제자리다", async ({ page }) => {
      // 목이 즉답이라 불러오는 중을 붙잡아 둔다 — `page.route` 는 서비스 워커 응답을 못 늦춘다(`skeleton-geometry`)
      await page.addInitScript(() => {
        const original = window.fetch.bind(window);
        window.fetch = async (...args: Parameters<typeof fetch>) => {
          if (/\/v1\/notes\/[^/?]+(\?|$)/.test(String(args[0])))
            await new Promise((resolve) => setTimeout(resolve, 3000));
          return original(...args);
        };
      });
      await page.goto(`${NOTE}?view=full&tab=summary`);
      const tablist = page.locator("[data-slot=note-top-bar] [role=tablist]");
      await expect(page.getByLabel("노트 불러오는 중")).toBeVisible({
        timeout: 20_000,
      });
      const loading = await rectOf(tablist);
      await expect(page.getByLabel("노트 불러오는 중")).toBeHidden({
        timeout: 20_000,
      });
      expect(await rectOf(tablist)).toEqual(loading);
    });
  });
}
