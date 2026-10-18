import { describe, expect, it } from "vitest";

import {
  findMatchRanges,
  normalizeQuery,
  stepIndex,
} from "@/lib/help/match-ranges";

const root = (html: string) => {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.append(el);
  return el;
};
const texts = (ranges: Range[]) => ranges.map((range) => range.toString());

describe("findMatchRanges", () => {
  it("공백과 대소문자를 무시하고 부분 문자열로 찾는다", () => {
    const el = root("<p>Linear · GitHub 연동은 관리자가 합니다.</p>");
    expect(texts(findMatchRanges(el, "github"))).toEqual(["GitHub"]);
    expect(texts(findMatchRanges(el, "연 동"))).toEqual(["연동"]);
    expect(texts(findMatchRanges(el, "관리"))).toEqual(["관리"]);
  });

  it("강조·링크 같은 중첩 노드를 가로지르는 일치를 잡는다", () => {
    const el = root(
      '<p>용어 <b>사전</b>은 <a href="#x">설정</a> 에서 엽니다.</p>'
    );
    expect(texts(findMatchRanges(el, "용어사전"))).toEqual(["용어 사전"]);
    expect(texts(findMatchRanges(el, "은설정"))).toEqual(["은 설정"]);
  });

  it("문단을 가로지르는 일치는 만들지 않는다", () => {
    const el = root("<p>첫 문단 끝</p><p>둘째 문단</p>");
    expect(findMatchRanges(el, "끝둘째")).toEqual([]);
  });

  it("같은 문단의 여러 일치를 순서대로 센다", () => {
    const el = root("<p>회의 회의 회의록</p>");
    expect(findMatchRanges(el, "회의")).toHaveLength(3);
  });

  it("검색어가 비면 아무것도 돌려주지 않는다", () => {
    const el = root("<p>내용</p>");
    expect(findMatchRanges(el, "")).toEqual([]);
    expect(findMatchRanges(el, "  ")).toEqual([]);
  });

  it("본문 DOM 을 바꾸지 않는다", () => {
    const el = root("<p>찾을 <b>내용</b></p>");
    const before = el.innerHTML;
    findMatchRanges(el, "내용");
    expect(el.innerHTML).toBe(before);
  });
});

describe("stepIndex", () => {
  it("처음과 끝이 이어진다", () => {
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
    expect(stepIndex(0, 0, 1)).toBe(-1);
  });
  it("normalizeQuery 는 공백을 모두 뺀다", () => {
    expect(normalizeQuery(" A b\tC ")).toBe("abc");
  });
});
