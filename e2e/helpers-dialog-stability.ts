import { expect, test } from "@playwright/test";

/**
 * 가이드 대화상자(검색 팔레트 · 이미지 확대 · 영상 확대, 한 오버레이를 쓴다)를 열고 닫아도 폭과 고정 요소(상단바·사이드바·본문) 자리가
 * 변하지 않는다. 스크롤바 두 조건 모두에서 본다 — 클래식(폭 15px, 마우스)과 오버레이(폭 0, 트랙패드). 헤드리스는 기본으로 스크롤바를
 * 숨기므로(--hide-scrollbars) 클래식 쪽 파일이 그 인자를 뺀다.
 */
export function dialogStabilityTests(classic: boolean) {
  for (const kind of ["palette", "image", "clip"] as const) {
    test(`${classic ? "클래식" : "오버레이"} 스크롤바에서 ${kind} 대화상자를 열고 닫아도 폭과 고정 요소 자리가 변하지 않는다`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(
        kind === "clip"
          ? "/help/situations/fix-speakers"
          : "/help/record/recording"
      );
      await page.waitForLoadState("networkidle");
      if (classic)
        await page.addStyleTag({
          content:
            "::-webkit-scrollbar{width:15px;background:#eee}::-webkit-scrollbar-thumb{background:#aaa}",
        });
      // 누를 것을 먼저 화면에 올려 둔다 — 누르면서 생기는 스크롤이 전후 비교에 끼지 않게.
      const target =
        kind === "image"
          ? page.locator("figure button:has(img)").first()
          : page.locator("figure video").first();
      if (kind === "palette") await page.mouse.wheel(0, 300);
      else await target.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const snap = () =>
        page.evaluate(() => {
          const r = (s: string) => {
            const b = document.querySelector(s)!.getBoundingClientRect();
            return [b.left, b.width, b.top].map((v) => Math.round(v * 10) / 10);
          };
          return {
            width: document.documentElement.clientWidth,
            header: r("header"),
            main: r("[data-help-main]"),
            sidebar: r("nav[aria-label='사용 가이드 주제']").slice(0, 2),
          };
        });
      const before = await snap();
      expect(before.width).toBe(classic ? 1425 : 1440); // 클래식은 스크롤바가 폭을 차지하고, 오버레이는 차지하지 않는다
      if (kind === "palette") await page.keyboard.press("Control+k");
      else if (kind === "image") await target.click();
      else await target.click({ force: true });
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.waitForTimeout(400);
      const open = await snap();
      expect(open.width).toBe(before.width);
      expect(open.header).toEqual(before.header);
      expect(open.sidebar).toEqual(before.sidebar);
      await page.mouse.click(1420, 880); // 바깥(배경 막)
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await snap()).toEqual(before);
    });
  }
}
