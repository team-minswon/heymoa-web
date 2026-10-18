import { describe, expect, it } from "vitest";

import { applyOps, normalizeTerm } from "@/lib/terms/term-list";

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

describe("applyOps addMany", () => {
  it("여러 개를 한꺼번에 세우되 이미 있거나 앞에 같은 것은 건너뛴다", () => {
    expect(
      applyOps(
        [{ termId: "1", term: "MCP" }],
        [
          {
            kind: "addMany",
            items: [
              { tempId: "temp:1", term: " mcp " },
              { tempId: "temp:2", term: "Kafka" },
              { tempId: "temp:3", term: "kafka" },
            ],
          },
        ],
        new Map()
      )
    ).toEqual([
      { termId: "1", term: "MCP" },
      { termId: "temp:2", term: "Kafka" },
    ]);
  });
});

describe("normalizeTerm", () => {
  it("대소문자·앞뒤와 안쪽 공백을 무시한다", () => {
    expect(normalizeTerm("  Helm   Chart ")).toBe(normalizeTerm("helm chart"));
  });
});
