import { expect, test } from "@playwright/test";

/**
 * 용어 사전(APP-1189). 목 DB 는 페이지 모듈 상태라 문서를 다시 읽지 않고 클라이언트 조작만 한다. 낙관적 갱신의 경합·롤백은
 * `use-term-dictionary.test.tsx` 가 본다 — 여기서는 서비스 워커를 지나는 실제 왕복이 칩·중복 안내로 이어지는지만 본다.
 */
const MOCK_WORKSPACE_ID = "01K0000000000";

test("설정에서 워크스페이스 용어를 더하고, 프로젝트 창은 워크스페이스 용어를 입력하는 동안 막는다", async ({
  page,
}) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "워크스페이스 전환" }).click();
  await page.getByRole("menuitem", { name: "워크스페이스 설정" }).click();
  await page
    .getByRole("group", { name: "워크스페이스" })
    .getByRole("button", { name: "용어 사전" })
    .click();

  const input = page.getByRole("textbox", { name: "추가할 용어" });
  await input.fill("mcp");
  await expect(page.getByText("이미 있어요")).toBeVisible();
  await expect(page.getByRole("button", { name: "추가" })).toBeDisabled();

  await input.fill("Soniox");
  await input.press("Enter");
  const list = page.getByRole("list", { name: "넣은 용어" });
  await expect(list.getByText("Soniox")).toBeVisible();
  await expect(page.getByText("7 / 200")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: "주간 프로젝트 메뉴" })
    .click({ force: true });
  await page.getByRole("menuitem", { name: "용어 사전" }).click();
  await expect(page.getByText("워크스페이스 용어 7개도 함께 쓰여요")).toBeVisible();
  const projectInput = page.getByRole("textbox", { name: "추가할 용어" });
  await projectInput.fill("soniox");
  await expect(
    page.getByText("워크스페이스 용어 사전에 이미 있어요")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "추가" })).toBeDisabled();
  // 시드의 「핀볼」은 나중에 워크스페이스에도 생긴 용어다 — 지우지 않고 옅게 둔다
  await expect(page.getByText("1개는 워크스페이스 사전에도 있어요")).toBeVisible();
});
