import type { ProposalHead } from "@/lib/notes/proposals/contract";
import type { ContextState } from "@/lib/notes/proposals/reducer";

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

export const TIMELINE_FILTERS: ReadonlyArray<TimelineFilter> = [
  "ALL",
  "DECISION",
  "ACTION_ITEM",
  "OPEN",
  "REFERENCE",
];

export type TimelineItem = {
  proposal: ProposalHead;
  tone: TimelineTone;
  atMs: number | null;
  answers: ProposalHead[];
  answersTo: ProposalHead | null;
};

export type TimelineAgenda = {
  title: string;
  completed: boolean;
  retracted: boolean;
  citation: ProposalHead["citations"][number] | null;
};

export type TimelineGroup = {
  key: string;
  previous: { key: string; startMs: number | null } | null;
  agenda: TimelineAgenda | null;
  startMs: number | null;
  endMs: number | null;
  last: boolean;
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

// TSID 는 Crockford base32 라 코드 단위 비교가 서버의 `ORDER BY` 와 같습니다. `localeCompare` 는 로케일마다 순서가 달라 쓰지 않습니다.
function byOrder(a: ProposalHead, b: ProposalHead) {
  return (
    a.createdSequence - b.createdSequence ||
    (a.proposalId < b.proposalId ? -1 : a.proposalId > b.proposalId ? 1 : 0)
  );
}

const firstAt = (proposal: ProposalHead) =>
  proposal.citations[0]?.startedAtMs ?? null;

export type AgendaList = {
  asOfSequence?: number | null;
  agendas: ReadonlyArray<{
    agendaId: string;
    title: string;
    completed: boolean;
    proposalIds: ReadonlyArray<unknown>;
  }>;
};

export type AgendaPlacement = ReadonlyMap<string, string | null>;

export function placeAgendas(
  previous: AgendaPlacement,
  proposals: Iterable<ProposalHead>,
  list: AgendaList,
  live: boolean
): AgendaPlacement {
  const validAgendas = new Set(list.agendas.map((agenda) => agenda.agendaId));
  const owner = new Map<string, string>();
  for (const agenda of list.agendas) {
    for (const proposalId of agenda.proposalIds)
      owner.set(String(proposalId), agenda.agendaId);
  }
  const asOf = list.asOfSequence ?? null;
  const next = new Map<string, string | null>();
  for (const proposal of proposals) {
    if (proposal.kind === "AGENDA") continue;
    const id = proposal.proposalId;
    const previousAgenda = previous.get(id);
    if (
      live &&
      previous.has(id) &&
      (previousAgenda ? validAgendas.has(previousAgenda) : !owner.has(id))
    ) {
      next.set(id, previousAgenda ?? null);
      continue;
    }
    const seen =
      !live ||
      owner.has(id) ||
      (asOf !== null && proposal.createdSequence <= asOf);
    if (seen) next.set(id, owner.get(id) ?? null);
  }
  return next;
}

export function samePlacement(a: AgendaPlacement, b: AgendaPlacement) {
  if (a.size !== b.size) return false;
  for (const [id, agendaId] of a)
    if (!b.has(id) || b.get(id) !== agendaId) return false;
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
  const lastByAgenda = new Map<string, TimelineGroup>();
  const latest = new Map<TimelineGroup, number>();
  const widen = (group: TimelineGroup, at: number | null) => {
    if (at === null) return;
    if (group.startMs === null || at < group.startMs) group.startMs = at;
    latest.set(group, Math.max(latest.get(group) ?? at, at));
  };
  const agendaOf = new Map<string, AgendaList["agendas"][number]>(
    (byAgenda?.list.agendas ?? []).map((agenda) => [agenda.agendaId, agenda])
  );

  for (const proposal of all) {
    if (byAgenda) {
      if (proposal.kind === "AGENDA") continue;
      const placed: string | null = byAgenda.placement.has(proposal.proposalId)
        ? (byAgenda.placement.get(proposal.proposalId) ?? null)
        : null;
      if (!current || placed !== currentAgendaId) {
        const startMs = firstAt(proposal);
        const agenda: AgendaList["agendas"][number] | undefined = placed
          ? agendaOf.get(placed)
          : undefined;
        const previous: TimelineGroup | undefined = placed
          ? lastByAgenda.get(placed)
          : undefined;
        current = {
          key: `${placed ?? "none"}:${proposal.proposalId}`,
          previous: previous
            ? { key: previous.key, startMs: previous.startMs }
            : null,
          agenda: agenda
            ? {
                title: agenda.title,
                completed: agenda.completed,
                retracted: false,
                citation: proposal.citations[0] ?? null,
              }
            : null,
          startMs,
          endMs: null,
          last: false,
          total: 0,
          items: [],
        };
        currentAgendaId = placed;
        groups.push(current);
        if (placed) lastByAgenda.set(placed, current);
      }
    } else if (proposal.kind === "AGENDA") {
      const startMs = firstAt(proposal);
      current = {
        key: proposal.proposalId,
        previous: null,
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
      widen(current, startMs);
      continue;
    }
    if (!current) {
      current = {
        key: "lead",
        previous: null,
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
    widen(current, firstAt(proposal));

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

  for (const group of groups.slice(0, -1))
    group.endMs = latest.get(group) ?? null;

  const lastAgenda = byAgenda
    ? groups.at(-1)
    : groups.findLast((group) => group.agenda !== null);
  if (lastAgenda?.agenda && !lastAgenda.agenda.completed)
    lastAgenda.last = true;

  return {
    groups: groups.filter(
      (group) =>
        group.items.length > 0 || (filter === "ALL" && group.agenda !== null)
    ),
    counts,
  };
}
