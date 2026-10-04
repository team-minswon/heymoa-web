import type { ProposalHead } from "@/lib/notes/proposals/contract";
import type { ContextState } from "@/lib/notes/proposals/reducer";

/**
 * 실시간 정리 원장을 **회의가 흘러간 순서**로 펼친다 — 본문 「타임라인」 탭의 뼈대다.
 *
 * **안건 소속은 서버가 주지 않는다.** 그래서 순서로 계산한다: 「안건」 후보가 나오면 그 뒤에
 * 생긴 후보는 다음 안건이 나올 때까지 그 아래에 든다. 첫 안건보다 먼저 생긴 후보는 머리 없는
 * 묶음에 남는다. 안건이 하나도 없으면 머리 없는 묶음 하나뿐이다.
 *
 * **답은 질문 아래로 숨기지 않는다.** `RESOLVE` 가 만든 결과(결정·할 일 등)도 제 시각의 자리에
 * 한 줄로 서고, 질문과 답은 서로를 가리키는 관계로만 잇는다 — 결정이 질문 카드 안에 숨으면
 * 「결정」으로 골라 볼 때 빠진다.
 */

export type TimelineTone =
  | "decision"
  | "task"
  | "open"
  | "answered"
  | "reference";

export type TimelineFilter =
  | "ALL"
  | "DECISION"
  | "ACTION_ITEM"
  | "OPEN"
  | "REFERENCE";

export const TIMELINE_FILTERS: ReadonlyArray<{
  value: TimelineFilter;
  label: string;
}> = [
  { value: "ALL", label: "전체" },
  { value: "DECISION", label: "결정" },
  { value: "ACTION_ITEM", label: "할 일" },
  { value: "OPEN", label: "열린 질문" },
  { value: "REFERENCE", label: "참고" },
];

export type TimelineItem = {
  proposal: ProposalHead;
  tone: TimelineTone;
  /**
   * 첫 근거의 회의 경과 시각. 근거가 없으면 `null`.
   *
   * **생성 시각이 아니다.** 수정·철회로 근거가 바뀌면 이 값도 바뀐다 — 그래서 이 값으로 항목
   * 사이의 공백(「N분 동안 새 항목 없음」)을 추론하지 않는다. 생성 순서와 어긋나 없던 공백을
   * 주장하게 된다.
   */
  atMs: number | null;
  /** 이 질문에 답한 후보들. */
  answers: ProposalHead[];
  /** 이 후보가 답한 질문. */
  answersTo: ProposalHead | null;
};

export type TimelineGroup = {
  /** 머리 안건. 첫 안건보다 먼저 생긴 후보의 묶음이면 `null`. */
  agenda: ProposalHead | null;
  startMs: number | null;
  /** 다음 안건이 시작한 시각. 마지막 묶음이면 `null`. */
  endMs: number | null;
  /** 원장의 마지막 안건이다 — 기록 중이면 「논의 중」이다. */
  last: boolean;
  /** 골라 보기와 상관없는 이 안건의 항목 수. */
  total: number;
  items: TimelineItem[];
};

export type Timeline = {
  groups: TimelineGroup[];
  counts: Record<TimelineFilter, number>;
};

export function toneOf(proposal: ProposalHead): TimelineTone {
  switch (proposal.kind) {
    case "DECISION":
      return "decision";
    case "ACTION_ITEM":
      return "task";
    // **철회된 질문·이슈는 열려 있지 않다.** 이력에는 남기되 「열린 질문」에 세지 않고 답을
    // 기다린다고도 하지 않는다 — 참고로 내린다.
    case "QUESTION":
      if (proposal.closeReason === "RETRACTED") return "reference";
      return proposal.closeReason === "RESOLVED" ? "answered" : "open";
    case "ISSUE":
      return proposal.closeReason === "RETRACTED" ? "reference" : "open";
    default:
      return "reference";
  }
}

const FILTER_OF: Record<TimelineTone, Exclude<TimelineFilter, "ALL">> = {
  decision: "DECISION",
  task: "ACTION_ITEM",
  open: "OPEN",
  answered: "REFERENCE",
  reference: "REFERENCE",
};

export function inFilter(tone: TimelineTone, filter: TimelineFilter) {
  return filter === "ALL" || FILTER_OF[tone] === filter;
}

/**
 * 계약의 정렬 키 `(createdSequence, proposalId)`. TSID 는 Crockford base32 라 코드 단위 비교가
 * 곧 서버의 `ORDER BY` 다 — `localeCompare` 는 로케일에 따라 숫자·문자 순서가 달라진다.
 */
function byOrder(a: ProposalHead, b: ProposalHead) {
  return (
    a.createdSequence - b.createdSequence ||
    (a.proposalId < b.proposalId ? -1 : a.proposalId > b.proposalId ? 1 : 0)
  );
}

const firstAt = (proposal: ProposalHead) =>
  proposal.citations[0]?.startedAtMs ?? null;

export function selectTimeline(
  state: ContextState,
  filter: TimelineFilter
): Timeline {
  const all = Object.values(state.proposals).sort(byOrder);
  const answers = new Map<string, ProposalHead[]>();
  for (const proposal of all) {
    if (!proposal.resolvesProposalId) continue;
    answers.set(proposal.resolvesProposalId, [
      ...(answers.get(proposal.resolvesProposalId) ?? []),
      proposal,
    ]);
  }

  const counts: Record<TimelineFilter, number> = {
    ALL: 0,
    DECISION: 0,
    ACTION_ITEM: 0,
    OPEN: 0,
    REFERENCE: 0,
  };
  const groups: TimelineGroup[] = [];
  let current: TimelineGroup | null = null;

  for (const proposal of all) {
    if (proposal.kind === "AGENDA") {
      const startMs = firstAt(proposal);
      if (current) current.endMs = startMs;
      current = {
        agenda: proposal,
        startMs,
        endMs: null,
        last: false,
        total: 0,
        items: [],
      };
      groups.push(current);
      continue;
    }
    if (!current) {
      current = {
        agenda: null,
        startMs: firstAt(proposal),
        endMs: null,
        last: false,
        total: 0,
        items: [],
      };
      groups.push(current);
    }

    const tone = toneOf(proposal);
    counts.ALL += 1;
    counts[FILTER_OF[tone]] += 1;
    current.total += 1;

    if (!inFilter(tone, filter)) continue;

    current.items.push({
      proposal,
      tone,
      atMs: firstAt(proposal),
      answers: answers.get(proposal.proposalId) ?? [],
      answersTo: proposal.resolvesProposalId
        ? (state.proposals[proposal.resolvesProposalId] ?? null)
        : null,
    });
  }

  const lastAgenda = groups.findLast((group) => group.agenda !== null);
  if (lastAgenda) lastAgenda.last = true;

  return {
    // 골라 보기 중에는 그 유형이 없는 안건을 감춘다. 「전체」에서는 아직 항목이 없는 안건도
    // 남긴다 — 방금 꺼낸 안건이라는 사실 자체가 회의의 흐름이다.
    groups: groups.filter(
      (group) =>
        group.items.length > 0 || (filter === "ALL" && group.agenda !== null)
    ),
    counts,
  };
}
