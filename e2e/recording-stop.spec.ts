import { expect, test } from "@playwright/test";

/**
 * 회의를 일시정지하면 「마무리 중」 상태를 지나 「재개」로 넘어간다 (APP-1246).
 *
 * 실서버는 남은 소리 저장과 업체의 마지막 확정을 기다려 수 초 뒤에 끝낸다. 목은 기본으로 즉시 끝내서
 * 이 구간이 안 보이므로 `localStorage["heymoa:mockStopDelayMs"]` 로 늘려 그 사이의 화면을 본다.
 * 보는 것은 시간이 아니라 **상태 전환과 독의 크기가 안 흔들리는지**다.
 */
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

  // 마무리 중: 컨트롤은 잠기고(일시정지가 사라지고) 스크린리더용 상태가 선다. 독 높이는 그대로다.
  await expect(dock.getByText("녹음 마무리 중")).toBeAttached();
  await expect(stop).toHaveCount(0);
  expect(await height()).toBeCloseTo(before, 0);

  // 끝나면 재개가 서고 노트 상태가 바뀐다.
  await expect(dock.getByRole("button", { name: "재개" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(dock.getByText("녹음 마무리 중")).toHaveCount(0);
  expect(await height()).toBeCloseTo(before, 0);
});
