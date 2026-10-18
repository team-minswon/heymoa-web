import { describe, expect, it } from "vitest";

import { applyOps, splitPastedTerms } from "@/lib/terms/term-list";

describe("applyOps", () => {
  it("같은 용어(대소문자·공백 무시)는 다시 얹지 않고, 임시 id 의 삭제는 실제 id 로 지운다", () => {
    const confirmed = [
      { termId: "1", term: "MCP" },
      { termId: "2", term: "A" },
    ];
    expect(
      applyOps(
        confirmed,
        [
          { kind: "add", tempId: "temp:1", term: " mcp " },
          { kind: "remove", termId: "temp:9" },
        ],
        new Map([["temp:9", "2"]])
      )
    ).toEqual([{ termId: "1", term: "MCP" }]);
  });
});

describe("splitPastedTerms", () => {
  it("줄마다 하나, 빈 줄·중복·40자 초과는 뺀다", () => {
    const long = "가".repeat(41);
    expect(
      splitPastedTerms(`PG사\n\n pg사 \nHeyMoa\r\n${long}\n결제`, [
        { termId: "1", term: "heymoa" },
      ])
    ).toEqual({ terms: ["PG사", "결제"], tooLong: 1, duplicates: 2 });
  });
});
