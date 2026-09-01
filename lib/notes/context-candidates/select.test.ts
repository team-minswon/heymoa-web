import { describe, expect, it } from "vitest";

import { CONTEXT_SNAPSHOT } from "@/lib/mocks/context-candidates";
import { selectContextSnapshot } from "@/lib/notes/context-candidates/select";

/**
 * **생성 훅의 반환 타입과 런타임 동작이 어긋난다.** 타입은 200·401·404 의 union 인데
 * `apiFetch` 가 non-ok 를 던지므로 실패는 `select` 에 안 온다.
 *
 * 그 어긋남을 방치하면 `parse(unknown)` 이 union 을 통째로 삼켜서 **타입이 거짓말을 해도
 * 컴파일이 통과한다.** 여기서 「성공 봉투만 파싱한다」를 런타임으로 못박는다.
 */
describe("selectContextSnapshot", () => {
  const ok = {
    status: 200 as const,
    data: { success: true, data: CONTEXT_SNAPSHOT, error: null },
    headers: new Headers(),
  };

  it("두 겹 봉투를 벗겨 snapshot 을 낸다", () => {
    const snapshot = selectContextSnapshot(ok as never);
    expect(snapshot.candidates).toHaveLength(
      CONTEXT_SNAPSHOT.candidates.length
    );
    expect(snapshot.appliedRanges).toHaveLength(
      CONTEXT_SNAPSHOT.appliedRanges.length
    );
  });

  it("한 겹만 벗기면 안 된다 — 바깥 봉투는 snapshot 이 아니다", () => {
    // `response.data` 를 그대로 파싱하면 `candidates` 가 없어 실패해야 한다.
    // 이 단언이 깨진다는 것은 스키마가 너무 관대해졌다는 뜻이다.
    expect(() =>
      selectContextSnapshot({ ...ok, data: { ...ok.data, data: ok.data } } as never)
    ).toThrow();
  });

  it("성공이 아닌 응답은 파싱하지 않고 던진다", () => {
    for (const status of [401, 404]) {
      expect(() =>
        selectContextSnapshot({
          status,
          data: { success: false, data: null, error: { code: "X" } },
          headers: new Headers(),
        } as never)
      ).toThrow(/후보 조회 응답/);
    }
  });

  it("계약을 어긴 성공 응답도 던진다 — 화면이 조용히 비는 것보다 낫다", () => {
    expect(() =>
      selectContextSnapshot({
        ...ok,
        data: { success: true, data: { candidates: [{}], appliedRanges: [] }, error: null },
      } as never)
    ).toThrow();
  });
});
