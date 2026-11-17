import { expect, test } from "@playwright/test";

const WORKSPACE_ID = "01K0000000000";

test("일시정지하면 마무리 중을 지나 재개로 바뀌고 독의 높이가 흔들리지 않는다", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.addInitScript(() =>
    window.localStorage.setItem("heymoa:mockStopDelayMs", "1500")
  );
  await page.goto(`/w/${WORKSPACE_ID}`);
  await page.getByRole("button", { name: "새 노트" }).click();
  await page.getByLabel("회의 이름").fill("일시정지 전환 확인");
  await page.getByRole("button", { name: "만들기" }).click();
  await page.waitForURL(new RegExp(`/w/${WORKSPACE_ID}/notes/[^?]+\\?view=full`));

  const dock = page.getByLabel("녹음 제어");
  await dock.getByRole("button", { name: "회의 시작" }).click();
  const stop = dock.getByRole("button", { name: "일시정지" });
  await expect(stop).toBeVisible({ timeout: 20_000 });

  const height = async () => (await dock.boundingBox())!.height;
  const before = await height();
  await stop.click();

  await expect(dock.getByText("녹음 마무리 중")).toBeAttached();
  await expect(stop).toHaveCount(0);
  expect(await height()).toBeCloseTo(before, 0);

  await expect(dock.getByRole("button", { name: "재개" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(dock.getByText("녹음 마무리 중")).toHaveCount(0);
  expect(await height()).toBeCloseTo(before, 0);
});
