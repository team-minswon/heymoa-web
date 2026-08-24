import { expect, test } from "@playwright/test";

/**
 * **살아 있는 발화가 두 토막으로 보이는지.**
 *
 * 이 파일이 생기기 전까지 **브라우저 경로는 final 만 지났습니다.** partial 렌더는 jsdom
 * 컴포넌트 테스트로만 덮여 있어서, 서버가 옛 partial 모양(누적 `text` 한 덩어리)을 보내도
 * 어느 e2e 도 안 깨졌습니다.
 *
 * 그 경우 증상은 「연결이 죽었다」가 아닙니다. web 은 `z.strictObject` 로 파싱하다 던지고
 * 그 예외를 `note-topic-client` 가 삼키므로, **받아쓰기가 통째로 안 보이는 채 화면도
 * 콘솔도 조용합니다.** final 은 계속 오니 발화가 끝날 때마다 한 덩어리로 툭툭 나타납니다.
 *
 * 그래서 여기서 보는 것은 「전사가 보이는가」가 아니라 **「미확정 토막이 실제로 도착해
 * 그려지는가」**입니다.
 *
 * 프레임은 `lib/mocks/context-candidates.ts`의 `LIVE_UTTERANCE`가 정하고
 * `lib/mocks/websocket-handler.ts`가 전용 노트에만 흘립니다.
 */

const WORKSPACE_ID = "01K0000000000";
/** `CONTEXT_DEMO_NOTE_ID`. 목이 이 노트에만 실시간 프레임을 흘린다. */
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

    // **미확정 토막이 뜬다는 것이 partial 프레임을 실제로 파싱했다는 증거다.**
    // 옛 모양이면 파싱이 던지고 이 자리는 영영 비어 있는다.
    await expect(pending).toBeVisible({ timeout: 30_000 });

    // 확정 행의 기준선을 여기서 잡는다. **partial 이 뜬 뒤**라 REST 전사는 이미 그려졌고,
    // final 은 아직 안 왔다. `transcript-block` 은 확정 행에만 붙고 살아 있는 행에는
    // 안 붙으므로 partial 이 이 수를 흔들지 않는다.
    const before = await blocks.count();

    // **둘이 동시에 보여야 한다.** 서버가 두 토막을 이어 붙인 문자열 하나로 보내면 확정
    // 토막이 안 생겨서 이 단언이 깨진다 — 그게 이 테스트의 존재 이유다.
    await expect(confirmed).toBeVisible({ timeout: 30_000 });
    await expect(confirmed).toHaveText(CONFIRMED);
    await expect(pending).toHaveText(new RegExp(PENDING));

    // 같은 utteranceId 의 final 이 오면 살아 있던 토막은 사라진다. 안 그러면 확정된 발화가
    // 흐린 채로 화면에 남아 사용자가 계속 기다린다.
    await expect(confirmed).toHaveCount(0, { timeout: 30_000 });
    await expect(pending).toHaveCount(0);

    // **소멸만 보면 부족하다.** final 이 파싱돼 partial 을 걷었는데 확정 행 렌더가 깨지면
    // 위 두 단언은 그대로 통과한다 — 화면에서는 방금 한 말이 통째로 사라진 것으로 보인다.
    // 그래서 **행이 정확히 하나 늘었는지**를 센다.
    //
    // 문장으로 확인하지 않는다. 같은 문장이 시드에도 있어 `getByText` 는 어느 쪽을 짚었는지
    // 구분하지 못한다 — 세는 것이 유일하게 갈리는 증거다.
    await expect(blocks).toHaveCount(before + 1, { timeout: 30_000 });
  });
});
