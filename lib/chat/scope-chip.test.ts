import { describe, expect, it } from "vitest";

import { scopeChipClass, scopeKey } from "@/lib/chat/scope-chip";

describe("범위 칩", () => {
  it("연한 틴트가 칩을 만든다", () => {
    expect(scopeChipClass("project")).toContain(
      "bg-[var(--el-scope-project-soft)]"
    );
    expect(scopeChipClass("note")).toContain("bg-[var(--el-scope-note-soft)]");
  });

  it("색으로만 갈린다 — 프로젝트가 파랑, 회의록이 초록", () => {
    expect(scopeChipClass("project")).toContain("text-[var(--el-scope-project)]");
    expect(scopeChipClass("note")).toContain("text-[var(--el-scope-note)]");
  });

  it("★ 입력창과 말풍선이 같은 class 를 받는다 — 갈라질 자리가 없다", () => {
    const withExtra = scopeChipClass("project", { extra: "max-w-[13rem]" });

    for (const shared of [
      "bg-[var(--el-scope-project-soft)]",
      "text-[var(--el-scope-project)]",
      "rounded-chip",
      "text-[13.5px]",
    ]) {
      expect(withExtra).toContain(shared);
    }
    expect(withExtra).toContain("max-w-[13rem]");
  });
});

describe("허용 집합의 키", () => {
  it("★ id 가 같아도 kind 가 다르면 다른 키다", () => {
    expect(scopeKey({ kind: "note", id: "0K9GVJT2C4Q2A" })).not.toBe(
      scopeKey({ kind: "project", id: "0K9GVJT2C4Q2A" })
    );
  });

  it("같은 것은 같은 키다", () => {
    expect(scopeKey({ kind: "note", id: "0K9GVJT2C4Q2A" })).toBe(
      scopeKey({ kind: "note", id: "0K9GVJT2C4Q2A" })
    );
  });
});
