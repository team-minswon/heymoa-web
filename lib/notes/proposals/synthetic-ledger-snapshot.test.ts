import { describe, expect, it } from "vitest";

import { proposalSnapshotSchema } from "@/lib/notes/proposals/contract";
import ledger from "@/lib/notes/proposals/__fixtures__/synthetic-ledger-snapshot.json";
import {
  initialContextState,
  reduceContextEvent,
  selectCards,
} from "@/lib/notes/proposals/reducer";

describe("server 가 적재한 원장 — 합성 108발화 입력", () => {
  const parsed = proposalSnapshotSchema.parse(ledger);
  const state = reduceContextEvent(initialContextState, {
    type: "snapshot",
    ...parsed,
  } as never);
  const cards = selectCards(state);

  it("실제 wire 가 계약 파서를 지난다", () => {
    expect(parsed.proposals.length).toBeGreaterThan(0);
    expect(parsed.runs.length).toBeGreaterThan(0);
  });

  it("createdSequence 오름차순으로 선다", () => {
    const sequences = cards.map((c) => c.createdSequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
  });

  it("개정이 카드를 늘리지 않고 제자리에서 바뀐다", () => {
    const ids = cards.map((c) => c.proposalId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(cards.some((c) => c.revision > 1)).toBe(true);
  });

  it("닫힌 후보를 감추지 않고 열린 것과 함께 싣는다", () => {
    const closed = cards.filter((c) => c.status === "CLOSED");
    expect(closed.every((c) => c.closeReason !== null)).toBe(true);
    expect(cards.length).toBe(
      closed.length + cards.filter((c) => c.status === "OPEN").length
    );
  });

  it("부분 반영·포화 정보는 화면 정책과 분리된 wire 사실로 보존한다", () => {
    const partial = state.runs.filter(
      (r) => r.applyStatus === "PARTIAL_RECORDED"
    );
    expect(partial.length).toBeGreaterThan(0);
    expect(
      state.runs.some((r) => r.rawDeltaSaturated || r.semanticUnitSaturated)
    ).toBe(true);
    expect(
      partial.some((r) => !r.rawDeltaSaturated && !r.semanticUnitSaturated)
    ).toBe(true);
  });

  it("갱신 시각이 서버 값에서 온다", () => {
    expect(state.lastBatchAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it("모든 카드가 근거 전사를 달고 있다", () => {
    expect(cards.every((c) => c.citations.length >= 1)).toBe(true);
  });
});
