import { describe, expect, it } from "vitest";

import { CONTEXT_SNAPSHOT } from "@/lib/mocks/proposals";
import { selectContextSnapshot } from "@/lib/notes/proposals/select";

describe("selectContextSnapshot", () => {
  const ok = {
    status: 200 as const,
    data: { success: true, data: CONTEXT_SNAPSHOT, error: null },
    headers: new Headers(),
  };

  it("두 겹 봉투를 벗겨 snapshot 을 낸다", () => {
    const snapshot = selectContextSnapshot(ok as never);
    expect(snapshot.proposals).toHaveLength(CONTEXT_SNAPSHOT.proposals.length);
    expect(snapshot.runs).toHaveLength(CONTEXT_SNAPSHOT.runs.length);
  });

  it("한 겹만 벗기면 안 된다 — 바깥 봉투는 snapshot 이 아니다", () => {
    expect(() =>
      selectContextSnapshot({
        ...ok,
        data: { ...ok.data, data: ok.data },
      } as never)
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
      ).toThrow(/Unexpected proposals response/);
    }
  });

  it("계약을 어긴 성공 응답도 던진다 — 화면이 조용히 비는 것보다 낫다", () => {
    expect(() =>
      selectContextSnapshot({
        ...ok,
        data: {
          success: true,
          data: { proposals: [{}], runs: [] },
          error: null,
        },
      } as never)
    ).toThrow();
  });
});
