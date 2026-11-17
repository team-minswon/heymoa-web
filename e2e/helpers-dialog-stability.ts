import { expect, test } from "@playwright/test";
import { openGuide, settled } from "./helpers-ui";

export function dialogStabilityTests(classic: boolean) {
  for (const kind of ["palette", "image", "clip"] as const) {
    test(`${classic ? "클래식" : "오버레이"} 스크롤바에서 ${kind} 대화상자를 열고 닫아도 폭과 고정 요소 자리가 변하지 않는다`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openGuide(
        page,
        kind === "clip"
          ? "/help/situations/fix-speakers"
          : "/help/record/recording"
      );
      if (classic)
        await page.addStyleTag({
          content:
            "::-webkit-scrollbar{width:15px;background:#eee}::-webkit-scrollbar-thumb{background:#aaa}",
        });
      const target =
        kind === "image"
          ? page.locator("figure button:has(img)").first()
          : page.locator("figure video").first();
      if (kind === "palette")
        await page.evaluate(() =>
          window.scrollTo({ top: 300, behavior: "instant" })
        );
      else
        await target.evaluate((element) =>
          element.scrollIntoView({ block: "center", behavior: "instant" })
        );
      await page.evaluate(() => document.fonts.ready);
      if (kind === "image") await target.hover();
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
      expect(before.width).toBe(classic ? 1425 : 1440);
      if (kind === "palette") await page.keyboard.press("Control+k");
      else if (kind === "image") await target.click();
      else await target.click({ force: true });
      await settled(page.getByRole("dialog"));
      const open = await snap();
      expect(open.width).toBe(before.width);
      expect(open.header).toEqual(before.header);
      expect(open.sidebar).toEqual(before.sidebar);
      await page.mouse.click(1420, 880);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await snap()).toEqual(before);
    });
  }
}

export function notificationScrollbarTests(classic: boolean) {
  for (const width of [1440, 1024]) {
    test(`${classic ? "클래식" : "오버레이"} 스크롤바 ${width}px — 알림 목록 막대가 하나로 이어지고 카드와 겹치지 않는다`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/w/01K0000000000?notifications=all");
      if (classic)
        await page.addStyleTag({
          content:
            "::-webkit-scrollbar{width:15px;background:#eee}::-webkit-scrollbar-thumb{background:#aaa}",
        });
      const dialog = page.getByRole("dialog", { name: "알림" });
      await expect(
        dialog.getByRole("button", { name: "수락" }).first()
      ).toBeVisible();
      await settled(dialog);
      const list = dialog.locator("[data-slot=notification-list]");
      await list.evaluate((node) => (node.scrollTop = 120));
      const g = await list.evaluate((node: HTMLElement, classic) => {
        const box = node.getBoundingClientRect();
        const inner = box.left + node.clientLeft + node.clientWidth;
        const cards = [...node.querySelectorAll("ul")].map(
          (ul) => ul.getBoundingClientRect().right
        );
        const x = classic ? inner + 7 : inner - 6;
        const hits = new Set<string>();
        for (let y = box.top + 4; y < box.bottom - 4; y += 6) {
          const hit = document.elementFromPoint(x, y);
          hits.add(
            hit === node
              ? "list"
              : hit?.closest("ul")
                ? "card"
                : (hit?.tagName ?? "none")
          );
        }
        return {
          scrollable: node.scrollHeight > node.clientHeight,
          bar: node.offsetWidth - node.clientWidth,
          cardGap: cards.map((right) => Math.round(inner - right)),
          hits: [...hits],
          primitive: node
            .closest("[role=dialog]")!
            .querySelectorAll("[data-slot=scroll-area-scrollbar]").length,
        };
      }, classic);
      expect(g.scrollable).toBe(true);
      expect(g.primitive).toBe(0);
      // 헤드리스의 --hide-scrollbars 는 막대만 숨기고 `scrollbar-gutter: stable` 자리(15px)는 잡아, 오버레이 막대 조건은 못 만듭니다.
      if (classic) expect(g.bar).toBe(15);
      expect(new Set(g.cardGap)).toEqual(new Set([24]));
      if (classic) expect(g.hits).toEqual(["list"]);
      else expect(g.hits).not.toContain("card");
    });
  }
}
