import type { RunRange, ProposalHead } from "@/lib/notes/proposals/contract";

export type { RunRange, ProposalHead };

export type ContextCard = ProposalHead & {
  results: ProposalHead[];
};

export type ContextActivityOutcome =
  | "APPLIED"
  | "ABSORBED"
  | "RESYNC_REQUIRED"
  | "RECOVERED";

export type ContextActivity =
  | {
      type: "proposal";
      key: string;
      occurredAt: string;
      proposalId: string;
      revision: number;
      kind: ProposalHead["kind"];
      operation: ProposalHead["operation"];
      outcome: Exclude<ContextActivityOutcome, "RECOVERED">;
    }
  | {
      type: "batch";
      key: string;
      runId: string;
      occurredAt: string;
      fromSequence: number;
      toSequence: number;
      applyStatus: RunRange["applyStatus"];
      outcome: "APPLIED" | "ABSORBED";
    }
  | {
      type: "sync";
      key: string;
      outcome: "RECOVERED";
    };

export type ContextState = {
  proposals: Record<string, ProposalHead>;
  runs: RunRange[];
  seenRunIds: string[];
  lastBatchAt: string | null;
  needsRefetch: boolean;
  activities: ContextActivity[];
};

export type ContextEvent =
  | {
      type: "proposal.changed";
      occurredAt: string;
      proposal: ProposalHead;
    }
  | {
      type: "transcript-analysis-run.applied";
      occurredAt: string;
      range: RunRange;
    }
  | {
      type: "snapshot";
      proposals: ProposalHead[];
      runs: RunRange[];
    }
  | { type: "reset" };

export const initialContextState: ContextState = {
  proposals: {},
  runs: [],
  seenRunIds: [],
  lastBatchAt: null,
  needsRefetch: false,
  activities: [],
};

const MAX_ACTIVITIES = 12;

function withActivity(state: ContextState, activity: ContextActivity) {
  return [
    activity,
    ...state.activities.filter((current) => current.key !== activity.key),
  ].slice(0, MAX_ACTIVITIES);
}

function sortRanges(ranges: RunRange[]) {
  return [...ranges].sort(
    (a, b) =>
      a.fromSequence - b.fromSequence ||
      a.toSequence - b.toSequence ||
      a.runId.localeCompare(b.runId)
  );
}

function laterInstant(current: string | null, incoming: string | null) {
  if (!incoming) return current;
  const b = Date.parse(incoming);
  if (Number.isNaN(b)) return current;
  if (!current) return incoming;
  const a = Date.parse(current);
  if (Number.isNaN(a)) return incoming;
  return b > a ? incoming : current;
}

function byId(proposals: ProposalHead[]) {
  return Object.fromEntries(proposals.map((c) => [c.proposalId, c]));
}

export function reduceContextEvent(
  state: ContextState,
  event: ContextEvent
): ContextState {
  switch (event.type) {
    case "reset":
      return initialContextState;

    case "snapshot": {
      const proposals = byId(event.proposals);
      for (const current of Object.values(state.proposals)) {
        const incoming = proposals[current.proposalId];
        if (!incoming || incoming.revision < current.revision) {
          proposals[current.proposalId] = current;
        }
      }
      const snapshotRunIds = new Set(event.runs.map((range) => range.runId));
      const ranges = sortRanges([
        ...event.runs,
        ...state.runs.filter((range) => !snapshotRunIds.has(range.runId)),
      ]);
      const latestApplied = ranges.reduce<string | null>(
        (latest, range) => laterInstant(latest, range.appliedAt),
        null
      );
      return {
        proposals,
        runs: ranges,
        seenRunIds: state.seenRunIds,
        lastBatchAt: laterInstant(state.lastBatchAt, latestApplied),
        needsRefetch: false,
        activities: state.needsRefetch
          ? withActivity(state, {
              type: "sync",
              key: `sync-${state.activities[0]?.key ?? "snapshot"}`,
              outcome: "RECOVERED",
            })
          : state.activities,
      };
    }

    case "proposal.changed": {
      const next = event.proposal;
      const current = state.proposals[next.proposalId];

      if (current && next.revision <= current.revision) {
        return {
          ...state,
          activities: withActivity(state, {
            type: "proposal",
            key: `${next.proposalId}-${next.revision}-absorbed`,
            occurredAt: event.occurredAt,
            proposalId: next.proposalId,
            revision: next.revision,
            kind: next.kind,
            operation: next.operation,
            outcome: "ABSORBED",
          }),
        };
      }

      const expected = current ? current.revision + 1 : 1;
      const needsRefetch = state.needsRefetch || next.revision !== expected;

      return {
        ...state,
        proposals: { ...state.proposals, [next.proposalId]: next },
        needsRefetch,
        activities: withActivity(state, {
          type: "proposal",
          key: `${next.proposalId}-${next.revision}`,
          occurredAt: event.occurredAt,
          proposalId: next.proposalId,
          revision: next.revision,
          kind: next.kind,
          operation: next.operation,
          outcome: next.revision === expected ? "APPLIED" : "RESYNC_REQUIRED",
        }),
      };
    }

    case "transcript-analysis-run.applied": {
      const activity = {
        type: "batch" as const,
        key: `${event.range.runId}-batch`,
        runId: event.range.runId,
        occurredAt: event.occurredAt,
        fromSequence: event.range.fromSequence,
        toSequence: event.range.toSequence,
        applyStatus: event.range.applyStatus,
      };
      if (state.seenRunIds.includes(event.range.runId)) {
        return {
          ...state,
          activities: withActivity(state, {
            ...activity,
            key: `${activity.key}-absorbed`,
            outcome: "ABSORBED",
          }),
        };
      }

      const withoutRun = state.runs.filter(
        (range) => range.runId !== event.range.runId
      );
      return {
        ...state,
        runs: sortRanges([...withoutRun, event.range]),
        seenRunIds: [...state.seenRunIds, event.range.runId],
        lastBatchAt: laterInstant(state.lastBatchAt, event.range.appliedAt),
        activities: withActivity(state, { ...activity, outcome: "APPLIED" }),
      };
    }

    default:
      return state;
  }
}

export function selectCards(state: ContextState): ContextCard[] {
  const all = Object.values(state.proposals);
  const results = new Map<string, ProposalHead[]>();

  for (const proposal of all) {
    if (!proposal.resolvesProposalId) continue;
    const bucket = results.get(proposal.resolvesProposalId) ?? [];
    bucket.push(proposal);
    results.set(proposal.resolvesProposalId, bucket);
  }

  const byOrder = (
    a: { createdSequence: number; proposalId: string },
    b: { createdSequence: number; proposalId: string }
  ) =>
    a.createdSequence - b.createdSequence ||
    // TSID 는 Crockford base32 라 코드 단위 비교가 서버의 `ORDER BY` 와 같습니다. `localeCompare` 는 로케일마다 순서가 달라 쓰지 않습니다.
    (a.proposalId < b.proposalId ? -1 : a.proposalId > b.proposalId ? 1 : 0);

  return all
    .filter((proposal) => {
      if (!proposal.resolvesProposalId) return true;
      return !(proposal.resolvesProposalId in state.proposals);
    })
    .sort(byOrder)
    .map((proposal) => ({
      ...proposal,
      results: (results.get(proposal.proposalId) ?? []).sort(byOrder),
    }));
}
