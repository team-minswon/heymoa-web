import { expect, test } from "@playwright/test";

const WORKSPACE_ID = "01K0000000000";
const NOTE_ID = "01K0000000005";

const CONFIRMED = "다음 주까지";
const PENDING = "사용자 테스트를 진행합니다.";

test.describe("살아 있는 발화", () => {
  test("확정과 미확정이 동시에 보이고 final이 오면 둘 다 걷힌다", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto(`/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full&tab=transcript`);

    const confirmed = page.getByTestId("partial-confirmed");
    const pending = page.getByTestId("partial-pending");
    const blocks = page.getByTestId("transcript-block");

    await expect(pending).toBeVisible({ timeout: 30_000 });

    const before = await blocks.count();

    await expect(confirmed).toBeVisible({ timeout: 30_000 });
    await expect(confirmed).toHaveText(CONFIRMED);
    await expect(pending).toHaveText(new RegExp(PENDING));

    await expect(confirmed).toHaveCount(0, { timeout: 30_000 });
    await expect(pending).toHaveCount(0);

    await expect(blocks).toHaveCount(before + 1, { timeout: 30_000 });
  });
});
