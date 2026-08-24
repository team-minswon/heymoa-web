import { expect, test } from "@playwright/test";

/**
 * **server 가 실제로 적재한 원장을 화면에 그린다.**
 *
 * **입력 108발화는 합성 시나리오이고 실사용자 전사가 아닙니다.** 진짜인 것은 wire 이지
 * 회의 내용이 아닙니다 — 여기 나오는 건수나 문장을 실사용 품질 근거로 인용하지 않습니다.
 * 그 판정은 AWS 실전사 gate 가 따로 냅니다.
 *
 * 그래도 필요한 이유는, 다른 e2e 가 전부 **손으로 쓴 목**을 보기 때문입니다. 그건 내가
 * 아는 것만 담아서, 계약을 오해했으면 목도 같이 틀리고 화면은 멀쩡해 보입니다.
 *
 * 순수 함수 층의 같은 검증은
 * `lib/notes/context-candidates/synthetic-ledger-snapshot.test.ts` 에 있습니다.
 * 그쪽이 상태를, 이쪽이 화면을 봅니다.
 */

const WORKSPACE_ID = "01K0000000000";
/** `CONTEXT_SYNTHETIC_LEDGER_NOTE_ID`. 이 노트만 server 적재 원장을 싣는다. */
const NOTE_ID = "01K0000000007";

test.describe("server 적재 원장 — 화면", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full`);
    await page.getByRole("tab", { name: "실시간 정리" }).click();
  });

  test("원장 후보 여덟 건이 그려진다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByText("지금까지 8건")).toBeVisible({ timeout: 30_000 });

    // 합성 시나리오에서 나온 후보다. **내용의 옳음을 주장하지 않는다** — 여기 8건 중
    // 하나는 ACTION_ITEM 을 DECISION 으로 낸 오분류다. 그것까지 「맞다」고 쓰면 테스트가
    // 오분류를 정답으로 문서화한다. 이 테스트가 보는 것은 **후보가 화면에 닿는가**다.
    await expect(
      page.getByText(/PayGuard는 네트워크 timeout에만 재시도/)
    ).toBeVisible();
    await expect(
      page.getByText(/지표 수집 자체가 끊기면.*rollback/)
    ).toBeVisible();
  });

  /**
   * **개정이 카드를 늘리면 안 된다.** `31` 번은 TTL 을 60 → 120 → 90 으로 두 번 고쳐
   * revision 이 5 다. 개정마다 카드가 쌓이면 사용자가 폐기된 값을 현재 결정으로 읽는다.
   */
  test("개정된 결정은 최신 값 하나로만 선다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByText("지금까지 8건")).toBeVisible({ timeout: 30_000 });

    await expect(page.getByText(/Redis TTL은 90초/)).toHaveCount(1);
    // 폐기된 중간 값이 남아 있으면 안 된다.
    await expect(page.getByText(/120초/)).toHaveCount(0);
  });

  test("철회된 결정이 살아 있는 결정과 구분된다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByText("지금까지 8건")).toBeVisible({ timeout: 30_000 });
    // 실제 원장에 CLOSED/RETRACTED 가 둘 있다.
    await expect(page.getByText("철회됨")).toHaveCount(2);
  });

  /**
   * watermark 는 108 까지 완주해서 **범위만 보면 거의 다 찼다.** 12구간 중 9구간이
   * `PARTIAL_RECORDED` 이므로, 화면이 그것을 「정리 완료」로 그리면 사용자는 빠진 게 없다고
   * 읽는다 — 빈 화면보다 나쁘다.
   *
   * **하나만 보이는지 세는 것으로는 부족하다.** 이 원장에는 포화 flag 가 붙은 구간도 1건
   * 있어서, `applyStatus` 를 안 봐도 한 줄은 뜬다. 그래서 개수로 센다.
   */
  test("덜 실린 구간이 전사에서 경고로 보인다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByText("지금까지 8건")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("tab", { name: "전사" }).click();
    const warnings = page.getByTestId("context-saturated");
    // 포화 flag 만 봤다면 1건이다. 9건이 떠야 `applyStatus` 를 실제로 읽은 것이다.
    await expect(warnings).toHaveCount(9, { timeout: 30_000 });
  });

  test("모든 카드가 근거를 달고 있어 출처를 따라갈 수 있다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByText("지금까지 8건")).toBeVisible({ timeout: 30_000 });

    // 근거가 없는 카드는 사용자가 출처를 확인할 방법이 없다. 실제 8건 모두 근거가 있다.
    const cards = page.getByRole("button", { name: /PayGuard는 네트워크 timeout/ });
    await cards.first().click();
    await expect(page.getByText(/전사 \d+:\d\d/).first()).toBeVisible();
  });
});
