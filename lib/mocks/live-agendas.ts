import type { NoteAgendasResponseData } from "@/lib/api/generated/models";
import type { ProposalHead } from "@/lib/notes/proposals/contract";
import { head } from "@/lib/mocks/proposals";

/**
 * 회의 중 안건이 실시간으로 정해지는 노트. 노트 토픽을 구독하면 명제가 하나씩 오고, 몇 줄마다 안건
 * 정리가 끝나 `agendas.changed` 가 온다 — 화면은 그때 GET /agendas 를 다시 읽는다.
 *
 * 다른 데모 노트와 가른다. `CONTEXT_DEMO_NOTE_ID` 는 안건 정본이 없는 옛 회의(안건 명제로 가름)를
 * 보여 주는 자리라 둘을 섞으면 어느 방식이 묶음을 정했는지 흐려진다.
 *
 * 마지막 정리는 처음에 온보딩으로 정한 「이탈률」 줄을 결제 주제로 옮긴다. 회의 중이라 화면은 그 줄을
 * 옮기지 않아야 한다.
 */
export const LIVE_AGENDA_NOTE_ID = "01K0000000016";

const ID = (n: number) => `0HZX2K7M9RB${String(n).padStart(2, "0")}`;
const AGENDA = { onboarding: "01KA000000101", payment: "01KA000000102", hiring: "01KA000000103" };

const proposal = (n: number, kind: ProposalHead["kind"], content: string, sequence: number, evidenceText: string) =>
  head({ proposalId: ID(n), kind, content, createdSequence: sequence, evidenceAtMs: sequence * 6_000, evidenceText });

type Step = { atMs: number } & (
  | { proposal: ProposalHead }
  | { asOfSequence: number; agendas: Array<{ agendaId: string; title: string; completed: boolean; proposalIds: string[] }> }
);

const P = {
  churn: proposal(1, "STATUS_REPORT", "지난주 온보딩 이탈률은 38%였다", 10, "지난주 온보딩 이탈률이 삼십팔 퍼센트까지 올라갔습니다"),
  steps: proposal(2, "DECISION", "온보딩을 3단계에서 2단계로 줄인다", 20, "그럼 온보딩은 두 단계로 줄이는 걸로 하죠"),
  mockup: proposal(3, "ACTION_ITEM", "새 온보딩 화면 시안을 만든다", 25, "시안은 제가 이번 주에 만들어 볼게요"),
  tickets: proposal(4, "STATUS_REPORT", "결제 실패 문의가 지난주 23건 들어왔다", 40, "결제 실패 문의가 지난주에만 스물세 건이었어요"),
  threeDs: proposal(5, "ISSUE", "카드사 3DS 응답이 늦게 온다", 50, "카드사 쪽 3DS 응답이 너무 늦게 와요"),
  peak: proposal(6, "INSIGHT", "결제 실패의 절반이 오후 2시대에 몰린다", 55, "보니까 실패의 절반이 오후 두 시대에 몰려 있더라고요"),
  skip: proposal(7, "DECISION", "튜토리얼에 건너뛰기 버튼을 둔다", 60, "아 그리고 튜토리얼은 건너뛰기를 두죠"),
  timeout: proposal(8, "DECISION", "PG 타임아웃을 30초로 늘린다", 70, "PG 타임아웃은 삼십 초로 늘립시다"),
  budget: proposal(9, "STATUS_REPORT", "백엔드 채용 2명 예산이 승인됐다", 80, "백엔드 두 명 예산은 승인이 났습니다"),
};

const STEPS: Step[] = [
  { atMs: 1_000, proposal: P.churn },
  { atMs: 2_000, proposal: P.steps },
  { atMs: 3_000, proposal: P.mockup },
  {
    atMs: 4_000,
    asOfSequence: 25,
    agendas: [{ agendaId: AGENDA.onboarding, title: "온보딩 개편", completed: false, proposalIds: [ID(1), ID(2), ID(3)] }],
  },
  { atMs: 5_000, proposal: P.tickets },
  { atMs: 6_000, proposal: P.threeDs },
  { atMs: 7_000, proposal: P.peak },
  {
    atMs: 8_000,
    asOfSequence: 52,
    agendas: [
      { agendaId: AGENDA.onboarding, title: "온보딩 개편", completed: true, proposalIds: [ID(1), ID(2), ID(3)] },
      { agendaId: AGENDA.payment, title: "결제 실패 대응", completed: false, proposalIds: [ID(4), ID(5)] },
    ],
  },
  { atMs: 9_000, proposal: P.skip },
  { atMs: 10_000, proposal: P.timeout },
  { atMs: 11_000, proposal: P.budget },
  {
    atMs: 12_000,
    asOfSequence: 80,
    agendas: [
      { agendaId: AGENDA.onboarding, title: "온보딩 개편", completed: true, proposalIds: [ID(2), ID(3), ID(7)] },
      // 「이탈률」을 결제 쪽으로 옮긴 정리 — 회의 중 화면은 그 줄을 옮기지 않는다
      { agendaId: AGENDA.payment, title: "결제 실패 대응", completed: true, proposalIds: [ID(1), ID(4), ID(5), ID(6), ID(8)] },
      { agendaId: AGENDA.hiring, title: "하반기 채용", completed: false, proposalIds: [ID(9)] },
    ],
  },
];

/** 구독이 시작된 시각. 그 전에는 아무것도 오지 않은 회의다 */
let startedAt: number | null = null;

/**
 * 구독이 다시 붙어도(재연결 · 두 번째 탭) 처음 시작 시각을 지킨다 — 실서버의 원장처럼 이미 지나간
 * 단계는 남아 있고, 아직 안 온 단계만 남은 시간 뒤에 온다. 돌려주는 값은 각 단계까지 남은 시간이다.
 */
export function startLiveAgendaFeed(now: number) {
  startedAt ??= now;
  const passed = now - startedAt;
  return STEPS.filter((step) => step.atMs > passed).map((step) => ({ atMs: step.atMs, delayMs: step.atMs - passed }));
}

const elapsed = (now: number) => (startedAt === null ? -1 : now - startedAt);

/** 그 시각까지 온 명제(REST 스냅샷) */
export function liveAgendaProposals(now: number): ProposalHead[] {
  return STEPS.filter((step) => step.atMs <= elapsed(now) && "proposal" in step).map(
    (step) => (step as { proposal: ProposalHead }).proposal
  );
}

/** 그 시각의 안건 정본(GET /agendas) */
export function liveAgendaList(now: number): NoteAgendasResponseData {
  const settle = STEPS.filter((step) => step.atMs <= elapsed(now) && "agendas" in step).at(-1) as
    | Extract<Step, { agendas: unknown }>
    | undefined;
  return {
    asOfSequence: settle?.asOfSequence ?? null,
    agendas: (settle?.agendas ?? []).map((row) => ({ ...row, description: [], conclusions: [], openItems: [] })),
  };
}

/** 그 단계가 보낼 노트 토픽 프레임 */
export function liveAgendaFrame(atMs: number) {
  const step = STEPS.find((row) => row.atMs === atMs);
  if (!step) return null;
  const occurredAt = new Date().toISOString();
  return "proposal" in step
    ? { type: "proposal.changed", occurredAt, proposal: step.proposal }
    : { type: "agendas.changed", occurredAt };
}
