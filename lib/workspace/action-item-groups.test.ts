import { describe, expect, it } from "vitest";

import type { ActionItem } from "@/lib/api/generated/models";
import { groupActionItemsByDue } from "@/lib/workspace/action-item-groups";

const NOW = Date.parse("2026-08-01T00:00:00Z");

function item(id: string, dueAt: string | null): ActionItem {
  return {
    actionItemId: id,
    noteId: "01K0000000002",
    noteTitle: "주간 제품 회의",
    projectId: "01K0000000001",
    text: id,
    assignee: null,
    dueAt,
    status: "OPEN",
    createdAt: "2026-07-24T00:00:00Z",
  };
}

describe("groupActionItemsByDue", () => {
  it("지난 기한 · 이번 주 · 나중 · 기한 없음으로 가른다", () => {
    const groups = groupActionItemsByDue(
      [
        item("later", "2026-09-01T00:00:00Z"),
        item("none", null),
        item("overdue", "2026-07-30T00:00:00Z"),
        item("week", "2026-08-04T00:00:00Z"),
      ],
      NOW
    );

    expect(groups.map((group) => group.key)).toEqual([
      "overdue",
      "thisWeek",
      "later",
      "noDue",
    ]);
  });

  it("비어 있는 묶음은 만들지 않는다", () => {
    const groups = groupActionItemsByDue([item("none", null)], NOW);
    expect(groups.map((group) => group.key)).toEqual(["noDue"]);
  });

  it("경계 — 지금과 같은 시각은 지나지 않은 것으로 본다", () => {
    const groups = groupActionItemsByDue(
      [item("boundary", "2026-08-01T00:00:00Z")],
      NOW
    );
    expect(groups[0].key).toBe("thisWeek");
  });

  it("경계 — 7일 뒤 정각까지가 이번 주다", () => {
    const groups = groupActionItemsByDue(
      [
        item("edge", "2026-08-08T00:00:00Z"),
        item("past-edge", "2026-08-08T00:00:01Z"),
      ],
      NOW
    );
    expect(groups.find((g) => g.key === "thisWeek")?.items).toHaveLength(1);
    expect(groups.find((g) => g.key === "later")?.items).toHaveLength(1);
  });

  it("오프셋 표기를 문자열이 아니라 시각으로 읽는다", () => {
    // +09:00 은 문자열로는 Z 표기보다 크지만 같은 시각이다.
    const groups = groupActionItemsByDue(
      [item("kst", "2026-07-31T09:00:00+09:00")],
      NOW
    );
    expect(groups[0].key).toBe("overdue");
  });

  it("기한 없음은 늘 마지막이다", () => {
    const groups = groupActionItemsByDue(
      [item("none", null), item("overdue", "2026-07-01T00:00:00Z")],
      NOW
    );
    expect(groups.at(-1)?.key).toBe("noDue");
  });

  it("파싱 못 하는 기한을 「지난 기한」으로 밀지 않는다", () => {
    // 없는 긴급을 만들면 사용자가 실제로 지난 것을 못 본다.
    const groups = groupActionItemsByDue([item("broken", "언제까지")], NOW);
    expect(groups[0].key).toBe("noDue");
  });

  it("묶음 안에서 기한이 이른 순이다", () => {
    const groups = groupActionItemsByDue(
      [
        item("b", "2026-08-05T00:00:00Z"),
        item("a", "2026-08-02T00:00:00Z"),
      ],
      NOW
    );
    expect(groups[0].items.map((row) => row.actionItemId)).toEqual(["a", "b"]);
  });
});
