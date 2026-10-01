import { expect, test, type Page } from "@playwright/test";

/**
 * 설정 › 외부 에이전트(APP-804). 토큰은 만든 응답에서 한 번만 보이고, 닫은 뒤 목록에는 앞자리만
 * 남는다. 목 DB 는 페이지 모듈 상태라 문서를 다시 읽지 않고 클라이언트 조작만 한다. 빈 상태는 목
 * 시드에 연결이 있어 컴포넌트 시험(`agent-connections-settings.test.tsx`)이 본다.
 */

const MOCK_WORKSPACE_ID = "01K0000000000";
const SHOTS = process.env.E2E_SHOTS_DIR;

async function openAgentSettings(page: Page) {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "워크스페이스 전환" }).click();
  await page.getByRole("menuitem", { name: "워크스페이스 설정" }).click();
  await page.getByRole("button", { name: "외부 에이전트" }).click();
}

test("연결을 만들고 토큰을 닫으면 목록에는 앞자리만 남고 원문은 다시 나오지 않는다", async ({
  page,
}) => {
  await openAgentSettings(page);

  await page.getByRole("button", { name: "새 연결" }).click();
  await page.getByLabel("연결 이름").fill("방금 만든 연결");
  await expect(
    page.getByText("아무것도 바꾸지 않습니다", { exact: false })
  ).toBeVisible();
  await page.getByRole("button", { name: "토큰 만들기" }).click();

  const issued = page.getByRole("region", { name: "새 토큰" });
  await expect(issued).toBeVisible();
  const token = (await issued.locator("pre").first().innerText()).trim();
  expect(token).toMatch(/^hm_/);
  await expect(issued.getByText("claude mcp add", { exact: false })).toBeVisible();
  await expect(issued.getByText("bearer_token_env_var", { exact: false })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agent-issued.png` });

  await page.getByRole("button", { name: "복사했습니다, 닫기" }).click();

  const row = page.getByRole("listitem").filter({ hasText: "방금 만든 연결" });
  await expect(row).toContainText(token.slice(0, 10));
  await expect(row).toContainText("연결됨");
  await expect(page.getByText(token)).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agent-list.png` });
});

test("회수하면 그 연결이 회수됨으로 바뀐다", async ({ page }) => {
  await openAgentSettings(page);
  await page.getByRole("button", { name: "새 연결" }).click();
  await page.getByLabel("연결 이름").fill("회수할 연결");
  await page.getByRole("button", { name: "토큰 만들기" }).click();
  await page.getByRole("button", { name: "복사했습니다, 닫기" }).click();

  const row = page.getByRole("listitem").filter({ hasText: "회수할 연결" });
  await row.getByRole("button", { name: "회수" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "회수" })
    .click();

  await expect(row).toContainText("회수됨");
  await expect(row.getByRole("button", { name: "회수" })).toHaveCount(0);
});
