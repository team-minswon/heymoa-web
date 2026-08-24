import type {
  AppliedRange,
  ContextCandidateHead,
} from "@/lib/notes/context-candidates/contract";

/**
 * 맥락 후보 목 시나리오.
 *
 * **주기를 실제에 맞춘다.** 분류 배치는 자주 돌지만 대부분 사건을 0건 낸다. 사건이 드물게
 * 오는 것이 정상 화면이므로 목이 그것을 재현해야 한다 — 카드가 몇 초마다 쏟아지는 목을
 * 만들면 실제로는 못 볼 화면을 보고 레이아웃을 정하게 된다.
 *
 * 무작위를 쓰지 않는다. 이 파일의 값은 전부 고정이다.
 *
 * 담은 것 넷:
 * - 결정·안건·질의응답·보고·할 일 — v1 kind만. **논의안은 없다**(계약에 없다)
 * - `AMEND` — 같은 카드가 제자리에서 바뀌는 경로
 * - `RESOLVE` — 질문 1장이 닫히고 결과 1장이 열리는 원자 도착
 * - `RETRACT` — 철회. 취소선으로 남는다
 * - `appliedRanges`의 **구멍 하나**와 **포화 구간 하나**
 */

/**
 * 후보 피드를 흘리는 전용 노트. e2e가 쓰는 `01K0000000002`와 갈라 둔다 — 그 노트에 함께
 * 흘렸더니 공유 챗 폴링이 굶어 테스트가 깨졌다.
 */
export const CONTEXT_DEMO_NOTE_ID = "01K0000000005";

/**
 * 목 회의의 시작 벽시계. 페이지를 열 때를 기준으로 42분짜리 회의가 방금 끝난 것처럼 둔다 —
 * 고정 날짜를 박으면 갱신 띠가 늘 「몇 년 전」이 된다.
 */
const MOCK_MEETING_STARTED_AT = Date.now() - 2_600_000;

const SEGMENT = (n: number) => `0HZX2K7M9Q${String(n).padStart(3, "0")}`;
const CANDIDATE = (n: number) => `0HZX2K7M9QA${String(n).padStart(2, "0")}`;
export const CONTEXT_EVENT_ID = (n: number) =>
  `0HZX2K7M9QE${String(n).padStart(2, "0")}`;

function head(
  over: Partial<ContextCandidateHead> & {
    candidateId: string;
    kind: ContextCandidateHead["kind"];
    content: string;
    createdSequence: number;
    evidenceAtMs: number;
  }
): ContextCandidateHead {
  const { evidenceAtMs, ...rest } = over;
  return {
    revision: 1,
    operation: "CREATE",
    status: "OPEN",
    closeReason: null,
    revisionSource: "LIVE",
    lastEvidenceSequence: over.createdSequence,
    aiSemanticRevisionCount: 0,
    resolvesCandidateId: null,
    evidence: [
      {
        segmentId: SEGMENT(over.createdSequence),
        sequence: over.createdSequence,
        startedAtMs: evidenceAtMs,
        text: "…",
        role: "SUPPORTS",
      },
    ],
    ...rest,
  };
}

/** 시간이 흐르며 도착하는 순서대로. 각 항목의 `atMs`는 회의 경과 시각이다. */
export const CONTEXT_TIMELINE: Array<{
  atMs: number;
  candidate: ContextCandidateHead;
}> = [
  {
    atMs: 242_000,
    candidate: head({
      candidateId: CANDIDATE(1),
      kind: "AGENDA",
      content: "MongoDB 도입 검토",
      createdSequence: 24,
      evidenceAtMs: 242_000,
    }),
  },
  {
    atMs: 620_000,
    candidate: head({
      candidateId: CANDIDATE(2),
      kind: "QUESTION",
      content: "인덱스를 줄이면 조회 손해가 얼마나 되나",
      createdSequence: 62,
      evidenceAtMs: 620_000,
    }),
  },
  {
    atMs: 1_002_000,
    candidate: head({
      candidateId: CANDIDATE(3),
      kind: "STATUS_REPORT",
      content: "스테이징 이관은 지난주에 끝났다",
      createdSequence: 100,
      evidenceAtMs: 1_002_000,
    }),
  },
  {
    atMs: 1_190_000,
    candidate: head({
      candidateId: CANDIDATE(4),
      kind: "ACTION_ITEM",
      content: "인덱스 벤치마크 수치는 금요일까지 정리",
      createdSequence: 119,
      evidenceAtMs: 1_190_000,
    }),
  },
  // 같은 카드가 제자리에서 바뀐다. 목록 아래로 튀면 안 된다.
  {
    atMs: 1_310_000,
    candidate: head({
      candidateId: CANDIDATE(4),
      kind: "ACTION_ITEM",
      content: "인덱스 벤치마크 수치는 금요일까지 정리 · 담당 한지원",
      createdSequence: 119,
      evidenceAtMs: 1_190_000,
      revision: 2,
      operation: "AMEND",
      aiSemanticRevisionCount: 1,
      lastEvidenceSequence: 131,
    }),
  },
  // RESOLVE — 질문이 닫히고 결과가 열린다. 둘이 한 배치에 온다.
  {
    atMs: 1_640_000,
    candidate: head({
      candidateId: CANDIDATE(2),
      kind: "QUESTION",
      content: "인덱스를 줄이면 조회 손해가 얼마나 되나",
      createdSequence: 62,
      evidenceAtMs: 620_000,
      revision: 2,
      operation: "RESOLVE",
      status: "CLOSED",
      closeReason: "RESOLVED",
      aiSemanticRevisionCount: 1,
      lastEvidenceSequence: 164,
    }),
  },
  {
    atMs: 1_640_000,
    candidate: head({
      candidateId: CANDIDATE(5),
      kind: "STATUS_REPORT",
      content: "조회 손해는 15% 안쪽으로 측정됐다",
      createdSequence: 164,
      evidenceAtMs: 1_640_000,
      operation: "RESOLVE",
      resolvesCandidateId: CANDIDATE(2),
    }),
  },
  {
    atMs: 1_872_000,
    candidate: head({
      candidateId: CANDIDATE(6),
      kind: "DECISION",
      content: "경로 데이터 저장소는 MongoDB를 사용한다",
      createdSequence: 187,
      evidenceAtMs: 1_872_000,
    }),
  },
  // 철회. 카드가 사라지지 않고 취소선으로 남는다.
  {
    atMs: 2_101_000,
    candidate: head({
      candidateId: CANDIDATE(1),
      kind: "AGENDA",
      content: "MongoDB 도입 검토",
      createdSequence: 24,
      evidenceAtMs: 242_000,
      revision: 2,
      operation: "RETRACT",
      status: "CLOSED",
      closeReason: "RETRACTED",
      aiSemanticRevisionCount: 1,
      lastEvidenceSequence: 210,
    }),
  },
  {
    atMs: 2_480_000,
    candidate: head({
      candidateId: CANDIDATE(7),
      kind: "ISSUE",
      content: "장애 대응 runbook이 비어 있다",
      createdSequence: 248,
      evidenceAtMs: 2_480_000,
    }),
  },
];

function range(
  runKey: string,
  fromSequence: number,
  toSequence: number,
  over: Partial<AppliedRange> = {}
): AppliedRange {
  return {
    runKey,
    applyStatus: "APPLIED",
    fromSequence,
    toSequence,
    fromStartedAtMs: fromSequence * 10_000,
    toEndedAtMs: toSequence * 10_000,
    rawDeltaSaturated: false,
    semanticUnitSaturated: false,
    // **회의 경과 ms를 절대 시각으로 쓰면 안 된다.** `new Date(600_000)`은 1970년이라
    // 갱신 띠가 「490000시간 전」이 된다. 계약의 `appliedAt`은 서버가 적용한 UTC 벽시계다.
    appliedAt: new Date(
      MOCK_MEETING_STARTED_AT + toSequence * 10_000
    ).toISOString(),
    ...over,
  };
}

/**
 * 적용 범위. **`124..170`이 비어 있다** — 그 구간이 화면에서 「읽지 못한 구간」이 된다.
 * `run-4`는 포화라 「더 있을 수 있어요」가 붙는다.
 */
export const CONTEXT_APPLIED_RANGES: AppliedRange[] = [
  range("run-1", 1, 60),
  range("run-2", 61, 123),
  range("run-4", 171, 200, { rawDeltaSaturated: true }),
  range("run-5", 201, 260),
];

export const CONTEXT_SNAPSHOT = {
  candidates: (() => {
    // 타임라인의 마지막 revision 만 head 다.
    const byId = new Map<string, ContextCandidateHead>();
    for (const entry of CONTEXT_TIMELINE) {
      const current = byId.get(entry.candidate.candidateId);
      if (!current || entry.candidate.revision >= current.revision) {
        byId.set(entry.candidate.candidateId, entry.candidate);
      }
    }
    return [...byId.values()].sort(
      (a, b) => a.createdSequence - b.createdSequence
    );
  })(),
  appliedRanges: CONTEXT_APPLIED_RANGES,
};
