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
 * 담은 것:
 * - **kind 일곱 전부.** 「참고」가 보고만으로 채워지면 인사이트가 화면에 한 번도 안 뜬다
 * - **operation 다섯 전부** — `CREATE`·`AMEND`·`CORRECT`·`RETRACT`·`RESOLVE`
 * - `RESOLVE` — 질문 1장이 닫히고 결과 1장이 열리는 원자 도착
 * - **답을 기다리는 질문** — 열린 질문이 정상 상태다. 닫힌 것만 담으면 「답 대기」를 못 본다
 * - **근거 2개** — 전사 시각이 「전사 A · B」로 늘어나는 경로
 *
 * **근거 0개는 담지 않는다.** 계약의 `z.array` 가 빈 배열을 막지 않아 한때 목에 넣었지만,
 * 실서버 산출물(`__fixtures__/synthetic-ledger-snapshot.json`)은 8건 전부 1~2개이고
 * `lastEvidenceSequence` 도 `min(1)` 이다 — 근거가 있다는 전제의 계약이다. 목이 그 상태를
 * 담으면 **전사 시각이 없는 카드**가 화면에 서서, 일어나지 않을 경우를 보고 레이아웃을
 * 정하게 된다. 화면이 그래도 안 깨지는지는 `context-rail.test.tsx` 가 지킨다.
 * - `appliedRanges`의 **구멍 하나**와 **포화 구간 하나**
 *
 * **세 필터가 각각 볼 만큼 있어야 한다.** 한 묶음이 한둘이면 그 화면의 리듬을 눈으로 못
 * 정한다 — 카드 하나짜리 목록은 어떤 간격을 줘도 괜찮아 보인다.
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
    /**
     * 근거로 실린 **실제 발화**. 문자열 하나면 근거 한 줄, 배열이면 그 수만큼이고 빈 배열은
     * 근거 없는 후보다.
     *
     * **`"…"` 같은 자리표시자를 쓰지 않는다.** 근거를 펼쳤을 때 줄이 어디서 감기는지,
     * 긴 발화와 짧은 발화가 섞이면 목록이 어떤 리듬이 되는지를 화면에서 봐야 하는데
     * 한 글자짜리 자리표시자로는 그게 전부 감춰진다 — 전부 같은 높이로 곱게 선다.
     */
    evidenceText: string | readonly string[];
  }
): ContextCandidateHead {
  const { evidenceAtMs, evidenceText, ...rest } = over;
  const texts = typeof evidenceText === "string" ? [evidenceText] : evidenceText;
  return {
    revision: 1,
    operation: "CREATE",
    status: "OPEN",
    closeReason: null,
    revisionSource: "LIVE",
    lastEvidenceSequence: over.createdSequence,
    aiSemanticRevisionCount: 0,
    resolvesCandidateId: null,
    // 둘째 근거부터는 5 발화 뒤(50초 뒤)에 붙은 것으로 둔다 — 같은 사건을 두 번에 걸쳐
    // 말한 모양이다. 첫 근거는 주장을 받치고, 뒤는 조건을 단다.
    evidence: texts.map((text, index) => ({
      segmentId: SEGMENT(over.createdSequence + index * 5),
      sequence: over.createdSequence + index * 5,
      startedAtMs: evidenceAtMs + index * 50_000,
      endedAtMs: evidenceAtMs + index * 50_000 + 4_000,
      text,
      role: index === 0 ? "SUPPORTS" : "CONDITIONS",
    })),
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
      evidenceText: "스키마가 분기마다 바뀌는데 문서형으로 가는 게 맞는지 이번에 한 번 정리하고 갔으면 합니다",
    }),
  },
  // **인사이트.** 이 kind 가 한 건도 없어서 「참고」가 보고만으로 채워지고, 거터에서 가장
  // 긴 라벨(4자)이 화면에 한 번도 안 떴다 — 열 폭을 그 라벨로 잡아 놓고 눈으로 못 본 셈이다.
  {
    atMs: 380_000,
    candidate: head({
      candidateId: CANDIDATE(8),
      kind: "INSIGHT",
      content: "읽기 쏠림은 특정 시간대에만 생긴다",
      createdSequence: 38,
      evidenceAtMs: 380_000,
      evidenceText: "지표를 보면 오전 아홉 시하고 오후 여섯 시 앞뒤 삼십 분에만 몰려요",
    }),
  },
  // **답을 기다리는 질문.** 유일한 질문이 곧 RESOLVE 로 닫혀서 「답 대기」 문구가 어느
  // 화면에도 안 나온다 — 열린 질문이 정상 상태인데 목이 그것을 안 담고 있었다.
  {
    atMs: 512_000,
    candidate: head({
      candidateId: CANDIDATE(9),
      kind: "QUESTION",
      content: "샤딩 키를 바꾸면 마이그레이션이 얼마나 걸리나",
      createdSequence: 51,
      evidenceAtMs: 512_000,
      evidenceText: "샤딩 키를 바꾸면 재분배가 몇 시간짜리인지 재 본 사람 있나요",
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
      evidenceText: "인덱스를 절반으로 줄이면 조회가 얼마나 느려지는지가 관건입니다",
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
      evidenceText: "스테이징은 지난주 목요일에 넘겼고 지금 이틀째 돌고 있습니다",
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
      evidenceText: "벤치마크는 금요일까지 정리해서 올리겠습니다",
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
      evidenceText: "벤치마크는 금요일까지 정리해서 올리겠습니다",
      revision: 2,
      operation: "AMEND",
      aiSemanticRevisionCount: 1,
      lastEvidenceSequence: 131,
    }),
  },
  {
    atMs: 1_450_000,
    candidate: head({
      candidateId: CANDIDATE(10),
      kind: "ACTION_ITEM",
      content: "스테이징에 인덱스 변경 먼저 적용",
      createdSequence: 145,
      evidenceAtMs: 1_450_000,
      evidenceText: "인덱스 변경은 스테이징에 먼저 걸어 보고 운영에 올리시죠",
    }),
  },
  {
    atMs: 1_540_000,
    candidate: head({
      candidateId: CANDIDATE(3),
      kind: "STATUS_REPORT",
      content: "스테이징 이관은 지난주에 끝났다 · 남은 이슈 2건",
      createdSequence: 100,
      evidenceAtMs: 1_002_000,
      evidenceText: "스테이징은 지난주 목요일에 넘겼고 지금 이틀째 돌고 있습니다",
      revision: 2,
      operation: "AMEND",
      aiSemanticRevisionCount: 1,
      lastEvidenceSequence: 154,
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
      evidenceText: "인덱스를 절반으로 줄이면 조회가 얼마나 느려지는지가 관건입니다",
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
      evidenceText: "재 봤는데 최악이 십오 퍼센트 정도였고 평균은 그보다 훨씬 낮았습니다",
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
      evidenceText: "그럼 경로 데이터는 몽고디비로 가는 걸로 정리하겠습니다",
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
      evidenceText: "스키마가 분기마다 바뀌는데 문서형으로 가는 게 맞는지 이번에 한 번 정리하고 갔으면 합니다",
      revision: 2,
      operation: "RETRACT",
      status: "CLOSED",
      closeReason: "RETRACTED",
      aiSemanticRevisionCount: 1,
      lastEvidenceSequence: 210,
    }),
  },
  {
    atMs: 2_240_000,
    candidate: head({
      candidateId: CANDIDATE(11),
      kind: "INSIGHT",
      content: "장애의 절반이 배포 직후 30분에 몰린다",
      createdSequence: 224,
      evidenceAtMs: 2_240_000,
      evidenceText: "지난 분기 장애 티켓을 시간대로 찍어 보니 절반이 배포 직후 삼십 분 안에 났습니다",
    }),
  },
  // **근거가 둘인 후보.** 메타의 전사 시각이 「전사 A · B」로 늘어나는 경로다 — 하나짜리만
  // 있으면 그 줄이 길어졌을 때 메타가 어떻게 접히는지 볼 수 없다.
  {
    atMs: 2_310_000,
    candidate: head({
      candidateId: CANDIDATE(12),
      kind: "AGENDA",
      content: "다음 스프린트 범위",
      createdSequence: 231,
      evidenceAtMs: 2_310_000,
      evidenceText: [
        "다음 스프린트에 뭘 넣을지 오늘 대충이라도 잡고 가시죠",
        "다만 마이그레이션이 물리면 범위는 다시 봐야 합니다",
      ],
      lastEvidenceSequence: 236,
    }),
  },
  {
    atMs: 2_330_000,
    candidate: head({
      candidateId: CANDIDATE(11),
      kind: "INSIGHT",
      content: "장애의 절반이 배포 직후 30분에 몰린다 · 대부분 설정 변경",
      createdSequence: 224,
      evidenceAtMs: 2_240_000,
      evidenceText:
        "지난 분기 장애 티켓을 시간대로 찍어 보니 절반이 배포 직후 삼십 분 안에 났습니다",
      revision: 2,
      operation: "AMEND",
      aiSemanticRevisionCount: 1,
      lastEvidenceSequence: 233,
    }),
  },
  {
    atMs: 2_400_000,
    candidate: head({
      candidateId: CANDIDATE(13),
      kind: "DECISION",
      content: "읽기 전용 복제본은 두 대로 시작한다",
      createdSequence: 240,
      evidenceAtMs: 2_400_000,
      evidenceText: "복제본은 일단 최소로 띄우고 부하를 보면서 늘리겠습니다",
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
      evidenceText: "런북 문서가 제목만 있고 안이 비어 있습니다",
    }),
  },
  // **`CORRECT`.** 다섯 operation 중 이것만 목에 없어서 「내용 정정」 칩이 한 번도 안 떴다.
  // `AMEND`(보강)와 다른 말인데 화면에서 나란히 본 적이 없었다.
  {
    atMs: 2_520_000,
    candidate: head({
      candidateId: CANDIDATE(13),
      kind: "DECISION",
      content: "읽기 전용 복제본은 세 대로 시작한다",
      createdSequence: 240,
      evidenceAtMs: 2_400_000,
      evidenceText: "복제본은 일단 최소로 띄우고 부하를 보면서 늘리겠습니다",
      revision: 2,
      operation: "CORRECT",
      aiSemanticRevisionCount: 1,
      lastEvidenceSequence: 252,
    }),
  },
  {
    atMs: 2_560_000,
    candidate: head({
      candidateId: CANDIDATE(7),
      kind: "ISSUE",
      content: "장애 대응 runbook이 비어 있다 · 담당자도 미정",
      createdSequence: 248,
      evidenceAtMs: 2_480_000,
      evidenceText: "런북 문서가 제목만 있고 안이 비어 있습니다",
      revision: 2,
      operation: "AMEND",
      aiSemanticRevisionCount: 1,
      lastEvidenceSequence: 256,
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
