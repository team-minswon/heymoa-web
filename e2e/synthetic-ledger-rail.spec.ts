import { expect, test } from "@playwright/test";

import ledger from "../lib/notes/proposals/__fixtures__/synthetic-ledger-snapshot.json";

const WORKSPACE_ID = "01K0000000000";
const NOTE_ID = "01K0000000007";

const ITEMS = ledger.proposals.filter((c) => c.kind !== "AGENDA");
const CANDIDATE_COUNT = ITEMS.length;

test.describe("server 적재 원장 — 화면", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full&tab=context`);
  });

  test("원장 후보가 빠짐없이 그려진다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByRole("button", { name: `전체 ${CANDIDATE_COUNT}` })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByText(ledger.proposals[0].content).first()).toBeVisible();
    await expect(
      page.getByText(ledger.proposals[ledger.proposals.length - 1].content).first()
    ).toBeVisible();
  });

  test("개정된 결정은 최신 값 하나로만 선다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByRole("button", { name: `전체 ${CANDIDATE_COUNT}` })).toBeVisible({
      timeout: 30_000,
    });

    const amended = ledger.proposals.find((c) => c.revision > 1);
    expect(amended, "픽스처에 개정된 후보가 없으면 이 검사는 의미가 없다").toBeTruthy();
    await expect(page.getByText(amended!.content)).toHaveCount(1);
  });

  test("닫힌 후보가 열린 것과 구분된다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByRole("button", { name: `전체 ${CANDIDATE_COUNT}` })).toBeVisible({
      timeout: 30_000,
    });

    const retracted = ledger.proposals.filter(
      (c) => c.closeReason === "RETRACTED"
    ).length;
    await expect(page.getByText("철회됨")).toHaveCount(retracted);
  });

  test("부분 반영·포화 안내를 스크립트에 표시하지 않는다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByRole("button", { name: `전체 ${CANDIDATE_COUNT}` })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("tab", { name: "스크립트" }).click();
    await expect(page.getByRole("log", { name: "회의 스크립트" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("이 구간에 항목이 더 있을 수 있어요")).toHaveCount(0);
  });

  test("근거를 펼쳐 출처를 따라갈 수 있다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByRole("button", { name: `전체 ${CANDIDATE_COUNT}` })).toBeVisible({
      timeout: 30_000,
    });

    await page
      .getByRole("button", { name: new RegExp(escape(ITEMS[0].content)) })
      .first()
      .click();
    await expect(
      page.locator('[id^="timeline-item-"][id$="-details"] button').first()
    ).toBeVisible();
  });
});

function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
