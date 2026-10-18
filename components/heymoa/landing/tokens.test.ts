import { describe, expect, it } from "vitest";

import { TV_VARS } from "./tokens";

const v = (name: string) => (TV_VARS as Record<string, string>)[name];
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** 로고(`public/android-chrome-192x192.png`)의 코랄 `#fd7765` 에서 파생한 팔레트의 대비. */
describe("랜딩 팔레트(TV_VARS)", () => {
  const white = "#ffffff";
  const faces = [white, v("--tv-lav"), v("--tv-lav-soft"), v("--tv-butter"), v("--tv-mint")];

  it("브랜드 색은 로고 코랄이다", () => {
    expect(v("--tv-brand")).toBe("#fd7765");
  });

  it("본문 · 보조 글자와 진한 주황 링크가 모든 밝은 면에서 AA 이상이다", () => {
    for (const bg of faces) {
      expect(ratio(v("--tv-ink"), bg)).toBeGreaterThanOrEqual(12);
      expect(ratio(v("--tv-body"), bg)).toBeGreaterThanOrEqual(8);
      expect(ratio(v("--tv-muted"), bg)).toBeGreaterThanOrEqual(4.9);
      expect(ratio(v("--tv-brand-deep"), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("코랄 · 호버 · 노랑 면 위에는 ink 글자(흰 글자는 안 된다)", () => {
    for (const bg of [v("--tv-brand"), v("--tv-brand-hover"), v("--tv-pop")]) {
      expect(ratio(v("--tv-on-brand"), bg)).toBeGreaterThanOrEqual(6);
    }
    expect(ratio(white, v("--tv-brand"))).toBeLessThan(3);
  });

  it("연주황 면과 살구 면과 노랑이 서로 구분된다", () => {
    expect(v("--tv-lav")).not.toBe(v("--tv-peach"));
    expect(v("--tv-pop")).not.toBe(v("--tv-brand"));
  });
});
