import { expect, test } from "@playwright/test";

// MSW 회의만 사용합니다. 실제 회의·녹음 상태는 바꾸지 않습니다.
test("긴 내용과 펼침의 높이 변화는 하단을 유지하고 수동 스크롤은 존중합니다", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/w/01K0000000000/notes/01K0000000016?view=full&tab=context");
  const lastGroup = page.getByRole("button", { name: /^하반기 채용/ });
  await expect(lastGroup).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("li[id^=timeline-item]").first()).toHaveCSS("opacity", "1");
  const viewport = page
    .locator("[data-slot=scroll-area-viewport]")
    .filter({ has: lastGroup });
  const distance = () =>
    viewport.evaluate(
      (node) => node.scrollHeight - node.scrollTop - node.clientHeight
    );
  await expect.poll(distance).toBeLessThan(2);

  await viewport.evaluate((node) => {
    const spacer = document.createElement("div");
    spacer.dataset.testid = "late-timeline-content";
    spacer.style.height = "900px";
    node.firstElementChild!.append(spacer);
  });
  await expect.poll(distance).toBeLessThan(2);
  const lateContent = page.getByTestId("late-timeline-content");
  await lateContent.evaluate(async (node) => {
    const block = node as HTMLElement;
    block.style.transition = "height 300ms linear";
    block.style.height = "1900px";
    await Promise.all(
      block.getAnimations().map((animation) => animation.finished)
    );
  });
  await expect.poll(distance).toBeLessThan(2);

  await viewport.hover();
  await page.mouse.wheel(0, -80);
  await expect(page.getByRole("button", { name: "맨 아래로" })).toBeVisible();
  const readTop = await viewport.evaluate((node) => node.scrollTop);
  await lateContent.evaluate((node) => {
    (node as HTMLElement).style.height = "2900px";
  });
  await expect
    .poll(() =>
      lateContent.evaluate((node) => node.getBoundingClientRect().height)
    )
    .toBe(2900);
  expect(await viewport.evaluate((node) => node.scrollTop)).toBeCloseTo(
    readTop,
    0
  );
  await page.getByRole("button", { name: "맨 아래로" }).click();
  await expect.poll(distance).toBeLessThan(2);
});
