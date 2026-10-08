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
  // 워크스페이스 쪽에도 같은 이름의 관리 항목이 있다(APP-941) — 계정 그룹으로 좁힌다
  await page
    .getByRole("group", { name: "계정" })
    .getByRole("button", { name: "외부 에이전트" })
    .click();
}

test("연결을 만들고 토큰을 닫으면 목록에는 앞자리만 남고 원문은 다시 나오지 않는다", async ({
  page,
}) => {
  await openAgentSettings(page);

  // 「새 연결」의 기본은 OAuth 안내다 — 개인 토큰은 안내의 링크로만 연다(APP-933)
  await page.getByRole("button", { name: "새 연결" }).click();
  await expect(
    page.getByRole("region", { name: "OAuth 연결 안내" })
  ).toBeVisible();
  await expect(page.getByLabel("연결 이름")).toHaveCount(0);
  await page.getByRole("button", { name: "개인 토큰 만들기" }).click();
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
  await expect(issued.getByText("http_headers", { exact: false })).toBeVisible();
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
  await page.getByRole("button", { name: "개인 토큰 만들기" }).click();
  await page.getByLabel("연결 이름").fill("회수할 연결");
  await page.getByRole("button", { name: "토큰 만들기" }).click();
  await page.getByRole("button", { name: "복사했습니다, 닫기" }).click();

  const row = page.getByRole("listitem").filter({ hasText: "회수할 연결" });
  await row.getByRole("button", { name: "회수" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "회수" })
    .click();

  // 회수한 연결은 위 목록에서 빠져 「지난 연결」로 접힌다(APP-828). 시드에 회수된 연결이 둘 있다
  await expect(row).toHaveCount(0);
  await page.getByRole("button", { name: "지난 연결 3개" }).click();
  const past = page
    .getByRole("list", { name: "지난 연결" })
    .getByRole("listitem")
    .filter({ hasText: "회수할 연결" });
  await expect(past).toContainText("회수됨");
  await expect(past).toContainText("직접 회수했습니다.");
  await expect(past.getByRole("button", { name: "회수" })).toHaveCount(0);

  // 시드의 「떠난 팀의 연결」은 OAuth 연결이다 — 토큰 앞자리 대신 종류와 끊긴 까닭이 보인다(APP-889)
  const oauth = page
    .getByRole("list", { name: "지난 연결" })
    .getByRole("listitem")
    .filter({ hasText: "떠난 팀의 연결" });
  await expect(oauth).toContainText("OAuth");
  await expect(oauth).toContainText("워크스페이스를 떠나 끊겼습니다.");
});

// APP-826. 시드의 「노트북 Claude Code」는 내역이 한 쪽(20)을 넘는다(24). 응답에는 시각·도구·건수·성공
// 여부만 있고 질문·답·인자·결과 본문은 어디에도 없다. 화면은 8개씩 보인다(APP-867) — 16 까지는 읽어
// 둔 쪽에서, 24 는 다음 쪽을 읽어서.
test("연결의 사용 내역을 펼치면 시각·도구·건수가 보이고 본문은 오지 않는다", async ({
  page,
}) => {
  await openAgentSettings(page);
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "노트북 Claude Code" })
    .first();

  const firstPage = page.waitForResponse((response) =>
    response.url().includes("/usages")
  );
  await row.getByRole("button", { name: "사용 내역" }).click();
  const body = await (await firstPage).json();

  const history = row.getByRole("region", { name: "사용 내역" });
  await expect(history.getByText("프로젝트 목록").first()).toBeVisible();
  await expect(history.getByText(/^\d+건$/).first()).toBeVisible();
  await expect(history.getByRole("listitem")).toHaveCount(8);
  for (const usage of body.data.usages) {
    expect(Object.keys(usage).sort()).toEqual([
      "occurredAt",
      "outcome",
      "resultCount",
      "toolName",
      "usageId",
    ]);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agent-usages.png` });

  await history.getByRole("button", { name: "더 보기" }).click();
  await expect(history.getByRole("listitem")).toHaveCount(16);
  await history.getByRole("button", { name: "더 보기" }).click();
  await expect(history.getByRole("listitem")).toHaveCount(24);
  await expect(history.getByRole("button", { name: "더 보기" })).toHaveCount(0);
});
