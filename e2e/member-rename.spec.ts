import { expect, test, type Page } from "@playwright/test";

async function openSettings(page: Page, section: string) {
  await page.goto("/w/01K0000000000");
  await page.getByRole("button", { name: /테스트 유저/ }).click();
  await page.getByRole("menuitem", { name: "내 계정 설정" }).click();
  await page.getByRole("button", { name: section }).first().click();
}

const rowsOf = (page: Page) => page.locator('[data-slot="dialog-content"] li');

test("멤버 이름을 대화상자로 바꾸면 행 높이는 그대로고 계정 이름이 보조 줄에 남는다", async ({ page }) => {
  await openSettings(page, "멤버");
  const row = rowsOf(page).filter({ hasText: "jiwon@heymoa.com" });
  await expect(row).not.toContainText("계정 이름");
  const before = (await row.boundingBox())!.height;

  await row.getByRole("button", { name: /관리$/ }).click();
  await page.getByRole("menuitem", { name: "이름 변경" }).click();
  const input = page.getByRole("textbox", { name: "이 워크스페이스에서 보일 이름" });
  await expect(input).toHaveAttribute("placeholder", "한지원");
  await input.fill("지원");
  await input.press("Enter");

  await expect(input).toHaveCount(0);
  await expect(row).toContainText("계정 이름 한지원");
  expect((await row.boundingBox())!.height).toBe(before);

  await row.getByRole("button", { name: /관리$/ }).click();
  await page.getByRole("menuitem", { name: "이름 변경" }).click();
  await input.fill("");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(row).toContainText("한지원");
  await expect(row).not.toContainText("계정 이름");
});

test("임시 참여자 이름을 대화상자로 바꿔도 행 높이가 그대로다", async ({ page }) => {
  await openSettings(page, "임시 참여자");
  const row = rowsOf(page).filter({ hasText: "박서준" });
  const before = (await row.boundingBox())!.height;

  await row.getByRole("button", { name: "박서준 관리" }).click();
  await page.getByRole("menuitem", { name: "이름 변경" }).click();
  expect((await row.boundingBox())!.height).toBe(before);
  const input = page.getByRole("textbox", { name: "이름" });
  await input.fill("박서준 멘토님");
  await page.getByRole("button", { name: "저장" }).click();

  const renamed = rowsOf(page).filter({ hasText: "박서준 멘토님" });
  await expect(renamed).toHaveCount(1);
  expect((await renamed.boundingBox())!.height).toBe(before);
});
