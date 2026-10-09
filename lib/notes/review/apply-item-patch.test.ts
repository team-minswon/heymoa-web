import { describe, expect, it } from "vitest";

import type { MeetingReviewResponseData } from "@/lib/api/generated/models";
import {
  applyItemPatch,
  restoreItemFields,
} from "@/lib/notes/review/apply-item-patch";

const item = (itemId: string, over: Record<string, unknown> = {}) => ({
  itemId,
  edited: false,
  kind: "ACTION",
  content: "배포 일정을 정한다",
  revision: 2,
  included: true,
  due: "2026-09-30",
  assignee: null,
  authoredByUserId: null,
  citations: [],
  originalProposalRef: null,
  replacements: [
    {
      reason: "r",
      kind: "k",
      label: "l",
      decision: null,
      target: { itemId: "N1", noteTitle: "t", endedAt: null, kind: "DECISION" },
    },
  ],
  taskChanges: [
    {
      reason: "r",
      decision: null,
      due: null,
      assignee: null,
      status: "OPEN",
      target: { itemId: "T1", revision: 1 },
    },
  ],
  ...over,
});
const review = (): MeetingReviewResponseData =>
  ({
    reviewVersion: 5,
    items: [item("A"), item("B")],
  }) as unknown as MeetingReviewResponseData;

describe("applyItemPatch", () => {
  it("그 항목의 포함 여부와 기한만 바꾸고 판은 건드리지 않는다", () => {
    const next = applyItemPatch(review(), "A", { included: false, due: null });

    expect(next.items[0]).toMatchObject({
      included: false,
      due: null,
      revision: 2,
    });
    expect(next.reviewVersion).toBe(5);
    // 다른 항목은 그대로(같은 객체).
    expect(next.items[1]).toEqual(review().items[1]);
  });

  it("제안 선택을 대상 id 로 찾아 건다 — 대체는 END·KEEP, 할 일 변경은 KEEP", () => {
    const next = applyItemPatch(review(), "A", {
      decisions: [
        { targetId: "N1", decision: "END" },
        { targetId: "T1", decision: "KEEP" },
      ],
    });

    expect(next.items[0].replacements[0].decision).toBe("END");
    expect(next.items[0].taskChanges[0].decision).toBe("KEEP");
  });

  it("할 일 변경의 APPLIED 와 대체의 APPLIED 는 걸지 않는다(두 단계 저장이라 응답을 기다린다)", () => {
    const next = applyItemPatch(review(), "A", {
      decisions: [
        { targetId: "T1", decision: "APPLIED" },
        { targetId: "N1", decision: "APPLIED" },
      ],
    });

    expect(next.items[0].taskChanges[0].decision).toBeNull();
    expect(next.items[0].replacements[0].decision).toBeNull();
  });

  it("선택을 null 로 지우면 지운다", () => {
    const withChoice = applyItemPatch(review(), "A", {
      decisions: [{ targetId: "N1", decision: "END" }],
    });
    const next = applyItemPatch(withChoice, "A", {
      decisions: [{ targetId: "N1", decision: null }],
    });

    expect(next.items[0].replacements[0].decision).toBeNull();
  });

  it("내용과 담당은 걸지 않는다 — 서버가 정하는 값이다", () => {
    const next = applyItemPatch(review(), "A", { content: "다른 내용" });

    expect(next.items[0].content).toBe("배포 일정을 정한다");
  });

  it("되돌릴 때는 그 항목의 먼저 건 칸만 이전 값으로 돌리고 다른 항목·판은 지금 값 그대로 둔다", () => {
    const before = review().items[0];
    const patched = applyItemPatch(review(), "A", {
      included: false,
      decisions: [{ targetId: "N1", decision: "END" }],
    });
    // 그사이 다른 조회가 판을 올리고 B 의 내용을 바꿨다.
    const newer = {
      ...patched,
      reviewVersion: 6,
      items: patched.items.map((row) =>
        row.itemId === "B"
          ? { ...row, content: "더 새 내용", revision: 9 }
          : row
      ),
    };

    const restored = restoreItemFields(newer, before, {
      included: false,
      decisions: [{ targetId: "N1", decision: "END" }],
    });

    // 같은 판이면(이 항목의 revision 이 그대로) 먼저 건 칸만 이전 값으로 돌린다.
    expect(restored.items[0]).toMatchObject({ included: true });
    expect(restored.items[0].replacements[0].decision).toBeNull();
    expect(restored.reviewVersion).toBe(6);
    expect(restored.items[1]).toMatchObject({
      content: "더 새 내용",
      revision: 9,
    });
  });

  it("그사이 이 항목의 더 새 판이 들어왔으면 되돌리지 않는다", () => {
    const before = review().items[0];
    const patch = { included: false };
    const patched = applyItemPatch(review(), "A", patch);
    const newer = {
      ...patched,
      items: patched.items.map((row) =>
        row.itemId === "A" ? { ...row, revision: 3, included: false } : row
      ),
    };

    expect(restoreItemFields(newer, before, patch).items[0]).toMatchObject({
      included: false,
      revision: 3,
    });
  });

  it("먼저 걸지 않은 APPLIED 선택은 되돌리지도 않는다", () => {
    const before = review().items[0];
    const patch = {
      decisions: [{ targetId: "T1", decision: "APPLIED" as const }],
    };
    // 다른 길이 이미 APPLIED 를 저장했다(이 항목의 판은 그대로).
    const current = {
      ...review(),
      items: review().items.map((row) =>
        row.itemId === "A"
          ? {
              ...row,
              taskChanges: row.taskChanges.map((task) => ({
                ...task,
                decision: "APPLIED" as const,
              })),
            }
          : row
      ),
    } as unknown as MeetingReviewResponseData;

    const restored = restoreItemFields(current, before, patch);

    expect(restored.items[0].taskChanges[0].decision).toBe("APPLIED");
  });
});
