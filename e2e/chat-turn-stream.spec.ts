import { expect, test } from "@playwright/test";

const MOCK_WORKSPACE_ID = "01K0000000000";

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

  await page.getByRole("button", { name: "내 에이전트 열기" }).click();
  await expect(
    page.getByRole("button", { name: "중지", exact: true })
  ).toBeVisible({
    timeout: 20_000,
  });

  const answer = page.getByTestId("assistant-message").last();
  await expect(answer).toContainText(LAST_SENTENCE, { timeout: 60_000 });
  await expect(
    page.getByRole("button", { name: "보내기", exact: true })
  ).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByTestId("assistant-message")).toHaveCount(1);
});

test("stop cancels the turn and keeps the partial answer in history", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "내 에이전트 열기" }).click();

  await page.getByTestId("chat-list-new").click();
  await page.getByLabel("메시지").fill("길게 답해줘");
  await page.getByRole("button", { name: "보내기", exact: true }).click();

  const answer = page.getByTestId("assistant-message").last();
  await expect(answer).toContainText("이번 회의에서는", { timeout: 20_000 });
  await page.getByRole("button", { name: "중지", exact: true }).click();

  const send = page.getByRole("button", { name: "보내기", exact: true });
  await expect(send).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByTestId("assistant-message")).toHaveCount(1);
  await expect(answer).not.toContainText(LAST_SENTENCE);

  await page.getByRole("button", { name: "대화 기록" }).click();
  const history = page.getByTestId("chat-history-view");
  const rows = history.getByRole("button").filter({ hasText: /\S/ });
  await rows.filter({ hasNotText: "길게 답해줘" }).first().click();
  await page.getByRole("button", { name: "대화 기록" }).click();
  await history.getByRole("button", { name: /^길게 답해줘(?! 메뉴)/ }).click();

  const restored = page.getByTestId("assistant-message").last();
  await expect(restored).toContainText("이번 회의에서는", { timeout: 20_000 });
  await expect(restored).not.toContainText(LAST_SENTENCE);
  await expect(page.getByTestId("assistant-message")).toHaveCount(1);
  await expect(send).toBeEnabled();
});
