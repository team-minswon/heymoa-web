import { describe, expect, it } from "vitest";

import {
  chunk,
  planBulk,
  splitTerms,
  summaryParts,
} from "@/lib/terms/term-bulk";

const existing = (...terms: string[]) =>
  terms.map((term, i) => ({ termId: `T${i}`, term }));

describe("splitTerms", () => {
  it("빈 입력과 공백·구분자만 있는 입력은 조각이 없다", () => {
    expect(splitTerms("")).toEqual([]);
    expect(splitTerms("   \n\t ")).toEqual([]);
    expect(splitTerms(",;,\n;")).toEqual([]);
  });

  it("쉼표·세미콜론·탭·줄바꿈(CRLF 포함)을 섞어도 가르고 안쪽 공백은 한 칸으로 줄인다", () => {
    expect(splitTerms("a, b;c\td\r\ne\n\n  f   g  ")).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f g",
    ]);
  });

  it("엑셀 열 복사(끝 줄바꿈)와 전각 쉼표를 다룬다", () => {
    expect(splitTerms("쿠버네티스\n헬름 차트\n")).toEqual([
      "쿠버네티스",
      "헬름 차트",
    ]);
    expect(splitTerms("가，나；다")).toEqual(["가", "나", "다"]);
  });
});

describe("planBulk", () => {
  const base = { limit: 10 };

  it("새 용어는 입력 순서대로, 입력 안 중복과 대소문자 중복은 뺀다", () => {
    const plan = planBulk({
      ...base,
      text: "Kafka, kafka, KAFKA, Redis",
      terms: [],
    });
    expect(plan.fresh).toEqual(["Kafka", "Redis"]);
    expect(plan.duplicates).toEqual(["kafka", "KAFKA"]);
    expect(plan.total).toBe(4);
  });

  it("이미 있는 용어는 대소문자·공백을 무시하고 중복으로 센다", () => {
    const plan = planBulk({
      ...base,
      text: "heymoa,  MCP ,새것",
      terms: existing("HeyMoa", "mcp"),
    });
    expect(plan.fresh).toEqual(["새것"]);
    expect(plan.duplicates).toEqual(["heymoa", "MCP"]);
  });

  it("40자 경계: 40자는 되고 41자는 제외한다 (이모지는 코드 유닛 2)", () => {
    const plan = planBulk({
      ...base,
      text: [
        "가".repeat(40),
        "가".repeat(41),
        "😀".repeat(20),
        "😀".repeat(21),
      ].join(","),
      terms: [],
    });
    expect(plan.fresh).toEqual(["가".repeat(40), "😀".repeat(20)]);
    expect(plan.tooLong).toEqual(["가".repeat(41), "😀".repeat(21)]);
  });

  it("한도 직전: 남은 자리만큼만 넣고 나머지는 한도 초과로 센다", () => {
    const plan = planBulk({
      text: "a,b,c,d",
      terms: existing("x", "y", "z"),
      limit: 5,
    });
    expect(plan.fresh).toEqual(["a", "b"]);
    expect(plan.overLimit).toEqual(["c", "d"]);
  });

  it("가득 찼으면 새 용어는 모두 한도 초과, 이미 있는 것은 중복으로 센다", () => {
    const plan = planBulk({ text: "x, new", terms: existing("x"), limit: 1 });
    expect(plan.fresh).toEqual([]);
    expect(plan.duplicates).toEqual(["x"]);
    expect(plan.overLimit).toEqual(["new"]);
  });
});

describe("summaryParts", () => {
  it("0인 항목은 말하지 않는다", () => {
    const plan = planBulk({
      text: "a, a, b, " + "가".repeat(41),
      terms: [],
      limit: 10,
    });
    expect(summaryParts(plan).map((part) => part.text)).toEqual([
      "새로 2개",
      "이미 있어요 1개",
      "40자를 넘어 제외 1개",
    ]);
    expect(summaryParts(planBulk({ text: "", terms: [], limit: 10 }))).toEqual(
      []
    );
  });
});

describe("chunk", () => {
  it("100개씩 나눈다", () => {
    expect(
      chunk(
        Array.from({ length: 205 }, (_, i) => i),
        100
      ).map((c) => c.length)
    ).toEqual([100, 100, 5]);
    expect(chunk([], 100)).toEqual([]);
  });
});
