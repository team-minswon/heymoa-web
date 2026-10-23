import { expect, test } from "@playwright/test";

/**
 * 데스크톱 앱에서 녹음 중에 사이트 페이지(사용 가이드 등)를 누르면 (APP-1279 후속).
 *
 * 마케팅 면이 다른 루트 레이아웃(`app/[lang]`)이 되면서 제품 면 → 사이트 페이지는 전체 로드다. 녹음이 화면을
 * 붙잡는 beforeunload 가 그 이동을 막고, 앱(Electron)은 아무 안내 없이 이동을 취소한다 — 링크가 죽은 것처럼
 * 보인다. 이동하지 않고 녹음을 지키되 왜 안 열리는지 알린다.
 */
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

  // 앱 안인지는 이 브리지로 가른다(`desktopAuthBridge`). 녹음은 웹 마이크로 시작한 뒤에 붙인다 —
  // 처음부터 붙이면 캡처 함수가 없어 녹음이 안 선다. 「사용 가이드」는 누를 때 브리지를 본다.
  await page.evaluate(() => {
    (window as unknown as { heymoaDesktop: object }).heymoaDesktop = {};
  });
  // 전체 화면 노트가 사이드바를 덮으므로 클릭 이벤트를 직접 보낸다.
  await page.getByRole("button", { name: "사용 가이드" }).dispatchEvent("click");

  await expect(page.getByText("녹음 중에는 앱에서 다른 페이지를 열 수 없습니다")).toBeVisible();
  expect(dialogs).toEqual([]);
  expect(new URL(page.url()).pathname).toBe(notePath);
  await expect(dock.getByRole("button", { name: "일시정지" })).toBeVisible();
});
