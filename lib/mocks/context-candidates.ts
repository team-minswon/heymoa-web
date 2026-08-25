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
 * 후보 조회가 **실패하는** 노트. 「분석이 실패해도 전사 확인과 회의 종료가 계속된다」를
 * e2e 로 지키는 자리다 — 실패를 재현할 수 없으면 그 완료 판단은 말로만 남는다.
 */
export const CONTEXT_FAILING_NOTE_ID = "01K0000000006";

/**
 * **server 가 실제로 적재한 원장을 그대로 그리는 노트.**
 *
 * 다른 목은 전부 손으로 쓴 것이라 **내가 아는 것만 담습니다** — 계약을 오해했으면 목도
 * 같이 틀리고 화면은 멀쩡해 보입니다. 이 노트는 그 눈먼 자리를 덮습니다.
 *
 * **입력은 합성 시나리오 108발화이고 실사용자 전사가 아닙니다.** 그것을 lane 에 태워
 * server 가 낸 결과가 `__fixtures__/synthetic-ledger-snapshot.json` 입니다. 즉 **wire 는
 * 진짜이고 회의 내용은 합성**입니다 — 이 수치를 실사용 품질 근거로 인용하지 않습니다.
 *
 * 픽스처와 그 한계는 `lib/notes/context-candidates/synthetic-ledger-snapshot.test.ts` 가
 * 설명합니다.
 */
export const CONTEXT_SYNTHETIC_LEDGER_NOTE_ID = "01K0000000007";

/**
 * **살아 있는 발화 하나.** partial 두 프레임과 그것을 걷는 final 하나다.
 *
 * 이걸 두는 이유는 **Playwright 경로가 final 만 지나고 있었기 때문**이다. partial 렌더는
 * jsdom 컴포넌트 테스트로만 덮여 있어서, 서버가 옛 partial 모양(누적 `text` 한 덩어리)을
 * 보내도 브라우저 경로의 어느 테스트도 안 깨졌다. 그 경우 web 은 파싱에서 던지고 그 예외는
 * `note-topic-client` 가 삼키므로, **증상이 「연결이 죽었다」가 아니라 「받아쓰기가 통째로
 * 안 보인다」**가 된다 — 화면도 콘솔도 조용하다.
 *
 * 문장은 `db.ts` 가 이미 심어 둔 것을 그대로 쪼갰다. 새 문구를 만들지 않는다.
 *
 * | 프레임 | 확정 | 미확정 | 화면 |
 * |---|---|---|---|
 * | 1 | (없음) | `다음 주까지` | 미확정만 |
 * | 2 | `다음 주까지` | ` 사용자 테스트를 진행합니다.` | **둘 다** |
 * | final | — | — | 둘 다 걷힘 |
 *
 * 둘째 프레임이 핵심이다. 서버가 두 토막을 이어 붙인 문자열 하나로 보내면 확정 토막이
 * 영영 안 생겨서 그 순간이 안 온다.
 */
export const LIVE_UTTERANCE = {
  transcriptionSessionId: "01K0000000010",
  utteranceId: "0HZX2K7M9QP01",
  segmentId: "0HZX2K7M9QP02",
  sequence: 1,
  startedAtMs: 0,
  endedAtMs: 2_400,
  confirmed: "다음 주까지",
  pending: " 사용자 테스트를 진행합니다.",
} as const;

export const LIVE_UTTERANCE_TEXT = `${LIVE_UTTERANCE.confirmed}${LIVE_UTTERANCE.pending}`;

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
        endedAtMs: evidenceAtMs + 4_000,
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

/**
 * **커버리지 행이 «교체»되는 노트.** 개수는 그대로인데 종류가 바뀌는 전이를 만든다.
 *
 * | | 범위 | 구멍 | 포화 | 행 수 |
 * |---|---|---|---|---|
 * | 처음 | `1..8` · `17..24` | `9..16` 하나 | 없음 | **1** |
 * | batch 뒤 | `9..16`(포화)가 채움 | 없음 | 하나 | **1** |
 *
 * 행 수가 1로 유지되므로 **개수만 세는 추종 키는 이 전이를 못 본다.** 두 행은 높이가
 * 달라서(구멍 행에는 안내 문구가 한 줄 더 붙는다) 추종하던 독자가 그 차이만큼 밀린다.
 */
export const CONTEXT_SWAP_NOTE_ID = "01K0000000008";

export const CONTEXT_SWAP_RANGES: AppliedRange[] = [
  range("swap-1", 1, 8),
  range("swap-3", 17, 24),
];

/** 구멍을 채우면서 포화로 들어온다 — 구멍 행이 사라지고 포화 행이 생긴다. */
export const CONTEXT_SWAP_FILL: AppliedRange = range("swap-2", 9, 16, {
  rawDeltaSaturated: true,
});

/** batch 가 적용된 뒤 서버가 돌려주는 범위. 재조회가 화면을 되돌리지 않게 한다. */
export const CONTEXT_SWAP_FILLED: AppliedRange[] = [
  CONTEXT_SWAP_RANGES[0],
  CONTEXT_SWAP_FILL,
  CONTEXT_SWAP_RANGES[1],
];

/**
 * **REST 응답을 WS batch 에 묶는다.** batch 는 `invalidateContext()` 를 부르는데, 그
 * 재조회가 옛 범위를 돌려주면 화면이 구멍으로 되돌아가 전이가 안 보인다.
 *
 * 요청 횟수로 가르면 안 된다 — SSR 도 같은 핸들러를 지나고 모듈 상태가 dev 서버 수명 동안
 * 남아서, 첫 화면부터 채워진 채로 뜬다(실제로 그렇게 됐다). **batch 를 보낸 사실**만이
 * 옳은 기준이다.
 */
let swapFilled = false;
export const markSwapFilled = () => {
  swapFilled = true;
};
export const resetSwapFill = () => {
  swapFilled = false;
};
export const isSwapFilled = () => swapFilled;

export const CONTEXT_SWAP_SNAPSHOT = {
  candidates: [],
  appliedRanges: CONTEXT_SWAP_RANGES,
};

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
