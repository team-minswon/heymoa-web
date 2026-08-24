import { expect, test } from "@playwright/test";

/**
 * 맥락 후보 레일 — **MSW 목 대상**.
 *
 * 같은 세 시나리오의 **실서버 판**은 `integration-candidates.spec.ts`에 있고, APP-459가
 * 배포되면 그쪽이 초록이 된다. 이 파일은 **계약과 무관하게 화면이 옳은지**를 지킨다 —
 * 서버가 늦어도 UI 회귀는 여기서 잡힌다.
 *
 * 목 시나리오는 `lib/mocks/context-candidates.ts`가 정하고, 후보 피드는 전용 노트
 * (`CONTEXT_DEMO_NOTE_ID`)에서만 흐른다. 다른 노트에 흘리면 공유 챗의 30초 안전 폴링이
 * 굶는다 — 실제로 그렇게 e2e 하나가 깨졌다.
 */

const WORKSPACE_ID = "01K0000000000";
/** `CONTEXT_DEMO_NOTE_ID`. 목이 이 노트에만 후보를 흘린다. */
const NOTE_ID = "01K0000000005";

const railUrl = `/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full`;

async function openRail(page: import("@playwright/test").Page) {
  await page.goto(railUrl);
  // 이 목 노트는 「시작 전」이라 레일 기본이 「이 회의」다.
  await page.getByRole("tab", { name: "실시간 정리" }).click();
}

test.describe("맥락 후보 레일", () => {
  test("REST 스냅샷만으로 후보가 그려진다", async ({ page }) => {
    test.setTimeout(60_000);
    await openRail(page);

    // 스냅샷이 정본이다 — WS 이벤트가 하나도 안 와도 화면이 선다.
    await expect(page.getByText(/지금까지 \d+건/)).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText("경로 데이터 저장소는 MongoDB를 사용한다")
    ).toBeVisible();

    // 결정만 강조되고 유형은 회색 단어로 말한다.
    await expect(page.getByText("결정").first()).toBeVisible();
    // 근거 시각이 회의 축으로 찍힌다.
    await expect(page.getByText(/전사 \d+:\d\d/).first()).toBeVisible();
  });

  test("철회와 답변됨이 서로 다르게 보인다", async ({ page }) => {
    test.setTimeout(60_000);
    await openRail(page);
    await expect(page.getByText(/지금까지 \d+건/)).toBeVisible({ timeout: 20_000 });

    // 철회는 취소이고 해결은 성취다. 같은 흐림으로 그리면 안 된다.
    await expect(page.getByText("철회됨")).toBeVisible();
    await expect(page.getByText("답변됨")).toBeVisible();
  });

  test("새로고침해도 원장이 남는다 — 이벤트가 아니라 스냅샷이 정본이다", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openRail(page);
    const before = await page
      .getByText(/지금까지 \d+건/)
      .textContent({ timeout: 20_000 });

    await page.reload();
    await page.getByRole("tab", { name: "실시간 정리" }).click();

    const after = await page
      .getByText(/지금까지 \d+건/)
      .textContent({ timeout: 20_000 });
    expect(after).toBe(before);
    expect(after).not.toBe("지금까지 0건");
  });

  test("근거를 눌러 전사의 그 발화로 간다", async ({ page }) => {
    test.setTimeout(60_000);
    await openRail(page);
    await expect(page.getByText(/지금까지 \d+건/)).toBeVisible({ timeout: 20_000 });

    await page
      .getByRole("button", { name: /경로 데이터 저장소는 MongoDB를 사용한다/ })
      .click();
    const quote = page.getByRole("button", { name: /전사에서 보기|…/ }).first();
    await quote.click();

    // 근거 점프는 히스토리에 자리를 남긴다 — 각주를 따라간 것이지 탭을 고른 것이 아니다.
    await expect(page).toHaveURL(/tab=transcript/);
  });
});
