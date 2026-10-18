import { expect, test } from "@playwright/test";

/**
 * 용어 사전(APP-1189 · APP-1227). 목 DB 는 페이지 모듈 상태라 문서를 다시 읽지 않고 클라이언트 조작만 한다. 낙관적 갱신의
 * 경합·롤백은 `use-term-dictionary.test.tsx` 가 본다 — 여기서는 서비스 워커를 지나는 실제 왕복이 칩·미리보기·일괄 추가로
 * 이어지는지만 본다.
 */
const MOCK_WORKSPACE_ID = "01K0000000000";

test("설정에서 쉼표로 나눈 용어를 한 번에 더한다", async ({ page }) => {
  await page.goto(`/w/${MOCK_WORKSPACE_ID}`);
  await page.getByRole("button", { name: "워크스페이스 전환" }).click();
  await page.getByRole("menuitem", { name: "워크스페이스 설정" }).click();
  await page
    .getByRole("group", { name: "워크스페이스" })
    .getByRole("button", { name: "용어 사전" })
    .click();

  const input = page.getByRole("textbox", { name: "추가할 용어" });
  await input.fill("mcp, Soniox, kubernetes, k8s");
  await expect(page.getByText("새로 3개")).toBeVisible();
  await expect(page.getByText("이미 있어요 1개")).toBeVisible();
  await expect(page.getByRole("button", { name: "3개 추가" })).toBeEnabled();

  await input.press("Enter");
  const list = page.getByRole("list", { name: "넣은 용어" });
  await expect(list.getByText("Soniox")).toBeVisible();
  await expect(list.getByText("kubernetes")).toBeVisible();
  await expect(list.getByText("k8s")).toBeVisible();
  await expect(page.getByText("9 / 200")).toBeVisible();
  await expect(input).toHaveValue("");
});
