import { describe, expect, it } from "vitest";

import {
  effectiveItem,
  hasUnsavedEdits,
  initialEdits,
  reduceEdits,
  type EditsState,
} from "@/lib/notes/meeting-review/edits";
import { ITEM, sampleReview } from "@/lib/notes/meeting-review/fixtures";

function apply(actions: Parameters<typeof reduceEdits>[1][], from = initialEdits(4)) {
  return actions.reduce(reduceEdits, from);
}

describe("reduceEdits", () => {
  it("편집은 미저장으로 쌓이고 승인 전 판정에 잡힌다", () => {
    const state = apply([
      { type: "edit-item", itemId: ITEM.decision, edit: { content: "고친 내용" } },
    ]);
    expect(hasUnsavedEdits(state)).toBe(true);
    expect(state.pendingItems[ITEM.decision]).toEqual({ content: "고친 내용" });
  });

  it("같은 항목의 편집은 합쳐진다 — 내용 뒤에 제외를 눌러도 내용이 안 사라진다", () => {
    const state = apply([
      { type: "edit-item", itemId: ITEM.decision, edit: { content: "고친 내용" } },
      { type: "edit-item", itemId: ITEM.decision, edit: { included: false } },
    ]);
    expect(state.pendingItems[ITEM.decision]).toEqual({ content: "고친 내용", included: false });
  });

  it("저장 성공은 미저장을 걷고 검토본 버전을 전진시킨다", () => {
    const state = apply([
      { type: "edit-item", itemId: ITEM.decision, edit: { content: "고친 내용" } },
      { type: "saving", key: `item:${ITEM.decision}` },
      { type: "saved", key: `item:${ITEM.decision}`, reviewVersion: 5 },
    ]);
    expect(state.pendingItems).toEqual({});
    expect(state.saving.size).toBe(0);
    expect(state.reviewVersion).toBe(5);
    expect(hasUnsavedEdits(state)).toBe(false);
  });

  it("늦은 응답은 버전을 뒤로 돌리지 않는다", () => {
    const state = apply([
      { type: "sync-version", reviewVersion: 7 },
      { type: "saved", key: `item:${ITEM.decision}`, reviewVersion: 5 },
      { type: "sync-version", reviewVersion: 3 },
    ]);
    expect(state.reviewVersion).toBe(7);
  });

  it("충돌은 로컬 편집을 보존하고 서버 값을 옆에 둔다", () => {
    const server = sampleReview().items[1];
    const state = apply([
      { type: "edit-item", itemId: ITEM.decision, edit: { content: "내 편집" } },
      { type: "saving", key: `item:${ITEM.decision}` },
      {
        type: "conflict",
        key: `item:${ITEM.decision}`,
        conflict: { kind: "item", local: { content: "내 편집" }, server, currentReviewVersion: 6 },
      },
    ]);
    expect(state.pendingItems[ITEM.decision]).toEqual({ content: "내 편집" });
    expect(state.conflicts[`item:${ITEM.decision}`]?.kind).toBe("item");
    expect(state.reviewVersion).toBe(6);
    // 충돌 중인 것도 미저장이다 — 승인이 이걸 건너뛰면 안 된다.
    expect(hasUnsavedEdits(state)).toBe(true);
  });

  it("keep-local 은 편집을 두고 충돌만 걷고, take-server 는 편집을 버린다", () => {
    const server = sampleReview().items[1];
    const conflicted: EditsState = apply([
      { type: "edit-item", itemId: ITEM.decision, edit: { content: "내 편집" } },
      {
        type: "conflict",
        key: `item:${ITEM.decision}`,
        conflict: { kind: "item", local: { content: "내 편집" }, server, currentReviewVersion: 6 },
      },
    ]);

    const kept = reduceEdits(conflicted, { type: "keep-local", key: `item:${ITEM.decision}` });
    expect(kept.pendingItems[ITEM.decision]).toEqual({ content: "내 편집" });
    expect(kept.conflicts).toEqual({});

    const taken = reduceEdits(conflicted, { type: "take-server", key: `item:${ITEM.decision}` });
    expect(taken.pendingItems).toEqual({});
    expect(taken.conflicts).toEqual({});
  });

  it("저장 실패는 문구를 남기고 편집을 유지한다. 다시 편집하면 문구가 걷힌다", () => {
    const failed = apply([
      { type: "edit-item", itemId: ITEM.issue, edit: { included: false } },
      { type: "saving", key: `item:${ITEM.issue}` },
      { type: "failed", key: `item:${ITEM.issue}`, message: "권한이 없습니다." },
    ]);
    expect(failed.failures[`item:${ITEM.issue}`]).toBe("권한이 없습니다.");
    expect(failed.pendingItems[ITEM.issue]).toEqual({ included: false });

    const retried = reduceEdits(failed, {
      type: "edit-item",
      itemId: ITEM.issue,
      edit: { included: true },
    });
    expect(retried.failures).toEqual({});
  });

  it("effectiveItem 은 미저장 편집을 얹은 값을 준다", () => {
    const item = sampleReview().items[1];
    const state = apply([{ type: "edit-item", itemId: item.itemId, edit: { content: "고침" } }]);
    expect(effectiveItem(state, item).content).toBe("고침");
    expect(effectiveItem(initialEdits(4), item)).toBe(item);
  });
});

describe("edits-store", () => {
  it("되찾을 때 저장 중 표시는 비우고 편집·충돌은 남긴다", async () => {
    const { clearEdits, loadEdits, storeEdits } = await import("@/lib/notes/meeting-review/edits-store");
    const state = apply([
      { type: "edit-item", itemId: ITEM.decision, edit: { content: "고침" } },
      { type: "saving", key: `item:${ITEM.decision}` },
    ]);
    storeEdits("note-1", state);
    const restored = loadEdits("note-1")!;
    expect(restored.saving.size).toBe(0);
    expect(restored.pendingItems[ITEM.decision]).toEqual({ content: "고침" });
    clearEdits("note-1");
    expect(loadEdits("note-1")).toBeUndefined();
  });
});
