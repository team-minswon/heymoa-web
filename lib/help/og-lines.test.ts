import { describe, expect, it } from "vitest";

import { balancedLines, clampedLines, fitTitle } from "@/lib/help/og-lines";

describe("og-lines", () => {
  it("어절 중간에서 끊지 않고 마지막 줄이 한두 글자로 남지 않는다", () => {
    const title = "첫 회의를 처음부터 끝까지 해 보고 싶어요";
    const { size, lines } = fitTitle(
      title,
      960,
      [88, 76, 66, 58, 50, 44],
      -3 / 88
    );
    expect(lines.join(" ")).toBe(title);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(Math.min(...lines.map((l) => l.length))).toBeGreaterThan(5);
    expect(size).toBeLessThanOrEqual(88);
  });

  it("설명은 최대 줄 수에서 말줄임한다", () => {
    const long = Array.from({ length: 40 }, () => "녹음하고").join(" ");
    const lines = clampedLines(long, 30, 960, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(balancedLines("짧아요", 30, 960)).toEqual(["짧아요"]);
  });
});

describe("가이드 공유 카드 전수", () => {
  it("모든 제목·설명이 고아 줄 없이 들어가고 설명은 말줄임되지 않는다", async () => {
    const { helpTopicsFor, helpGroupsFor } =
      await import("@/app/[lang]/help/_content/topics");
    // 언어판마다 카드가 따로 그려진다(영어판도 같은 판 · 같은 줄 나누기).
    const cards = (["ko", "en"] as const).flatMap((locale) => [
      ...helpTopicsFor(locale).map((t) => ({
        title: t.title,
        summary: t.summary,
      })),
      ...helpGroupsFor(locale).map((g) => ({
        title: g.title,
        summary: g.summary,
      })),
    ]);
    for (const g of helpGroupsFor("ko")) {
      expect(g.summary.length, g.slug).toBeGreaterThanOrEqual(50);
      expect(g.summary.length, g.slug).toBeLessThanOrEqual(110);
    }
    for (const { title, summary } of cards) {
      const t = fitTitle(title, 960, [88, 76, 66, 58, 50, 44], -3 / 88);
      expect(t.lines.length, title).toBeLessThanOrEqual(3);
      if (t.lines.length > 1)
        expect(
          Math.min(...t.lines.map((l) => l.replace(/\s/g, "").length)),
          title
        ).toBeGreaterThanOrEqual(4);
      const s = clampedLines(summary, 30, 960, 2);
      if (s.length > 1)
        expect(
          Math.min(...s.map((l) => l.replace(/\s/g, "").length)),
          summary
        ).toBeGreaterThanOrEqual(6);
    }
    if (process.env.OG_STATS) {
      const rows = cards.map((c) => ({
        ...c,
        t: fitTitle(c.title, 960, [88, 76, 66, 58, 50, 44], -3 / 88),
        s: clampedLines(c.summary, 30, 960, 2),
      }));
      (await import("node:fs")).writeFileSync(
        process.env.OG_STATS,
        JSON.stringify(
          rows.map((r) => [
            r.title.length,
            r.t.size,
            r.t.lines.length,
            r.summary.length,
            r.s.length,
            r.title,
          ])
        )
      );
    }
  });
});
