import { expect, test, type Page } from "@playwright/test";

const WS = "/w/01K0000000000";
const dialog = (page: Page) => page.getByRole("dialog", { name: "설정" });

test("알림 탭에서 바꾼 값이 다시 열어도 남고, 모두 끄기는 확인 창을 거친다", async ({
  page,
}) => {
  await page.goto(`${WS}?settings=notifications`);
  await expect(dialog(page)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "알림", exact: true })
  ).toHaveAttribute("aria-current", "page");

  const mail = page.getByRole("switch", { name: "일시정지된 회의 메일" });
  await expect(mail).toBeChecked();
  await mail.click();
  await expect(mail).not.toBeChecked();

  await page.getByRole("button", { name: "내 계정" }).click();
  await page.getByRole("button", { name: "알림", exact: true }).click();
  await expect(mail).not.toBeChecked();

  await page.getByRole("switch", { name: "메일 모두 끄기" }).click();
  const confirm = page.getByRole("alertdialog", {
    name: "메일을 모두 끌까요?",
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "끄기" }).click();
  await expect(confirm).toBeHidden();
  await expect(
    page.getByRole("switch", { name: "메일 모두 끄기" })
  ).toBeChecked();
  await expect(dialog(page).getByText("꺼짐")).toHaveCount(2);

  await page.getByRole("button", { name: "기본값으로 되돌리기" }).click();
  await page
    .getByRole("alertdialog", { name: "알림 설정을 기본값으로 되돌릴까요?" })
    .getByRole("button", { name: "되돌리기" })
    .click();
  await expect(
    page.getByRole("switch", { name: "메일 모두 끄기" })
  ).not.toBeChecked();
  await expect(mail).toBeChecked();
});

test("메일 푸터의 알림 설정 주소는 마지막 워크스페이스의 알림 탭을 연다", async ({
  page,
}) => {
  await page.goto("/settings/notifications");
  await expect(page).toHaveURL(/\/w\/[0-9A-Z]{13}\?settings=notifications$/);
  await expect(dialog(page)).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "일시정지된 회의 메일" })
  ).toBeVisible();
});
