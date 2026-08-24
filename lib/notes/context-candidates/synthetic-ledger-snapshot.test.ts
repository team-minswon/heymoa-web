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
 * **이 파일의 수치를 실사용 전사 품질 증거로 인용하지 않는다.** 후보 8건이나 그 recall 은
 * 합성 대본에 대한 값이라, 실제 회의에서 무엇이 잡히고 무엇이 빠지는지를 말해 주지 않는다.
 * 그 판정은 AWS 실전사 gate 가 따로 내린다 — 여기서 미리 답한 것으로 치면 안 된다.
 *
 * ## 왜 그래도 필요한가
 *
 * **직접 쓴 픽스처는 내가 아는 것만 담는다.** 계약을 오해했으면 픽스처도 같이 틀리고
 * 테스트는 통과한다. 그 눈먼 자리를 덮는 것이 이 파일의 값어치다.
 *
 * 출처는 `context_candidates` · `context_candidate_revisions` ·
 * `context_candidate_evidence` · `context_classification_runs` 를 조회 계약 모양으로
 * 꺼낸 것이다. 갱신하려면 lane 을 다시 돌린 뒤 같은 조회로 픽스처를 덮어쓴다.
 */
describe("server 가 적재한 원장 — 합성 108발화 입력", () => {
  const parsed = contextCandidateSnapshotSchema.parse(ledger);
  const state = reduceContextEvent(initialContextState, {
    type: "snapshot",
    ...parsed,
  } as never);
  const cards = selectCards(state);

  it("실제 wire 가 계약 파서를 지난다", () => {
    // `.parse` 가 위에서 이미 던졌을 것이다. 여기서는 모양을 확인한다.
    expect(parsed.candidates).toHaveLength(8);
    expect(parsed.appliedRanges).toHaveLength(12);
  });

  it("createdSequence 오름차순으로 선다", () => {
    expect(cards.map((c) => c.createdSequence)).toEqual([
      15, 28, 29, 31, 67, 77, 78, 85,
    ]);
  });

  /**
   * **개정은 카드를 늘리지 않는다.** `31` 번은 TTL 을 60 → 120 → 90 으로 두 번 고친
   * 후보라 revision 이 5 인데, 화면에는 최신 하나로 선다. 개정마다 카드가 쌓이면
   * 사용자가 폐기된 값을 현재 결정으로 읽는다.
   */
  it("개정이 카드를 늘리지 않고 제자리에서 바뀐다", () => {
    const amended = cards.find((c) => c.createdSequence === 31);
    expect(amended?.revision).toBe(5);
    expect(amended?.content).toContain("90초");
    // 폐기된 값이 남아 있으면 안 된다.
    expect(cards.filter((c) => c.createdSequence === 31)).toHaveLength(1);
    expect(cards.some((c) => c.content.includes("120초"))).toBe(false);
  });

  it("철회된 둘이 열린 여섯과 구분된다", () => {
    const closed = cards.filter((c) => c.status === "CLOSED");
    expect(closed).toHaveLength(2);
    expect(closed.every((c) => c.closeReason === "RETRACTED")).toBe(true);
    expect(cards.filter((c) => c.status === "OPEN")).toHaveLength(6);
  });

  /**
   * **여기가 이 파일의 핵심이다.**
   *
   * 이 대본에서 모델 출력 26건이 버려졌다(적용 19). 그런데
   * watermark 는 108 까지 완주했으므로 **범위만 보면 빈 곳이 거의 없다.**
   *
   * 12구간 중 9구간이 `PARTIAL_RECORDED` 다. 이것을 `APPLIED` 와 같이 그리면 화면은
   * 「다 정리됨」이라고 말하고, 사용자는 그것을 「빠진 게 없음」으로 읽는다. 빈 화면보다
   * 나쁘다 — 안심시키는 거짓말이기 때문이다.
   */
  it("덜 실린 구간을 「읽었다」로 그리지 않는다", () => {
    const warned = state.appliedRanges.filter(isSaturated);
    expect(warned).toHaveLength(9);

    // 포화 flag 만 봤다면 거의 아무것도 못 잡는다 — 그래서 applyStatus 가 필요했다.
    const bySaturationOnly = state.appliedRanges.filter(
      (r) => r.rawDeltaSaturated || r.semanticUnitSaturated
    );
    expect(bySaturationOnly.length).toBeLessThan(warned.length);
  });

  /**
   * `16..24` 는 유일한 출력이 `INVALID_LINE_SOURCE` 로 떨어져 `REJECTED_OUTPUT` 이 된
   * 배치다. 그 구간은 `appliedRanges` 에 안 들어오므로 **구멍으로 정직하게 보인다.**
   */
  it("적용되지 못한 배치가 범위 구멍으로 남는다", () => {
    const gaps = findCoverageGaps(state.appliedRanges);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ fromSequence: 16, toSequence: 24 });
  });

  it("갱신 시각이 서버 값에서 온다", () => {
    expect(state.lastBatchAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  /**
   * **환각이 없다는 것도 화면 판정에 든다.** 8건 모두 근거 전사를 달고 있어야 각주를
   * 따라갈 수 있다. 근거가 빈 카드는 사용자가 출처를 확인할 방법이 없다.
   */
  it("모든 카드가 근거 전사를 달고 있다", () => {
    expect(cards.every((c) => c.evidence.length >= 1)).toBe(true);
  });
});
