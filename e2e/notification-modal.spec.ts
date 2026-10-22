import { expect, test } from "@playwright/test";

/**
 * 알림 모달(PRO-67 I09). 사이드바 첫 항목과 전체 화면 노트의 헤더가 같은 모달을 연다 — 전체 화면은 사이드바를 덮는다.
 */
const WS = "/w/01K0000000000";
const NOTE = `${WS}/notes/01K0000000002?view=full&tab=details`;

test("사이드바 「알림」이 모달을 열고 초대를 거절하려면 확인 창을 거친다", async ({
  page,
}) => {
  await page.goto(WS);
  const entry = page
    .getByRole("navigation", { name: "워크스페이스" })
    .getByRole("button", { name: /^알림/ });
  await expect(entry).toBeVisible();
  // 목 시드의 안 읽은 알림은 초대 하나와 검토 결과 둘이다.
  await expect(entry.getByLabel("안 읽은 알림 3개")).toBeVisible();
  await entry.click();

  const dialog = page.getByRole("dialog", { name: "알림" });
  await expect(dialog.getByText("모든 워크스페이스")).toBeVisible();
  await dialog.getByRole("button", { name: "거절" }).click();
  const confirm = page.getByRole("alertdialog", { name: "초대를 거절할까요?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "취소" }).click();
  await expect(confirm).toBeHidden();
  await expect(dialog.getByRole("button", { name: "수락" })).toBeVisible();

  await dialog.getByRole("tab", { name: "처리 필요" }).click();
  await expect(dialog.getByRole("button", { name: "수락" })).toBeVisible();
  await expect(dialog.getByText("수락함")).toBeHidden();
});

test("전체 화면 노트에서도 헤더 진입점으로 같은 모달이 열린다", async ({
  page,
}) => {
  await page.goto(NOTE);
  const open = page.getByRole("button", { name: /^알림 열기/ });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.getByRole("dialog", { name: "알림" })).toBeVisible();
});

test("검토할 결과 준비 행을 누르면 검토 화면으로 가고, 결과가 보이면 그 알림이 읽음이 된다", async ({
  page,
}) => {
  await page.goto(WS);
  const entry = page
    .getByRole("navigation", { name: "워크스페이스" })
    .getByRole("button", { name: /^알림/ });
  await expect(entry.getByLabel("안 읽은 알림 3개")).toBeVisible();
  await entry.click();
  const dialog = page.getByRole("dialog", { name: "알림" });
  await expect(
    dialog.getByText("마지막 중지 후 3영업일이 지나 자동으로 종료했습니다.")
  ).toBeVisible();
  // 검토 화면이 결과를 그리면 그 알림만 읽는다.
  const read = page.waitForRequest(
    (request) =>
      request.method() === "PUT" &&
      request.url().includes("/v1/notifications/01K0000000032/read")
  );
  await dialog
    .getByRole("button", { name: /정규멘토링\s?의 검토할 결과가 준비되었습니다/ })
    .click();
  await expect(page).toHaveURL(/tab=summary&source=notification/);
  await read;
  await page.getByRole("button", { name: "알림 목록으로 돌아가기" }).click();
  await expect(page.getByRole("dialog", { name: "알림" })).toBeVisible();
});
