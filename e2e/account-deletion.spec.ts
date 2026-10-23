import { expect, test, type Page } from "@playwright/test";

/**
 * 탈퇴·워크스페이스 삭제·이름 확인 나가기 (PRO-69, APP-1383). 재로그인은 받지 않는다(2026-10-23 결정) — 입력만 맞으면 보낸다.
 * 탈퇴하면 홈으로 가고 거기서 완료 토스트가 한 번 뜬다(문서째 바뀌는 이동이라 jsdom 이 못 덮는다).
 */
// 주소로 바로 연다 — 메뉴로 열면 탭 주소 바꾸기가 늦게 끝나며 설정 본문을 다시 그려, 그 사이 연 확인 창이 사라진다(dev 컴파일 중).
async function openSettings(page: Page, section: string) {
  await page.goto(`/w/01K0000000000?settings=${section}`);
}

test("탈퇴는 「회원 탈퇴」 입력만으로 보내고 홈에서 완료 토스트를 띄운다", async ({
  page,
}) => {
  await openSettings(page, "account");
  await page.getByRole("button", { name: "계정 삭제" }).click();
  const dialog = page.getByRole("dialog", { name: "계정을 삭제할까요?" });
  await expect(
    dialog.getByText("테스트 유저의 워크스페이스", { exact: true })
  ).toBeVisible();
  await expect(
    dialog.getByRole("radio", { name: "관리자 넘기기" })
  ).toBeChecked();

  const submit = dialog.getByRole("button", { name: "탈퇴", exact: true });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel(/확인하려면/).fill("회원 탈퇴");

  const request = page.waitForRequest(
    (r) => r.method() === "DELETE" && r.url().endsWith("/v1/users/me")
  );
  await submit.click();
  expect((await request).postDataJSON()).toMatchObject({
    confirmation: "회원 탈퇴",
    workspaces: [
      {
        workspaceId: "01K0000000000",
        decision: "TRANSFER",
        successorUserId: "01K0000000020",
      },
    ],
  });
  await expect(page.getByText("계정을 삭제했습니다.")).toBeVisible();
  expect(new URL(page.url()).pathname).not.toMatch(/^\/w\//);
});

test("나가기는 워크스페이스 이름이 맞아야 켜지고 이름을 본문에 싣는다", async ({
  page,
}) => {
  await openSettings(page, "members");
  await page.getByRole("button", { name: "워크스페이스 나가기" }).click();
  const dialog = page.getByRole("alertdialog");
  const leave = dialog.getByRole("button", { name: "나가기" });
  await expect(leave).toBeDisabled();
  await dialog.getByLabel(/확인하려면/).fill("테스트 유저의 워크스페이스");

  const request = page.waitForRequest(
    (r) => r.method() === "DELETE" && r.url().endsWith("/members/me")
  );
  await leave.click();
  expect((await request).postDataJSON()).toEqual({
    workspaceName: "테스트 유저의 워크스페이스",
  });
});

test("관리자는 일반 탭에서 워크스페이스를 지우고 남은 워크스페이스로 간다", async ({
  page,
}) => {
  await openSettings(page, "workspace");
  await page.getByRole("button", { name: "워크스페이스 삭제" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel(/확인하려면/).fill("테스트 유저의 워크스페이스");
  await dialog.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page).toHaveURL(/\/w\/(?!01K0000000000)[0-9A-Z]{13}/);
});
