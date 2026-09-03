import { expect, test } from "@playwright/test";

/**
 * ★★ **턴 스트림의 인수 조건 둘** (APP-551 spec §8).
 *
 * 1. 답이 흐르는 중에 화면이 떨어져 나가도 돌아오면 이어서 그려지고 `message_end`까지 온다
 * 2. 중지하면 `turn_cancelled` 뒤 컴포저가 풀리고, 부분 답이 **히스토리에** 남는다
 *
 * **새로고침으로는 못 잰다.** MSW 목의 상태가 페이지 힙에 살아서 새 문서면 대화 자체가
 * 사라진다. 그래서 「새로고침」의 자리는 둘로 흉내 낸다 — 1 은 패널 밖에서 시작해 스트림을
 * 끊은 턴을 패널이 처음 보는 것으로, 2 는 다른 대화에 들렀다 돌아와 히스토리를 다시 읽는
 * 것으로. 둘 다 화면이 든 로컬 상태가 아니라 서버(목)가 준 것으로 그린다.
 */

const MOCK_WORKSPACE_ID = "01K0000000000";

/** 「길게」 답의 마지막 문장. 여기까지 왔으면 `message_end`까지 온 것이다. */
const LAST_SENTENCE = "후속 회차가 필요하다는 점이 함께 언급됐습니다.";

test("resumes a mid-stream answer and draws it to message_end", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller !== null)
    )
    .toBe(true);

  // 패널 밖에서 턴을 열고, 스트림을 몇 프레임 받다 끊는다 — 새로고침이 하는 것과 같다.
  await page.evaluate(async (workspaceId) => {
    const created = await fetch(`/v1/workspaces/${workspaceId}/agent-chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    }).then((response) => response.json());
    const chatId = created.data.chatId as string;
    const { data } = await fetch(`/v1/agent-chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message: "길게 답해줘" }),
    }).then((response) => response.json());
    const stream = await fetch(
      `/v1/agent-chats/${chatId}/turns/${data.turnId}/events`,
      { credentials: "include" }
    );
    const reader = stream.body!.getReader();
    await reader.read();
    await reader.read();
    void reader.cancel();
  }, MOCK_WORKSPACE_ID);

  // 돌아온 화면. 방금 만든 대화가 목록 첫 줄이라 그대로 열리고, `activeTurn`으로 잇는다.
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();
  await expect(page.getByRole("button", { name: "중지" })).toBeVisible({
    timeout: 20_000,
  });

  // 이어서 그려지고 끝까지 온다 — 마지막 문장이 곧 `message_end.content` 의 끝이다.
  const answer = page.getByTestId("assistant-message").last();
  await expect(answer).toContainText(LAST_SENTENCE, { timeout: 60_000 });
  // 턴이 굳고 히스토리로 넘어가 컴포저가 열린다. 답은 한 벌이다.
  await expect(
    page.getByRole("button", { name: "보내기", exact: true })
  ).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByTestId("assistant-message")).toHaveCount(1);
});

test("stop cancels the turn and keeps the partial answer in history", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "개인 챗봇 열기" }).click();

  // 새 대화에서 긴 답을 받다가 중지한다.
  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("길게 답해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const answer = page.getByTestId("assistant-message").last();
  await expect(answer).toContainText("이번 회의에서는", { timeout: 20_000 });
  await page.getByRole("button", { name: "중지" }).click();

  // `turn_cancelled` 뒤 컴포저가 풀린다.
  const send = page.getByRole("button", { name: "보내기", exact: true });
  await expect(send).toBeEnabled({ timeout: 20_000 });
  // 끊긴 문장이 그대로 남고 두 벌이 아니다 — 「중지됨」 배지는 없다.
  await expect(page.getByTestId("assistant-message")).toHaveCount(1);
  await expect(answer).not.toContainText(LAST_SENTENCE);

  // 다른 대화에 들렀다 돌아온다 — 로컬 스트림은 비워지고 히스토리를 다시 읽는다.
  await page.getByRole("button", { name: "기록" }).click();
  const history = page.getByTestId("chat-history-view");
  const rows = history.getByRole("button").filter({ hasNotText: "뒤로가기" });
  await rows.filter({ hasNotText: "길게 답해줘" }).first().click();
  await page.getByRole("button", { name: "기록" }).click();
  await history.getByRole("button", { name: /길게 답해줘/ }).click();

  // 부분 답이 히스토리에 있다 — 서버가 취소를 정산하며 남긴 ASSISTANT 행이다.
  const restored = page.getByTestId("assistant-message").last();
  await expect(restored).toContainText("이번 회의에서는", { timeout: 20_000 });
  await expect(restored).not.toContainText(LAST_SENTENCE);
  await expect(page.getByTestId("assistant-message")).toHaveCount(1);
  await expect(send).toBeEnabled();
});
