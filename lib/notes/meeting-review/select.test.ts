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
  it("kind 순서로 묶고 빈 kind 는 섹션을 만들지 않는다", () => {
    const sections = groupReviewItems([
      item({ itemId: "a", kind: "ACTION_ITEM" }),
      item({ itemId: "d", kind: "DECISION" }),
      item({ itemId: "g", kind: "AGENDA" }),
    ]);
    expect(sections.map((section) => section.kind)).toEqual([
      "AGENDA",
      "DECISION",
      "ACTION_ITEM",
    ]);
    expect(sections[0].label).toBe("안건");
  });

  it("제외한 항목도 자기 섹션 자리에 남긴다", () => {
    const sections = groupReviewItems([
      item({ itemId: "x", kind: "ISSUE", included: false }),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].items[0].included).toBe(false);
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
