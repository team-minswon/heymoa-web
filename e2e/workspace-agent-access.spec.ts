import { expect, test } from "@playwright/test";

/**
 * 설정 › 워크스페이스 › MCP 관리(APP-941). 목 유저는 시드 워크스페이스의 ADMIN 이자 그 워크스페이스에
 * 연결을 맡긴 팀원이라, 한 사람이 끄고 나서 자기 연결이 왜 끊겼는지 본다. 목 DB 는 페이지 모듈 상태라
 * 문서를 다시 읽지 않고 클라이언트 조작만 한다. 역할별 표시·취소는 컴포넌트 시험이 본다.
 */

const MOCK_WORKSPACE_ID = "01K0000000000";
const SHOTS = process.env.E2E_SHOTS_DIR;

test("ADMIN 이 외부 에이전트를 끄면 열린 연결이 비고, 내 지난 연결에 차단 사유가 보이며 새 연결이 막힌다", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "워크스페이스 전환" }).click();
  await page.getByRole("menuitem", { name: "워크스페이스 설정" }).click();
  await page
    .getByRole("group", { name: "워크스페이스" })
    .getByRole("button", { name: "MCP 관리" })
    .click();

  // 시드: 내 개인 토큰 연결 하나와 다른 멤버의 OAuth 연결 하나가 살아 있다
  const open = page.getByRole("region", { name: "열린 연결" });
  await expect(open.getByRole("listitem")).toHaveCount(2);
  await expect(open).toContainText("한지원");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/workspace-agents.png` });

  await page.getByRole("switch", { name: "MCP 연결 허용" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("지금 연결된 2개가 모두 끊기고");
  if (SHOTS)
    await page.screenshot({ path: `${SHOTS}/workspace-agents-off.png` });
  await confirm.getByRole("button", { name: "끄기" }).click();

  await expect(open.getByText("열린 연결이 없습니다.")).toBeVisible();
  await expect(
    page.getByText("꺼짐 — 새 연결을 만들 수 없습니다.")
  ).toBeVisible();

  await page
    .getByRole("group", { name: "계정" })
    .getByRole("button", { name: "내 MCP 연결" })
    .click();
  // 시드의 지난 연결 둘에 방금 끊긴 내 연결이 더해진다
  await page.getByRole("button", { name: "지난 연결 3개" }).click();
  await expect(
    page
      .getByRole("list", { name: "지난 연결" })
      .getByRole("listitem")
      .filter({ hasText: "노트북 Claude Code" })
  ).toContainText("워크스페이스에서 MCP 연결을 막아 끊겼습니다.");

  await page.getByRole("button", { name: "새 연결" }).click();
  await page.getByRole("button", { name: "개인 토큰 만들기" }).click();
  await page.getByLabel("연결 이름").fill("막힌 워크스페이스로");
  await expect(
    page.getByText(
      "관리자가 이 워크스페이스의 MCP 연결을 꺼 두었습니다."
    )
  ).toBeVisible();
  await expect(page.getByLabel("맡길 워크스페이스")).toContainText(
    "(MCP 꺼짐)"
  );
  await expect(
    page.getByRole("button", { name: "토큰 만들기" })
  ).toBeDisabled();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/agent-blocked.png` });
});
