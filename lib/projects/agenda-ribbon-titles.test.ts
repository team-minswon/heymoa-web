import { describe, expect, it } from "vitest";

import { OPEN_FLOOR, OPEN_MAX, OPEN_MIN, estimateWidth, openCap, openNeed, openWidth } from "@/lib/projects/agenda-ribbon-titles";

const at = (title: string) => ({ title });
const measure = (text: string) => estimateWidth(text, 13);

describe("openNeed", () => {
  it("fits the longest one-line title in the 75% right of the dot, and counts 「외 N」 for capsules", () => {
    const single = openNeed([{ agendas: [at("에이전트 구조와 회의록 검색")] }], [], measure);
    const capsule = openNeed([{ agendas: [at("에이전트 구조와 회의록 검색"), at("다른 안건")] }], [], measure);
    expect(single).toBeGreaterThan((measure("에이전트 구조와 회의록 검색") + 62) / 0.75);
    expect(capsule).toBeGreaterThan(single);
    expect(openNeed([{ agendas: [at("짧은"), at("에이전트 구조와 회의록 검색")] }], [], measure)).toBeGreaterThan(single);
  });

  it("makes room for the longest title in the 「그 밖의 안건」 list", () => {
    const zone = [at("아주 길고 길고 긴 제목의 이어짐 없는 안건 한 줄이 전부 보여야 합니다 정말로")];
    expect(openNeed([], zone, measure)).toBeGreaterThan(measure(zone[0].title));
  });

  it("is zero for a column with nothing to show", () => {
    expect(openNeed([], [], measure)).toBe(0);
  });
});

describe("openCap / openWidth", () => {
  it("caps a closed board at 760px (or 92% of a narrow board) and a board with the panel open at 70% of what is left", () => {
    expect(openCap(1100, 360, false)).toBe(OPEN_MAX);
    expect(openCap(700, 360, false)).toBeCloseTo(644);
    expect(openCap(1100, 360, true)).toBeCloseTo(518);
    expect(openCap(500, 360, true)).toBe(OPEN_FLOOR);
  });

  it("keeps a width between the minimum and the cap", () => {
    expect(openWidth(100, 760)).toBe(OPEN_MIN);
    expect(openWidth(500, 760)).toBe(500);
    expect(openWidth(900, 760)).toBe(760);
    expect(openWidth(100, 280)).toBe(280);
  });
});
