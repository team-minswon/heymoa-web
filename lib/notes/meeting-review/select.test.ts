import { describe, expect, it } from "vitest";

import {
  groupReviewItems,
  resolveCitations,
  type ReviewItem,
} from "@/lib/notes/meeting-review/select";

function item(over: Partial<ReviewItem> & Pick<ReviewItem, "itemId" | "kind">): ReviewItem {
  return {
    content: over.itemId,
    revision: 1,
    included: true,
    edited: false,
    originalProposalRef: null,
    authoredByUserId: null,
    assigneeText: null,
    dueText: null,
    citations: [],
    ...over,
  };
}

describe("groupReviewItems", () => {
  it("결론 → 논의 중 → 참고로 묶고 묶음 안은 유형 차례다", () => {
    const groups = groupReviewItems([
      item({ itemId: "i", kind: "INSIGHT" }),
      item({ itemId: "a", kind: "ACTION_ITEM" }),
      item({ itemId: "q", kind: "QUESTION" }),
      item({ itemId: "d", kind: "DECISION" }),
      item({ itemId: "g", kind: "AGENDA" }),
    ]);
    expect(groups.map((group) => [group.key, group.items.map((row) => row.itemId)])).toEqual([
      ["OUTCOME", ["d", "a"]],
      ["DISCUSSION", ["g", "q"]],
      ["REFERENCE", ["i"]],
    ]);
    expect(groups[0].label).toBe("결론");
    expect(groups.map((group) => group.collapsed)).toEqual([false, true, true]);
  });

  it("결론은 비어도 남고 다른 묶음은 항목이 있을 때만 선다", () => {
    const groups = groupReviewItems([item({ itemId: "s", kind: "STATUS_REPORT" })]);
    expect(groups.map((group) => group.key)).toEqual(["OUTCOME", "REFERENCE"]);
    expect(groups[0].items).toEqual([]);
  });

  it("제외한 항목도 자기 자리에 남고 개수만 따로 센다", () => {
    const groups = groupReviewItems([
      item({ itemId: "x", kind: "DECISION", included: false }),
      item({ itemId: "d", kind: "DECISION" }),
    ]);
    expect(groups[0].items.map((row) => row.itemId)).toEqual(["x", "d"]);
    expect(groups[0].excludedCount).toBe(1);
  });
});

describe("resolveCitations", () => {
  const segments = [
    { segmentId: "s2", sequence: 2, text: "둘째", startedAtMs: 2000, endedAtMs: 2500, speakerLabel: "B", assignedParticipantId: null },
    { segmentId: "s1", sequence: 1, text: "첫째", startedAtMs: 1000, endedAtMs: 1500, speakerLabel: null, assignedParticipantId: null },
  ];

  it("발화 순서로 풀고 중복과 없는 줄은 뺀다", () => {
    const evidence = resolveCitations(
      [{ segmentId: "s2" }, { segmentId: "s1" }, { segmentId: "s2" }, { segmentId: "nope" }],
      segments
    );
    expect(evidence.map((row) => row.text)).toEqual(["첫째", "둘째"]);
    expect(evidence[1].speakerLabel).toBe("B");
  });
});
