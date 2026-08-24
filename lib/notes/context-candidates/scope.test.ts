import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  contextCandidateHeadSchema,
  contextCandidateSnapshotSchema,
} from "@/lib/notes/context-candidates/contract";

/**
 * **v1 범위를 고정한다.**
 *
 * APP-458 최종 합의에서 기각 목록·사유·저장·조회가 v1에서 빠졌다. 그런데 draft 계약이
 * 관대해진 뒤로는(`contract.test.ts` 참조) server가 그런 필드를 실어 보내도 파싱이 안
 * 깨진다 — **조용히 들어와서 조용히 화면에 붙을 수 있다.**
 *
 * 그래서 「안 만들었다」를 주석이 아니라 테스트로 둔다. 나중에 누군가 기각 UI를 붙이면
 * 여기가 먼저 빨개져서 「그건 v1 밖이다」를 다시 확인하게 된다.
 *
 * 선례는 `lib/design-tokens.test.ts`다 — 존재/부재를 소스에서 직접 지킨다.
 */

const ROOT = join(__dirname, "..", "..", "..");

function read(relative: string) {
  return readFileSync(join(ROOT, relative), "utf8");
}

/** 기각 표면을 만들면 반드시 지나갈 이름들. 주석은 걸리지 않게 코드만 본다. */
const REJECTION_IDENTIFIERS = [
  "rejectedCandidates",
  "rejectionReason",
  "rejectedReason",
  "rejections",
  "dismissedCandidates",
];

const CONTEXT_SOURCES = [
  "lib/notes/context-candidates/contract.ts",
  "lib/notes/context-candidates/reducer.ts",
  "lib/notes/context-candidates/timeline.ts",
  "lib/notes/context-candidates/api.ts",
  "lib/notes/context-candidates/query-keys.ts",
  "components/notes/context-rail.tsx",
  "components/notes/context-candidate-card.tsx",
  "components/notes/context-coverage-row.tsx",
];

describe("v1 범위 — 기각 표면은 없다", () => {
  it("맥락 후보 모듈 어디에도 기각 식별자가 없다", () => {
    const offenders: string[] = [];
    for (const path of CONTEXT_SOURCES) {
      const source = read(path);
      for (const identifier of REJECTION_IDENTIFIERS) {
        if (source.includes(identifier)) offenders.push(`${path}: ${identifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("계약 스키마가 기각 필드를 알지 못한다", () => {
    // 관대해졌으므로 **파싱은 통과하되 그 값이 살아남지 않아야** 한다.
    const parsed = contextCandidateSnapshotSchema.parse({
      candidates: [],
      appliedRanges: [],
      rejectedCandidates: [{ candidateId: "0HZX2K7M9Q4A1", reason: "없는 내용" }],
    });

    expect(parsed).not.toHaveProperty("rejectedCandidates");
    expect(Object.keys(parsed).sort()).toEqual(["appliedRanges", "candidates"]);
  });

  it("후보 head 의 필드 집합이 합의된 것뿐이다", () => {
    // 필드가 늘면 여기가 먼저 깨진다 — 계약 변경을 사람이 한 번 보게 하는 자리다.
    expect(Object.keys(contextCandidateHeadSchema.shape).sort()).toEqual([
      "aiSemanticRevisionCount",
      "candidateId",
      "closeReason",
      "content",
      "createdSequence",
      "evidence",
      "kind",
      "lastEvidenceSequence",
      "operation",
      "resolvesCandidateId",
      "revision",
      "revisionSource",
      "status",
    ]);
  });

  it("기각 조회를 위한 쿼리 키가 없다", () => {
    const keys = read("lib/notes/context-candidates/query-keys.ts");
    expect(keys).not.toMatch(/reject/i);
    // v1 조회 표면은 둘뿐이다 — snapshot 과 revision history.
    expect(keys.match(/export function/g)).toHaveLength(2);
  });
});
