import { expect, test } from "@playwright/test";

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
  await expect(page.getByText("중복 1개")).toBeVisible();
  await expect(page.getByRole("button", { name: "3개 추가" })).toBeEnabled();

  await input.press("Enter");
  const list = page.getByRole("list", { name: "넣은 용어" });
  await expect(list.getByText("Soniox")).toBeVisible();
  await expect(list.getByText("kubernetes")).toBeVisible();
  await expect(list.getByText("k8s")).toBeVisible();
  await expect(page.getByText("9 / 200")).toBeVisible();
  await expect(input).toHaveValue("");
});
