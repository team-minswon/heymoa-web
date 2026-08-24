import { expect, test } from "@playwright/test";

import ledger from "../lib/notes/context-candidates/__fixtures__/synthetic-ledger-snapshot.json";

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
 * **기대값을 픽스처에서 유도합니다.** 같은 대본을 다시 흘리면 후보 개수도 kind 구성도
 * 달라지는 것이 실측으로 확인됐습니다. 개수를 박아 두면 픽스처를 재생성하는 순간 web
 * 결함과 무관하게 빨개지고, 그 빨강은 아무것도 안 알려 줍니다.
 *
 * 순수 함수 층의 같은 검증은
 * `lib/notes/context-candidates/synthetic-ledger-snapshot.test.ts` 에 있습니다.
 * 그쪽이 상태를, 이쪽이 화면을 봅니다.
 */

const WORKSPACE_ID = "01K0000000000";
/** `CONTEXT_SYNTHETIC_LEDGER_NOTE_ID`. 이 노트만 server 적재 원장을 싣는다. */
const NOTE_ID = "01K0000000007";

const CANDIDATE_COUNT = ledger.candidates.length;
/** 화면이 경고를 세워야 하는 구간 — 포화이거나 출력이 덜 실렸거나. */
const WARNED_RANGES = ledger.appliedRanges.filter(
  (r) =>
    r.rawDeltaSaturated ||
    r.semanticUnitSaturated ||
    r.applyStatus === "PARTIAL_RECORDED"
).length;

test.describe("server 적재 원장 — 화면", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/w/${WORKSPACE_ID}/notes/${NOTE_ID}?view=full`);
    await page.getByRole("tab", { name: "실시간 정리" }).click();
  });

  test("원장 후보가 빠짐없이 그려진다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByText(`지금까지 ${CANDIDATE_COUNT}건`)).toBeVisible({
      timeout: 30_000,
    });

    // **내용의 옳음을 주장하지 않는다** — 이 원장에는 `ACTION_ITEM` 을 `DECISION` 으로 낸
    // 오분류가 섞여 있다. 그것까지 「맞다」고 쓰면 테스트가 오분류를 정답으로 문서화하고,
    // 나중에 그게 고쳐질 때 수정을 막는다. 여기서 보는 것은 **후보가 화면에 닿는가**다.
    await expect(page.getByText(ledger.candidates[0].content)).toBeVisible();
    await expect(
      page.getByText(ledger.candidates[ledger.candidates.length - 1].content)
    ).toBeVisible();
  });

  /**
   * **개정이 카드를 늘리면 안 된다.** 이 원장에는 같은 값을 두 번 고쳐 revision 이 여러 번
   * 오른 후보가 있다. 개정마다 카드가 쌓이면 사용자가 폐기된 값을 현재 결정으로 읽는다.
   */
  test("개정된 결정은 최신 값 하나로만 선다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByText(`지금까지 ${CANDIDATE_COUNT}건`)).toBeVisible({
      timeout: 30_000,
    });

    const amended = ledger.candidates.find((c) => c.revision > 1);
    expect(amended, "픽스처에 개정된 후보가 없으면 이 검사는 의미가 없다").toBeTruthy();
    await expect(page.getByText(amended!.content)).toHaveCount(1);
  });

  test("닫힌 후보가 열린 것과 구분된다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByText(`지금까지 ${CANDIDATE_COUNT}건`)).toBeVisible({
      timeout: 30_000,
    });

    const retracted = ledger.candidates.filter(
      (c) => c.closeReason === "RETRACTED"
    ).length;
    await expect(page.getByText("철회됨")).toHaveCount(retracted);
  });

  /**
   * watermark 가 끝까지 전진하면 **범위만 보면 거의 다 찬다.** 그중 `PARTIAL_RECORDED` 는
   * 출력 일부가 기록되지 못한 구간이라, 「정리 완료」로 그리면 사용자는 빠진 게 없다고
   * 읽는다 — 빈 화면보다 나쁘다.
   *
   * **하나만 보이는지 세는 것으로는 부족하다.** 포화 flag 가 붙은 구간이 따로 있으면
   * `applyStatus` 를 안 봐도 한 줄은 뜬다. 그래서 개수로 센다.
   */
  test("덜 실린 구간이 전사에서 경고로 보인다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByText(`지금까지 ${CANDIDATE_COUNT}건`)).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("tab", { name: "전사" }).click();
    await expect(page.getByTestId("context-saturated")).toHaveCount(
      WARNED_RANGES,
      { timeout: 30_000 }
    );
  });

  test("근거를 펼쳐 출처를 따라갈 수 있다", async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.getByText(`지금까지 ${CANDIDATE_COUNT}건`)).toBeVisible({
      timeout: 30_000,
    });

    // 근거가 없는 카드는 사용자가 출처를 확인할 방법이 없다.
    await page
      .getByRole("button", { name: new RegExp(escape(ledger.candidates[0].content)) })
      .first()
      .click();
    await expect(page.getByText(/전사 \d+:\d\d/).first()).toBeVisible();
  });
});

/** 후보 내용은 서버가 낸 문장이라 정규식 메타문자가 들어 있을 수 있다. */
function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
