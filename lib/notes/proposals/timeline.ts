import type { ProposalHead } from "@/lib/notes/proposals/contract";
import type { ContextState } from "@/lib/notes/proposals/reducer";

/**
 * 실시간 정리 원장을 **회의가 흘러간 순서**로 펼친다 — 본문 「타임라인」 탭의 뼈대다.
 *
 * **주제 소속은 안건 정본(GET /agendas)이 준다.** 줄은 늘 시간 순서이고, 이어진 줄이 같은
 * 주제면 한 묶음이다 — 다른 주제로 갔다가 돌아오면 제목이 한 번 더 선다. 어느 주제에도 들지
 * 않은 줄은 제목 없는 묶음이다. 배치는 `placeAgendas` 가 정한다.
 *
 * 안건 정본이 비어 있는 옛 회의는 예전처럼 「안건」 명제로 가른다: 안건 명제가 나오면 그 뒤에
 * 생긴 후보는 다음 안건이 나올 때까지 그 아래에 든다.
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

/** 묶음 머리의 주제 */
export type TimelineAgenda = {
  title: string;
  /** 정리가 끝났다고 본 주제. 「논의 중」을 달지 않는다 */
  completed: boolean;
  /** 옛 안건 명제가 철회됐다 */
  retracted: boolean;
  /** 머리의 시간 구간이 가리키는 첫 발화 */
  citation: ProposalHead["citations"][number] | null;
};

export type TimelineGroup = {
  /** 화면 key. 같은 주제로 돌아온 묶음끼리도 다르다 */
  key: string;
  /** 머리 주제. 어느 주제에도 들지 않은 줄의 묶음이면 `null`. */
  agenda: TimelineAgenda | null;
  startMs: number | null;
  /** 다음 안건이 시작한 시각. 마지막 묶음이면 `null`. */
  endMs: number | null;
  /** 지금 이야기하는 주제다 — 기록 중이면 「논의 중」이다. */
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

/** 안건 정본에서 배치에 쓰는 것만 */
export type AgendaList = {
  asOfSequence?: number | null;
  agendas: ReadonlyArray<{ agendaId: string; title: string; completed: boolean; proposalIds: ReadonlyArray<unknown> }>;
};

/** 명제 → 주제(agendaId, 어느 주제에도 들지 않으면 null). 없는 명제는 바로 앞 줄의 묶음을 따른다 */
export type AgendaPlacement = ReadonlyMap<string, string | null>;

/**
 * 안건 정본으로 줄의 주제를 정한다.
 *
 * **회의 중에는 한 번 자리를 정한 줄을 옮기지 않는다** — 읽던 줄이 다른 주제 밑으로 뛰면 어디까지
 * 읽었는지 잃는다. 정리가 아직 못 본 줄(`createdSequence > asOfSequence`)은 자리를 정하지 않아
 * 바로 앞 줄의 묶음에 붙는다. 그래서 정리가 와도 바뀌는 것은 맨 아래 몇 줄뿐이다.
 * 회의가 끝나면(`live` 거짓) 지난 배치를 버리고 서버 판정대로 한 번 맞춘다.
 */
export function placeAgendas(
  previous: AgendaPlacement,
  proposals: Iterable<ProposalHead>,
  list: AgendaList,
  live: boolean
): AgendaPlacement {
  const validAgendas = new Set(list.agendas.map((agenda) => agenda.agendaId));
  const owner = new Map<string, string>();
  for (const agenda of list.agendas) {
    for (const proposalId of agenda.proposalIds) owner.set(String(proposalId), agenda.agendaId);
  }
  const asOf = list.asOfSequence ?? null;
  const next = new Map<string, string | null>();
  for (const proposal of proposals) {
    if (proposal.kind === "AGENDA") continue;
    const id = proposal.proposalId;
    const previousAgenda = previous.get(id);
    // 이미 읽던 안건은 유지하되, 사라진 안건이나 새로 소속이 생긴 미분류 줄은 정본으로 옮긴다.
    if (live && previous.has(id) && (previousAgenda ? validAgendas.has(previousAgenda) : !owner.has(id))) {
      next.set(id, previousAgenda ?? null);
      continue;
    }
    const seen = !live || owner.has(id) || (asOf !== null && proposal.createdSequence <= asOf);
    if (seen) next.set(id, owner.get(id) ?? null);
  }
  return next;
}

/** 두 배치가 같다. 같은 배치로 상태를 다시 쓰지 않게 */
export function samePlacement(a: AgendaPlacement, b: AgendaPlacement) {
  if (a.size !== b.size) return false;
  for (const [id, agendaId] of a) if (!b.has(id) || b.get(id) !== agendaId) return false;
  return true;
}

export function selectTimeline(
  state: ContextState,
  filter: TimelineFilter,
  plan: { list: AgendaList; placement: AgendaPlacement } | null = null
): Timeline {
  const all = Object.values(state.proposals).sort(byOrder);
  const byAgenda = plan && plan.list.agendas.length > 0 ? plan : null;
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
  let currentAgendaId: string | null = null;
  const agendaOf = new Map<string, AgendaList["agendas"][number]>(
    (byAgenda?.list.agendas ?? []).map((agenda) => [agenda.agendaId, agenda])
  );

  for (const proposal of all) {
    if (byAgenda) {
      // 안건 정본이 있으면 옛 안건 명제는 머리로 쓰지 않는다
      if (proposal.kind === "AGENDA") continue;
      const placed: string | null = byAgenda.placement.has(proposal.proposalId)
        ? (byAgenda.placement.get(proposal.proposalId) ?? null)
        : current
          ? currentAgendaId
          : null;
      if (!current || placed !== currentAgendaId) {
        const startMs = firstAt(proposal);
        if (current) current.endMs = startMs;
        const agenda: AgendaList["agendas"][number] | undefined = placed ? agendaOf.get(placed) : undefined;
        current = {
          key: `${placed ?? "none"}:${proposal.proposalId}`,
          agenda: agenda
            ? { title: agenda.title, completed: agenda.completed, retracted: false, citation: proposal.citations[0] ?? null }
            : null,
          startMs,
          endMs: null,
          last: false,
          total: 0,
          items: [],
        };
        currentAgendaId = placed;
        groups.push(current);
      }
    } else if (proposal.kind === "AGENDA") {
      const startMs = firstAt(proposal);
      if (current) current.endMs = startMs;
      current = {
        key: proposal.proposalId,
        agenda: {
          title: proposal.content,
          completed: false,
          retracted: proposal.closeReason === "RETRACTED",
          citation: proposal.citations[0] ?? null,
        },
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
        key: "lead",
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

  // 옛 방식은 마지막 안건이, 안건 정본은 맨 아래 묶음이 끝나지 않은 주제일 때 지금 주제다
  const lastAgenda = byAgenda ? groups.at(-1) : groups.findLast((group) => group.agenda !== null);
  if (lastAgenda?.agenda && !lastAgenda.agenda.completed) lastAgenda.last = true;

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
