import type {
  RunRange,
  ProposalHead,
} from "@/lib/notes/proposals/contract";

export const CONTEXT_DEMO_NOTE_ID = "01K0000000005";

export const CONTEXT_FAILING_NOTE_ID = "01K0000000006";

export const CONTEXT_SYNTHETIC_LEDGER_NOTE_ID = "01K0000000007";

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

const MOCK_MEETING_STARTED_AT = Date.now() - 2_600_000;

const SEGMENT = (n: number) => `0HZX2K7M9Q${String(n).padStart(3, "0")}`;
const PROPOSAL = (n: number) => `0HZX2K7M9QA${String(n).padStart(2, "0")}`;
export function head(
  over: Partial<ProposalHead> & {
    proposalId: string;
    kind: ProposalHead["kind"];
    content: string;
    createdSequence: number;
    evidenceAtMs: number;
    evidenceText: string | readonly string[];
  }
): ProposalHead {
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
    resolvesProposalId: null,
    citations: texts.map((text, index) => ({
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

export const CONTEXT_TIMELINE: Array<{
  atMs: number;
  proposal: ProposalHead;
}> = [
  {
    atMs: 242_000,
    proposal: head({
      proposalId: PROPOSAL(1),
      kind: "AGENDA",
      content: "MongoDB 도입 검토",
      createdSequence: 24,
      evidenceAtMs: 242_000,
      evidenceText: "스키마가 분기마다 바뀌는데 문서형으로 가는 게 맞는지 이번에 한 번 정리하고 갔으면 합니다",
    }),
  },
  {
    atMs: 380_000,
    proposal: head({
      proposalId: PROPOSAL(8),
      kind: "INSIGHT",
      content: "읽기 쏠림은 특정 시간대에만 생긴다",
      createdSequence: 38,
      evidenceAtMs: 380_000,
      evidenceText: "지표를 보면 오전 아홉 시하고 오후 여섯 시 앞뒤 삼십 분에만 몰려요",
    }),
  },
  {
    atMs: 512_000,
    proposal: head({
      proposalId: PROPOSAL(9),
      kind: "QUESTION",
      content: "샤딩 키를 바꾸면 마이그레이션이 얼마나 걸리나",
      createdSequence: 51,
      evidenceAtMs: 512_000,
      evidenceText: "샤딩 키를 바꾸면 재분배가 몇 시간짜리인지 재 본 사람 있나요",
    }),
  },
  {
    atMs: 620_000,
    proposal: head({
      proposalId: PROPOSAL(2),
      kind: "QUESTION",
      content: "인덱스를 줄이면 조회 손해가 얼마나 되나",
      createdSequence: 62,
      evidenceAtMs: 620_000,
      evidenceText: "인덱스를 절반으로 줄이면 조회가 얼마나 느려지는지가 관건입니다",
    }),
  },
  {
    atMs: 1_002_000,
    proposal: head({
      proposalId: PROPOSAL(3),
      kind: "STATUS_REPORT",
      content: "스테이징 이관은 지난주에 끝났다",
      createdSequence: 100,
      evidenceAtMs: 1_002_000,
      evidenceText: "스테이징은 지난주 목요일에 넘겼고 지금 이틀째 돌고 있습니다",
    }),
  },
  {
    atMs: 1_190_000,
    proposal: head({
      proposalId: PROPOSAL(4),
      kind: "ACTION_ITEM",
      content: "인덱스 벤치마크 수치는 금요일까지 정리",
      createdSequence: 119,
      evidenceAtMs: 1_190_000,
      evidenceText: "벤치마크는 금요일까지 정리해서 올리겠습니다",
    }),
  },
  {
    atMs: 1_310_000,
    proposal: head({
      proposalId: PROPOSAL(4),
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
    proposal: head({
      proposalId: PROPOSAL(10),
      kind: "ACTION_ITEM",
      content: "스테이징에 인덱스 변경 먼저 적용",
      createdSequence: 145,
      evidenceAtMs: 1_450_000,
      evidenceText: "인덱스 변경은 스테이징에 먼저 걸어 보고 운영에 올리시죠",
    }),
  },
  {
    atMs: 1_540_000,
    proposal: head({
      proposalId: PROPOSAL(3),
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
  {
    atMs: 1_640_000,
    proposal: head({
      proposalId: PROPOSAL(2),
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
    proposal: head({
      proposalId: PROPOSAL(5),
      kind: "STATUS_REPORT",
      content: "조회 손해는 15% 안쪽으로 측정됐다",
      createdSequence: 164,
      evidenceAtMs: 1_640_000,
      evidenceText: "재 봤는데 최악이 십오 퍼센트 정도였고 평균은 그보다 훨씬 낮았습니다",
      operation: "RESOLVE",
      resolvesProposalId: PROPOSAL(2),
    }),
  },
  {
    atMs: 1_872_000,
    proposal: head({
      proposalId: PROPOSAL(6),
      kind: "DECISION",
      content: "경로 데이터 저장소는 MongoDB를 사용한다",
      createdSequence: 187,
      evidenceAtMs: 1_872_000,
      evidenceText: "그럼 경로 데이터는 몽고디비로 가는 걸로 정리하겠습니다",
    }),
  },
  {
    atMs: 2_101_000,
    proposal: head({
      proposalId: PROPOSAL(1),
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
    proposal: head({
      proposalId: PROPOSAL(11),
      kind: "INSIGHT",
      content: "장애의 절반이 배포 직후 30분에 몰린다",
      createdSequence: 224,
      evidenceAtMs: 2_240_000,
      evidenceText: "지난 분기 장애 티켓을 시간대로 찍어 보니 절반이 배포 직후 삼십 분 안에 났습니다",
    }),
  },
  {
    atMs: 2_310_000,
    proposal: head({
      proposalId: PROPOSAL(12),
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
    proposal: head({
      proposalId: PROPOSAL(11),
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
    proposal: head({
      proposalId: PROPOSAL(13),
      kind: "DECISION",
      content: "읽기 전용 복제본은 두 대로 시작한다",
      createdSequence: 240,
      evidenceAtMs: 2_400_000,
      evidenceText: "복제본은 일단 최소로 띄우고 부하를 보면서 늘리겠습니다",
    }),
  },
  {
    atMs: 2_480_000,
    proposal: head({
      proposalId: PROPOSAL(7),
      kind: "ISSUE",
      content: "장애 대응 runbook이 비어 있다",
      createdSequence: 248,
      evidenceAtMs: 2_480_000,
      evidenceText: "런북 문서가 제목만 있고 안이 비어 있습니다",
    }),
  },
  {
    atMs: 2_520_000,
    proposal: head({
      proposalId: PROPOSAL(13),
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
    proposal: head({
      proposalId: PROPOSAL(7),
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
  runId: string,
  fromSequence: number,
  toSequence: number,
  over: Partial<RunRange> = {}
): RunRange {
  return {
    runId,
    applyStatus: "APPLIED",
    fromSequence,
    toSequence,
    fromStartedAtMs: fromSequence * 10_000,
    toEndedAtMs: toSequence * 10_000,
    rawDeltaSaturated: false,
    semanticUnitSaturated: false,
    appliedAt: new Date(
      MOCK_MEETING_STARTED_AT + toSequence * 10_000
    ).toISOString(),
    ...over,
  };
}

export const CONTEXT_APPLIED_RANGES: RunRange[] = [
  range("0RDDJRN000001", 1, 60),
  range("0RDDJRN000002", 61, 123),
  range("0RDDJRN000004", 171, 200, { rawDeltaSaturated: true }),
  range("0RDDJRN000005", 201, 260),
];

export const CONTEXT_SWAP_NOTE_ID = "01K0000000008";

export const CONTEXT_SWAP_RANGES: RunRange[] = [
  range("0RDDJSW000001", 1, 8),
  range("0RDDJSW000003", 17, 24),
];

export const CONTEXT_SWAP_FILL: RunRange = range("0RDDJSW000002", 9, 16, {
  rawDeltaSaturated: true,
});

export const CONTEXT_SWAP_FILLED: RunRange[] = [
  CONTEXT_SWAP_RANGES[0],
  CONTEXT_SWAP_FILL,
  CONTEXT_SWAP_RANGES[1],
];

let swapFilled = false;
export const markSwapFilled = () => {
  swapFilled = true;
};
export const resetSwapFill = () => {
  swapFilled = false;
};
export const isSwapFilled = () => swapFilled;

export const CONTEXT_SWAP_SNAPSHOT = {
  proposals: [],
  runs: CONTEXT_SWAP_RANGES,
};

export const CONTEXT_SNAPSHOT = {
  proposals: (() => {
    const byId = new Map<string, ProposalHead>();
    for (const entry of CONTEXT_TIMELINE) {
      const current = byId.get(entry.proposal.proposalId);
      if (!current || entry.proposal.revision >= current.revision) {
        byId.set(entry.proposal.proposalId, entry.proposal);
      }
    }
    return [...byId.values()].sort(
      (a, b) => a.createdSequence - b.createdSequence
    );
  })(),
  runs: CONTEXT_APPLIED_RANGES,
};
