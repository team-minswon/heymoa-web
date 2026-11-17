import { expect, test, type Page } from "@playwright/test";

const NOTE_URL = "/w/01K0000000000/notes/01K0000000920?view=full&tab=summary";

async function openShareMail(page: Page) {
  await page.goto(NOTE_URL);
  await expect(page.getByText("검토 중", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "내보내기·공유" }).click();
  await page.getByRole("menuitem", { name: "이메일로 보내기" }).click();
  const dialog = page.getByRole("dialog", { name: "회의록 보내기" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("주소를 치고 후보에서 골라 녹취록을 붙여 보낸다", async ({ page }) => {
  const dialog = await openShareMail(page);
  const input = dialog.getByRole("combobox", { name: "받는 사람" });

  await input.fill("partner@client.co.kr");
  await input.press("Enter");
  await expect(dialog.getByRole("button", { name: "partner@client.co.kr 빼기" })).toBeVisible();

  await input.fill("지원");
  await dialog.getByRole("option", { name: /한지원/ }).click();
  await expect(dialog.getByRole("button", { name: "한지원 빼기" })).toBeVisible();

  const transcript = dialog.getByRole("switch", { name: "녹취록" });
  await transcript.click();
  await expect(transcript).toHaveAttribute("aria-checked", "true");

  await dialog.getByRole("button", { name: "2명에게 보내기" }).click();
  const results = dialog.getByRole("list", { name: "받는 사람별 결과" });
  await expect(results).toBeVisible({ timeout: 15_000 });
  await expect(results.getByText("보냄")).toHaveCount(2, { timeout: 10_000 });
  await dialog.locator('[data-slot="dialog-footer"]').getByRole("button", { name: "닫기" }).click();
  await expect(dialog).toBeHidden();
});

test("서버가 받는 사람을 거절하면 문구를 띄우고 입력을 그대로 둔다", async ({ page }) => {
  const dialog = await openShareMail(page);
  const input = dialog.getByRole("combobox", { name: "받는 사람" });

  await input.fill("someone@bounce.invalid,");
  await dialog.getByRole("button", { name: "1명에게 보내기" }).click();

  await expect(page.getByText("받는 사람 이메일 주소를 확인해 주세요.")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "someone@bounce.invalid 빼기" })).toBeVisible();
  await expect(input).toHaveAttribute("aria-invalid", "true");
});

test("보내고 바로 창을 닫아도 보내지 못한 주소는 토스트로 알린다", async ({ page }) => {
  const dialog = await openShareMail(page);
  const input = dialog.getByRole("combobox", { name: "받는 사람" });

  await input.fill("nobody@reject.test,");
  await dialog.getByRole("button", { name: "1명에게 보내기" }).click();
  await expect(dialog.locator('[data-slot="dialog-footer"]').getByRole("button", { name: "닫기" })).toBeVisible({ timeout: 15_000 });
  await dialog.locator('[data-slot="dialog-footer"]').getByRole("button", { name: "닫기" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText("회의록 메일을 1명에게 보내지 못했습니다.")).toBeVisible({ timeout: 10_000 });
});
