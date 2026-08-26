import { describe, expect, it } from "vitest";

import { scopeChipClass, scopeKey } from "@/lib/chat/scope-chip";

describe("범위 칩", () => {
  it("연한 틴트가 칩을 만든다", () => {
    // 배경이 없으면 칩이 글자에 묻힌다 — 알약으로 보여야 「붙인 것」으로 읽힌다.
    expect(scopeChipClass("project")).toContain(
      "bg-[var(--el-scope-project-soft)]"
    );
    expect(scopeChipClass("note")).toContain("bg-[var(--el-scope-note-soft)]");
  });

  it("색으로만 갈린다 — 프로젝트가 파랑, 회의록이 초록", () => {
    expect(scopeChipClass("project")).toContain("text-[var(--el-scope-project)]");
    expect(scopeChipClass("note")).toContain("text-[var(--el-scope-note)]");
  });

  /**
   * ★ **모듈 docstring 이 못박은 것을 검사가 붙든다.**
   *
   * 칩은 두 곳에 뜬다 — 쓰는 동안의 입력(`mention-input`, React 밖 DOM)과 보낸 뒤의
   * 말풍선(`chat-thread`, JSX). 컴포넌트로 묶을 수가 없어 **함께 가는 것은 class 뿐**이고,
   * 그래서 갈라져도 아무것도 안 빨개진다.
   *
   * 한때 말풍선에서만 배경을 뺐다. 문제는 층수가 아니라 온도였고 틴트를 말풍선 색에서
   * 뽑아 고쳤으므로 **가를 옵션 자체가 없다.** `extra` 는 덧붙이기만 하고 못 뺀다.
   */
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
    // 회의록 id 와 프로젝트 id 는 같은 TSID 공간이라 충돌할 수 있다. id 만 쥐면
    // 프로젝트 하나가 같은 id 의 회의록을 허용 집합에서 밀어낸다.
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
