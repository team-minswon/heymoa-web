import { describe, expect, it } from "vitest";

import { PG_TERMS } from "@/content/billing/pg-terms";

import { splitTerms } from "./fetch-nicepay-terms.mjs";

describe("splitTerms", () => {
  it("조·부칙·항목 경계에서 나누고, 이어 붙이면 원문과 같다", () => {
    const content =
      "[약관]제1조 (목적)목적입니다.제2조 (정의)1. 첫째입니다.2. 둘째(전자금융거래법 제2조 제10호)입니다.※ 참고가.\t항목부 칙시행일자 : 2020년 8월 3일";
    const parts = splitTerms(content);
    expect(parts.join("")).toBe(content);
    expect(parts).toEqual([
      "[약관]",
      "제1조 (목적)목적입니다.",
      "제2조 (정의)",
      "1. 첫째입니다.",
      "2. 둘째(전자금융거래법 제2조 제10호)입니다.",
      "※ 참고",
      "가.\t항목",
      "부 칙시행일자 : 2020년 8월 3일",
    ]);
  });

  it("받아 둔 약관 셋은 비지 않은 문단으로 들어 있다", () => {
    expect(PG_TERMS.map((terms) => terms.type)).toEqual([
      "ElectronicFinancialTransactions",
      "CollectPersonalInfo",
      "SharingPersonalInformation",
    ]);
    for (const terms of PG_TERMS) {
      expect(terms.title).not.toBe("");
      expect(terms.paragraphs.length).toBeGreaterThan(1);
      expect(terms.paragraphs.every((p) => p.length > 0)).toBe(true);
    }
  });
});
