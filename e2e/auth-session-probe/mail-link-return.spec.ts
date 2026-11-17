import { expect, test } from "@playwright/test";

const NOTE_PATH = "/w/01K0000000000/notes/01K0000000040";
const MAIL_QUERY =
  "view=full&tab=transcript&utm_source=heymoa&utm_medium=email&utm_campaign=meeting_paused_reminder";

test("로그인 안 한 채 연 메일 링크는 로그인 카드를 세우고 주소를 그대로 둔다", async ({
  page,
}) => {
  await page.route("**/v1/auth/session", (route) =>
    route.fulfill({
      json: { success: true, data: { state: "anonymous" }, error: null },
    })
  );
  await page.goto(`${NOTE_PATH}?${MAIL_QUERY}`);
  await expect(
    page.getByRole("heading", { name: "로그인하면 이 화면으로 돌아옵니다" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Google로 로그인" })
  ).toBeVisible();
  await expect(page).toHaveURL(`${NOTE_PATH}?${MAIL_QUERY}`);
});
