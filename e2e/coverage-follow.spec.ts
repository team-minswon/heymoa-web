import { expect, test } from "@playwright/test";

/**
 * **커버리지 행이 «교체»될 때도 바닥 추종이 유지되는지.**
 *
 * 앞선 수정은 커버리지 행이 **늘 때**를 고쳤습니다. 그런데 한 행이 다른 행으로 바뀌는
 * 전이가 있습니다 — 구멍이 채워지면서 그 범위가 포화로 들어오면 **행 수는 그대로인데
 * 종류가 바뀝니다.** 개수만 세는 추종 키는 그 순간을 못 봅니다.
 *
 * ```
 * 처음     범위 1..8 · 17..24     구멍 9..16 하나      행 1
 * batch    9..16(포화)가 채움      구멍 0 · 포화 1     행 1   ← 개수 같음
 * ```
 *
 * 두 행은 높이가 다릅니다 — 구멍 행에는 「전사는 계속 기록됩니다」 같은 안내가 한 줄 더
 * 붙습니다(`context-coverage-row.tsx`). 그래서 추종하던 독자가 그 차이만큼 바닥에서
 * 밀린 채 남고, **scroll 이벤트가 안 나서 「맨 아래로」 버튼조차 안 뜹니다.**
 *
 * jsdom 으로는 못 잡습니다 — 높이가 0 이라 추종이 성립하는지 자체를 볼 수 없습니다.
 */

const WORKSPACE_ID = "01K0000000000";
/** `CONTEXT_SWAP_NOTE_ID`. 목이 이 노트에만 치환 batch 를 흘린다. */
const NOTE_ID = "01K0000000008";

test("커버리지 행이 교체돼도 바닥 추종이 끊기지 않는다", async ({ page }) => {
  test.setTimeout(90_000);
  // 전사 40줄은 목 DB 가 시드한다. **응답 가로채기로는 안 된다** — 첫 화면이 SSR
  // prefetch 로 오므로 `window.fetch` 를 덮어도 그 판에는 안 닿는다.
  await page.goto(
    `/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full&tab=transcript`
  );

  const log = page.getByRole("log", { name: "회의 전사" });
  await expect(log).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("transcript-block").first()).toBeVisible();

  // 처음에는 구멍 행 하나만 있다.
  await expect(page.getByTestId("context-coverage-gap")).toHaveCount(1, {
    timeout: 30_000,
  });
  await expect(page.getByTestId("context-saturated")).toHaveCount(0);

  const viewport = page
    .locator('[data-slot="scroll-area"]')
    .filter({ has: log })
    .locator('[data-slot="scroll-area-viewport"]');
  const residue = () =>
    viewport.evaluate(
      (element) =>
        element.scrollHeight - element.scrollTop - element.clientHeight
    );

  // 실제로 스크롤이 생겼는지 먼저 본다 — 안 넘치면 이 테스트가 아무것도 안 지킨다.
  const metrics = await viewport.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(metrics.scrollHeight - metrics.clientHeight).toBeGreaterThan(0);
  await expect.poll(residue).toBeLessThanOrEqual(32);

  // batch 가 구멍을 포화로 채운다. **행 수는 1로 유지된다.**
  await expect(page.getByTestId("context-saturated")).toHaveCount(1, {
    timeout: 30_000,
  });
  await expect(page.getByTestId("context-coverage-gap")).toHaveCount(0);

  // 교체 뒤에도 바닥에 붙어 있어야 한다. 한 줄 이내면 추종이고, 끊기면 그 높이 차만큼 남는다.
  await expect.poll(residue).toBeLessThanOrEqual(32);
});
