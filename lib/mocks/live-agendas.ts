import type { NoteAgendasResponseData } from "@/lib/api/generated/models";
import type { ProposalHead } from "@/lib/notes/proposals/contract";
import { head } from "@/lib/mocks/proposals";

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
      { agendaId: AGENDA.payment, title: "결제 실패 대응", completed: true, proposalIds: [ID(1), ID(4), ID(5), ID(6), ID(8)] },
      { agendaId: AGENDA.hiring, title: "하반기 채용", completed: false, proposalIds: [ID(9)] },
    ],
  },
];

let startedAt: number | null = null;

export function startLiveAgendaFeed(now: number) {
  startedAt ??= now;
  const passed = now - startedAt;
  return STEPS.filter((step) => step.atMs > passed).map((step) => ({ atMs: step.atMs, delayMs: step.atMs - passed }));
}

const elapsed = (now: number) => (startedAt === null ? -1 : now - startedAt);

export function liveAgendaProposals(now: number): ProposalHead[] {
  return STEPS.filter((step) => step.atMs <= elapsed(now) && "proposal" in step).map(
    (step) => (step as { proposal: ProposalHead }).proposal
  );
}

export function liveAgendaList(now: number): NoteAgendasResponseData {
  const settle = STEPS.filter((step) => step.atMs <= elapsed(now) && "agendas" in step).at(-1) as
    | Extract<Step, { agendas: unknown }>
    | undefined;
  return {
    asOfSequence: settle?.asOfSequence ?? null,
    agendas: (settle?.agendas ?? []).map((row) => ({ ...row, description: [], conclusions: [], openItems: [] })),
  };
}

export function liveAgendaFrame(atMs: number) {
  const step = STEPS.find((row) => row.atMs === atMs);
  if (!step) return null;
  const occurredAt = new Date().toISOString();
  return "proposal" in step
    ? { type: "proposal.changed", occurredAt, proposal: step.proposal }
    : { type: "agendas.changed", occurredAt };
}
