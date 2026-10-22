import { expect, test, type Page } from "@playwright/test";

/**
 * 설정 > 계정 > 알림 (APP-1341). 목 서버는 이 문서 안에서 설정을 들고 있어 창을 닫았다 다시 열면 서버 값이 다시 그려진다.
 * 새로고침은 목 서버 상태를 지우므로(브라우저 안 MSW) 「새로고침 뒤 유지」는 운영 server 가 맡는다.
 */
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

  const mail = page.getByRole("switch", { name: "중지된 회의 메일" });
  await expect(mail).toBeChecked();
  await mail.click();
  await expect(mail).not.toBeChecked();

  // 다른 탭에 갔다 오면 서버 값을 다시 읽는다
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
  // 메일을 보내는 선택 종류(중지된 회의·문의 답변)의 메일 열이 가려진다.
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
    page.getByRole("switch", { name: "중지된 회의 메일" })
  ).toBeVisible();
});
