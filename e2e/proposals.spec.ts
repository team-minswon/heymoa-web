import { expect, test } from "@playwright/test";

/**
 * 맥락 후보 레일 — **MSW 목 대상**.
 *
 * 같은 세 시나리오의 **실서버 판**은 `integration-proposals.spec.ts`에 있고, APP-459가
 * 배포되면 그쪽이 초록이 된다. 이 파일은 **계약과 무관하게 화면이 옳은지**를 지킨다 —
 * 서버가 늦어도 UI 회귀는 여기서 잡힌다.
 *
 * 목 시나리오는 `lib/mocks/proposals.ts`가 정하고, 후보 피드는 전용 노트
 * (`CONTEXT_DEMO_NOTE_ID`)에서만 흐른다. 다른 노트에 흘리면 공유 챗의 30초 안전 폴링이
 * 굶는다 — 실제로 그렇게 e2e 하나가 깨졌다.
 */

const WORKSPACE_ID = "01K0000000000";
/** `CONTEXT_DEMO_NOTE_ID`. 목이 이 노트에만 후보를 흘린다. */
const NOTE_ID = "01K0000000005";

/** `CONTEXT_FAILING_NOTE_ID`. 후보 조회가 500 을 내는 노트다. */
const FAILING_NOTE_ID = "01K0000000006";

const timelineUrl = `/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full&tab=context`;

/** 「전체」 칩의 접근성 이름에 센 개수가 든다. 첫 snapshot 이 서기 전에는 개수가 없다. */
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

    // 스냅샷이 정본이다 — WS 이벤트가 하나도 안 와도 화면이 선다.
    await expect(
      page.getByText("경로 데이터 저장소는 MongoDB를 사용한다")
    ).toBeVisible();
    // 안건이 머리로 선다.
    await expect(
      page.getByRole("button", { name: /다음 스프린트 범위/ })
    ).toBeVisible();
    // 근거 시각이 왼쪽 열에 회의 축으로 찍히고, 누르면 스크립트로 간다.
    await expect(
      page.getByRole("button", { name: /^스크립트 \d+:\d\d로 가기$/ }).first()
    ).toBeVisible();
  });

  test("철회와 답한 질문이 서로 다르게 보인다", async ({ page }) => {
    test.setTimeout(60_000);
    await openTimeline(page);

    // 철회는 취소이고 해결은 성취다. 같은 흐림으로 그리면 안 된다.
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
    // spec 「완료 판단」의 마지막 줄이다. 후보 조회가 죽어도 **회의를 계속할 수 있어야**
    // 한다 — 실시간 정리는 부가 표면이지 회의의 전제가 아니다.
    await page.goto(
      `/w/${WORKSPACE_ID}/notes/${FAILING_NOTE_ID}?view=full&tab=transcript`
    );

    await page.getByRole("tab", { name: /^타임라인/ }).click();
    // 실패는 실패로 그린다. 「항목 없음」으로 접으면 사용자가 0건을 사실로 믿는다.
    await expect(page.getByText(/불러오지 못했습니다/)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/아직 정리할 발화가 없습니다/)).toHaveCount(0);

    // **전사는 그대로 돈다.**
    await page.getByRole("tab", { name: "스크립트" }).click();
    await expect(page.getByRole("log", { name: "회의 스크립트" })).toBeVisible();

    // **회의 종료 경로도 살아 있다.** 이 노트가 기록 중이면 그 컨트롤이 있어야 한다.
    const endMeeting = page.getByRole("button", { name: "회의 종료" });
    const noteMenu = page.getByRole("button", { name: /노트 메뉴|더보기/ });
    expect(
      (await endMeeting.count()) + (await noteMenu.count())
    ).toBeGreaterThan(0);
  });

  test("근거를 눌러 스크립트의 그 발화로 간다", async ({ page }) => {
    test.setTimeout(60_000);
    await openTimeline(page);

    // 항목을 눌러 근거를 펼치고, 근거 행(시각 + 발화)을 눌러 점프한다.
    await page
      .getByRole("button", { name: /경로 데이터 저장소는 MongoDB를 사용한다/ })
      .click();
    await page.locator('[id^="timeline-item-"][id$="-details"] button').first().click();

    // 근거 점프는 히스토리에 자리를 남긴다 — 각주를 따라간 것이지 탭을 고른 것이 아니다.
    await expect(page).toHaveURL(/tab=transcript/);
  });
});
