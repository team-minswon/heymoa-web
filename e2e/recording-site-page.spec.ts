import { expect, test } from "@playwright/test";

const WORKSPACE_ID = "01K0000000000";

test("데스크톱 앱에서 녹음 중 사용 가이드를 누르면 이동하지 않고 안내한다", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.type());
    void dialog.dismiss();
  });

  await page.goto(`/w/${WORKSPACE_ID}`);
  await page.getByRole("button", { name: "새 노트" }).click();
  await page.getByLabel("회의 이름").fill("녹음 중 이동 확인");
  await page.getByRole("button", { name: "만들기" }).click();
  await page.waitForURL(new RegExp(`/w/${WORKSPACE_ID}/notes/[^?]+\\?view=full`));
  const notePath = new URL(page.url()).pathname;

  const dock = page.getByLabel("녹음 제어");
  await dock.getByRole("button", { name: "회의 시작" }).click();
  await expect(dock.getByRole("button", { name: "일시정지" })).toBeVisible({
    timeout: 20_000,
  });

  await page.evaluate(() => {
    (window as unknown as { heymoaDesktop: object }).heymoaDesktop = {};
  });
  await page.getByRole("button", { name: "사용 가이드" }).dispatchEvent("click");

  await expect(page.getByText("녹음 중에는 앱에서 다른 페이지를 열 수 없습니다")).toBeVisible();
  expect(dialogs).toEqual([]);
  expect(new URL(page.url()).pathname).toBe(notePath);
  await expect(dock.getByRole("button", { name: "일시정지" })).toBeVisible();
});
