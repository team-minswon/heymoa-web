import { expect, test } from "@playwright/test";

const WORKSPACE_ID = "01K0000000000";
const NOTE_ID = "01K0000000005";

const FAILING_NOTE_ID = "01K0000000006";

const timelineUrl = `/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full&tab=context`;

const allChip = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /^전체 \d+$/ });

async function openTimeline(page: import("@playwright/test").Page) {
  await page.goto(timelineUrl);
  await expect(allChip(page)).toBeVisible({ timeout: 20_000 });
}

test.describe("실시간 정리 타임라인", () => {
  test("REST 스냅샷만으로 후보가 안건 아래 시간순으로 그려진다", async ({ page }) => {
    test.setTimeout(60_000);
    await openTimeline(page);

    await expect(
      page.getByText("경로 데이터 저장소는 MongoDB를 사용한다")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /다음 스프린트 범위/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^스크립트 \d+:\d\d로 가기$/ }).first()
    ).toBeVisible();
  });

  test("철회와 답한 질문이 서로 다르게 보인다", async ({ page }) => {
    test.setTimeout(60_000);
    await openTimeline(page);

    await expect(page.getByText("철회됨").first()).toBeVisible();
    await expect(page.getByText(/에 답함$/).first()).toBeVisible();
  });

  test("새로고침해도 원장이 남는다 — 이벤트가 아니라 스냅샷이 정본이다", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openTimeline(page);
    const before = await allChip(page).getAttribute("aria-label");

    await page.reload();

    await expect(allChip(page)).toBeVisible({ timeout: 20_000 });
    const after = await allChip(page).getAttribute("aria-label");
    expect(after).toBe(before);
    expect(after).not.toBe("전체 0");
  });

  test("분석이 실패해도 스크립트와 회의 종료가 계속된다", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(
      `/w/${WORKSPACE_ID}/notes/${FAILING_NOTE_ID}?view=full&tab=transcript`
    );

    await page.getByRole("tab", { name: /^타임라인/ }).click();
    await expect(page.getByText(/불러오지 못했습니다/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/아직 정리할 발화가 없습니다/)).toHaveCount(0);

    await page.getByRole("tab", { name: "스크립트" }).click();
    await expect(page.getByRole("log", { name: "회의 스크립트" })).toBeVisible();

    const endMeeting = page.getByRole("button", { name: "회의 종료" });
    const noteMenu = page.getByRole("button", { name: /노트 메뉴|더보기/ });
    expect(
      (await endMeeting.count()) + (await noteMenu.count())
    ).toBeGreaterThan(0);
  });

  test("근거를 눌러 스크립트의 그 발화로 간다", async ({ page }) => {
    test.setTimeout(60_000);
    await openTimeline(page);

    await page
      .getByRole("button", { name: /경로 데이터 저장소는 MongoDB를 사용한다/ })
      .click();
    await page.locator('[id^="timeline-item-"][id$="-details"] button').first().click();

    await expect(page).toHaveURL(/tab=transcript/);
  });
});
