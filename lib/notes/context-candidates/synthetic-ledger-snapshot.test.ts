import { describe, expect, it } from "vitest";

import { contextCandidateSnapshotSchema } from "@/lib/notes/context-candidates/contract";
import ledger from "@/lib/notes/context-candidates/__fixtures__/synthetic-ledger-snapshot.json";
import {
  findCoverageGaps,
  initialContextState,
  isSaturated,
  reduceContextEvent,
  selectCards,
} from "@/lib/notes/context-candidates/reducer";

/**
 * **손으로 쓴 픽스처가 아니라 server 가 실제로 적재한 원장이다.**
 *
 * ## 무엇이 진짜이고 무엇이 아닌가 — 먼저 읽을 것
 *
 * | | |
 * |---|---|
 * | 회의 내용(입력 108발화) | **합성 시나리오다.** 실사용자 전사가 아니다 |
 * | 원장(이 픽스처) | **진짜다.** server 가 lane 을 돌려 DB 에 적재한 결과다 |
 *
 * 그래서 이 파일이 지키는 것은 **wire 적합성**이다 — server 가 실제로 내는 모양이 내
 * 파서를 지나는지, 그 데이터로 화면이 무엇을 말하는지. **모델 품질의 근거가 아니다.**
 *
 * **이 파일의 수치를 실사용 전사 품질 증거로 인용하지 않는다.** 그 판정은 AWS 실전사
 * gate 가 따로 낸다 — 여기서 미리 답한 것으로 치면 안 된다.
 *
 * ## 개수를 박지 않는다
 *
 * **같은 대본을 다시 흘리면 결과가 달라진다.** 실측으로 확인됐다 — 후보가 8건에서 9건이
 * 되고 kind 구성도 바뀌었다(`ACTION_ITEM` 1 → 0, `INSIGHT` 0 → 1). 모델 호출이 결정적이
 * 아니기 때문이다.
 *
 * 그래서 **기대값을 픽스처에서 유도한다.** `toHaveLength(8)` 처럼 박아 두면 픽스처를
 * 재생성하는 순간 web 결함과 무관하게 빨개지고, 그 빨강은 아무것도 안 알려 준다. 여기서
 * 지키는 것은 개수가 아니라 **불변식**이다 — 순서가 오름차순인가, 개정이 카드를 늘리지
 * 않는가, 덜 실린 구간이 경고로 서는가.
 *
 * 출처는 `context_candidates` · `context_candidate_revisions` ·
 * `context_candidate_evidence` · `context_classification_runs` 를 조회 계약 모양으로
 * 꺼낸 것이다. 갱신하려면 lane 을 다시 돌린 뒤 같은 조회로 픽스처를 덮어쓴다 —
 * **개수가 달라져도 이 파일은 안 고쳐도 된다.**
 *
 * 그 말을 실제로 확인했다. 같은 대본의 **2회차 원장**(후보 9 · 범위 11 · `ACTION_ITEM`
 * 0건 · `INSIGHT` 1건)으로 픽스처를 갈아 끼우고 이 파일과 짝 e2e 를 그대로 돌렸더니
 * 13개 단언이 전부 통과했다. 개수·kind 구성이 달라도 불변식은 그대로다.
 */
describe("server 가 적재한 원장 — 합성 108발화 입력", () => {
  const parsed = contextCandidateSnapshotSchema.parse(ledger);
  const state = reduceContextEvent(initialContextState, {
    type: "snapshot",
    ...parsed,
  } as never);
  const cards = selectCards(state);

  it("실제 wire 가 계약 파서를 지난다", () => {
    // `.parse` 가 위에서 이미 던졌을 것이다. 빈 원장으로 통과하는 것만 막는다.
    expect(parsed.candidates.length).toBeGreaterThan(0);
    expect(parsed.appliedRanges.length).toBeGreaterThan(0);
  });

  it("createdSequence 오름차순으로 선다", () => {
    const sequences = cards.map((c) => c.createdSequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
  });

  /**
   * **개정은 카드를 늘리지 않는다.** 이 원장에는 TTL 을 60 → 120 → 90 으로 두 번 고쳐
   * revision 이 여러 번 오른 후보가 있다. 개정마다 카드가 쌓이면 사용자가 폐기된 값을
   * 현재 결정으로 읽는다.
   */
  it("개정이 카드를 늘리지 않고 제자리에서 바뀐다", () => {
    const ids = cards.map((c) => c.candidateId);
    expect(new Set(ids).size).toBe(ids.length);
    // 원장에 개정된 후보가 실제로 있어야 이 검사가 의미를 갖는다.
    expect(cards.some((c) => c.revision > 1)).toBe(true);
  });

  it("닫힌 후보를 감추지 않고 열린 것과 함께 싣는다", () => {
    // 철회를 걸러내면 무엇이 취소됐는지가 화면에서 사라진다.
    const closed = cards.filter((c) => c.status === "CLOSED");
    expect(closed.every((c) => c.closeReason !== null)).toBe(true);
    expect(cards.length).toBe(
      closed.length + cards.filter((c) => c.status === "OPEN").length
    );
  });

  /**
   * **여기가 이 파일의 핵심이다.**
   *
   * watermark 가 끝까지 전진하면 **범위만 보면 빈 곳이 거의 없다.** 그런데 그중 상당수가
   * `PARTIAL_RECORDED` — 출력 일부가 기록되지 못한 구간이다. 이것을 `APPLIED` 와 같이
   * 그리면 화면은 「다 정리됨」이라고 말하고, 사용자는 그것을 「빠진 게 없음」으로 읽는다.
   * 빈 화면보다 나쁘다 — 안심시키는 거짓말이기 때문이다.
   */
  it("덜 실린 구간을 「읽었다」로 그리지 않는다", () => {
    const partial = state.appliedRanges.filter(
      (r) => r.applyStatus === "PARTIAL_RECORDED"
    );
    // 이 원장에 그런 구간이 실제로 있어야 검사가 성립한다.
    expect(partial.length).toBeGreaterThan(0);

    // 전부 경고로 서야 한다 — 하나라도 빠지면 그 구간이 「정리 완료」로 보인다.
    expect(partial.every((r) => isSaturated(r))).toBe(true);

    // 포화 flag 만 봤다면 놓쳤을 구간이 실제로 있다 — 그래서 applyStatus 가 필요했다.
    const missedBySaturationOnly = partial.filter(
      (r) => !r.rawDeltaSaturated && !r.semanticUnitSaturated
    );
    expect(missedBySaturationOnly.length).toBeGreaterThan(0);
  });

  /**
   * 적용되지 못한 배치(`REJECTED_OUTPUT`)는 `appliedRanges` 에 안 들어오므로 **구멍으로
   * 정직하게 보인다.** 구멍이 범위 사이에만 생기는지도 함께 본다.
   */
  it("범위 구멍이 실제 빈 구간과 맞는다", () => {
    const sorted = [...state.appliedRanges].sort(
      (a, b) => a.fromSequence - b.fromSequence
    );
    const expected = sorted.flatMap((range, i) => {
      const previous = sorted[i - 1];
      if (!previous || range.fromSequence <= previous.toSequence + 1) return [];
      return [
        { fromSequence: previous.toSequence + 1, toSequence: range.fromSequence - 1 },
      ];
    });
    expect(
      findCoverageGaps(state.appliedRanges).map(
        ({ fromSequence, toSequence }) => ({ fromSequence, toSequence })
      )
    ).toEqual(expected);
  });

  it("갱신 시각이 서버 값에서 온다", () => {
    expect(state.lastBatchAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  /**
   * **근거가 없으면 출처를 확인할 방법이 없다.** 각주를 따라가는 것이 이 레일의 핵심
   * 기능이라, 근거 빈 카드가 하나라도 있으면 그 카드는 사용자가 검증할 수 없다.
   */
  it("모든 카드가 근거 전사를 달고 있다", () => {
    expect(cards.every((c) => c.evidence.length >= 1)).toBe(true);
  });
});
