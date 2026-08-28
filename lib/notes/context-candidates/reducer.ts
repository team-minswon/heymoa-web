import type {
  AppliedRange,
  ContextCandidateHead,
} from "@/lib/notes/context-candidates/contract";

export type { AppliedRange, ContextCandidateHead };

/**
 * 후보 event를 화면 상태로 접는 순수 함수. React도 Query도 모른다.
 *
 * **전달 보장이 best-effort다.** WebSocket send 실패를 durable retry하지 않으므로 event가
 * 유실될 수 있다. 그래서 이 리듀서가 하는 일은 「도착한 것을 정확히 접는 것」까지이고,
 * 「빠진 것을 아는 것」은 `needsRefetch`로 provider에 넘긴다. 정합의 정본은 REST snapshot이다.
 *
 * 계약이 만드는 함정 넷을 여기서 못 박는다.
 *
 * 1. **`operation`에서 `status`를 유도하지 않는다.** `RESOLVE` 하나가 질문의 `CLOSED`와
 *    결과의 `OPEN`을 동시에 만든다. 유도 함수는 이 경우 반드시 틀린다.
 * 2. **정렬 키는 `createdSequence`다.** 도착 순서도 `revision`도 아니다. `AMEND`가 오면
 *    카드가 제자리에서 바뀌어야지 목록 아래로 튀면 시간순이 무너진다.
 * 3. **`REAFFIRM`은 event가 없다.** 서버에서는 evidence가 늘고 `lastEvidenceSequence`가
 *    전진하는데 화면은 신호를 못 받는다. 그래서 batch event를 받으면 provider가 snapshot을
 *    다시 받아 수렴시킨다 — 근거 개수를 실시간 지표로 쓰면 안 되는 이유다.
 * 4. **적용 범위의 구멍이 읽지 못한 구간이다.** `REJECTED_OUTPUT`은 apply를 안 거쳐 범위가
 *    아예 안 생긴다. 그 구간은 실시간으로 영영 오지 않는다.
 */

export type ContextCard = ContextCandidateHead & {
  /** `RESOLVE`가 만든 결과 후보. 질문 카드에만 찬다. */
  results: ContextCandidateHead[];
};

export type ContextActivityOutcome =
  | "APPLIED"
  | "ABSORBED"
  | "RESYNC_REQUIRED"
  | "RECOVERED";

/**
 * 실시간 프레임이 화면 상태에 어떻게 접혔는지 보여 주는 짧은 처리 이력.
 *
 * 서버 원장을 복제하는 감사 로그가 아니다. 전달은 best-effort이고 재연결 replay도 없으므로
 * 최근 프레임만 남기며, 정합성의 정본은 계속 REST snapshot이다.
 */
export type ContextActivity =
  | {
      type: "candidate";
      key: string;
      eventId: string;
      occurredAt: string;
      changeOrdinal: number;
      candidateId: string;
      revision: number;
      kind: ContextCandidateHead["kind"];
      operation: ContextCandidateHead["operation"];
      outcome: Exclude<ContextActivityOutcome, "RECOVERED">;
    }
  | {
      type: "batch";
      key: string;
      eventId: string;
      occurredAt: string;
      fromSequence: number;
      toSequence: number;
      applyStatus: AppliedRange["applyStatus"];
      outcome: "APPLIED" | "ABSORBED";
    }
  | {
      type: "sync";
      key: string;
      outcome: "RECOVERED";
    };

export type ContextState = {
  /** `candidateId` → 현재 head. */
  candidates: Record<string, ContextCandidateHead>;
  appliedRanges: AppliedRange[];
  /** 이미 접은 batch `eventId`. best-effort라 같은 것이 두 번 올 수 있다. */
  seenBatchIds: string[];
  /** 마지막 배치 적용 시각. **서버 값이다** — 수신 시각을 쓰면 재연결 직후 「방금」이 된다. */
  lastBatchAt: string | null;
  /** revision gap을 봤다. provider가 snapshot을 다시 받아야 한다. */
  needsRefetch: boolean;
  /** 가장 최근 처리가 앞에 오는, 화면용 bounded 이력. */
  activities: ContextActivity[];
};

export type ContextEvent =
  | {
      type: "context.candidate.changed";
      eventId: string;
      changeOrdinal: number;
      occurredAt: string;
      candidate: ContextCandidateHead;
    }
  | {
      type: "context.classification.batch.applied";
      eventId: string;
      occurredAt: string;
      range: AppliedRange;
    }
  | {
      type: "snapshot";
      candidates: ContextCandidateHead[];
      appliedRanges: AppliedRange[];
    }
  | { type: "reset" };

export const initialContextState: ContextState = {
  candidates: {},
  appliedRanges: [],
  seenBatchIds: [],
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

/** `(fromSequence, toSequence, runKey)` 오름차순. 서버 정렬과 같은 순서다. */
function sortRanges(ranges: AppliedRange[]) {
  return [...ranges].sort(
    (a, b) =>
      a.fromSequence - b.fromSequence ||
      a.toSequence - b.toSequence ||
      a.runKey.localeCompare(b.runKey)
  );
}

/**
 * **갱신 시각은 뒤로 가지 않는다.** batch event 는 best-effort 이고 relay 가 여럿이라
 * 늦은 옛 event 가 뒤늦게 도착할 수 있다. 그때 `appliedAt` 을 무조건 덮으면 화면의 「갱신」이
 * 과거로 뛴다 — `appliedRanges` 가 runKey 로 수렴하듯 이 값도 max 로 수렴시킨다.
 *
 * 비교는 시각으로 한다. 문자열 비교는 같은 표기(둘 다 `Z`)일 때만 맞고, offset 표기가
 * 섞이면 틀린다. 파싱이 안 되는 값은 기존 값을 지킨다.
 */
function laterInstant(current: string | null, incoming: string | null) {
  if (!incoming) return current;
  // **들어온 값을 먼저 검증한다.** `!current` 를 먼저 보면 malformed 첫 값이 검사 없이
  // 통과해 화면에서 `Invalid Date` 가 된다 — 상태가 빈 순간이 가장 무방비다.
  const b = Date.parse(incoming);
  if (Number.isNaN(b)) return current;
  if (!current) return incoming;
  const a = Date.parse(current);
  if (Number.isNaN(a)) return incoming;
  return b > a ? incoming : current;
}

function byId(candidates: ContextCandidateHead[]) {
  return Object.fromEntries(candidates.map((c) => [c.candidateId, c]));
}

export function reduceContextEvent(
  state: ContextState,
  event: ContextEvent
): ContextState {
  switch (event.type) {
    case "reset":
      return initialContextState;

    case "snapshot": {
      // REST가 정본이다. 임시로 접어 둔 것을 버리고 이걸로 다시 선다.
      const ranges = sortRanges(event.appliedRanges);
      // **갱신 시각도 snapshot 에서 복원한다.** event 로만 채우면, 종료된 회의를 새 탭에서
      // 열었을 때 범위가 있는데도 갱신 띠가 영원히 빈다 — 그 회의는 더 이상 event 가 안 온다.
      const latestApplied = ranges.reduce<string | null>(
        (latest, range) => laterInstant(latest, range.appliedAt),
        null
      );
      return {
        candidates: byId(event.candidates),
        appliedRanges: ranges,
        seenBatchIds: [],
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

    case "context.candidate.changed": {
      const next = event.candidate;
      const current = state.candidates[next.candidateId];

      // 역순·중복. 같은 revision이 다시 와도 여기서 걸린다.
      if (current && next.revision <= current.revision) {
        return {
          ...state,
          activities: withActivity(state, {
            type: "candidate",
            key: `${event.eventId}-${event.changeOrdinal}-absorbed`,
            eventId: event.eventId,
            occurredAt: event.occurredAt,
            changeOrdinal: event.changeOrdinal,
            candidateId: next.candidateId,
            revision: next.revision,
            kind: next.kind,
            operation: next.operation,
            outcome: "ABSORBED",
          }),
        };
      }

      // 처음 보는데 revision이 1이 아니거나, 이어지지 않으면 사이를 놓쳤다.
      const expected = current ? current.revision + 1 : 1;
      const needsRefetch = state.needsRefetch || next.revision !== expected;

      return {
        ...state,
        candidates: { ...state.candidates, [next.candidateId]: next },
        needsRefetch,
        activities: withActivity(state, {
          type: "candidate",
          key: `${event.eventId}-${event.changeOrdinal}`,
          eventId: event.eventId,
          occurredAt: event.occurredAt,
          changeOrdinal: event.changeOrdinal,
          candidateId: next.candidateId,
          revision: next.revision,
          kind: next.kind,
          operation: next.operation,
          outcome: next.revision === expected ? "APPLIED" : "RESYNC_REQUIRED",
        }),
      };
    }

    case "context.classification.batch.applied": {
      const activity = {
        type: "batch" as const,
        key: `${event.eventId}-batch`,
        eventId: event.eventId,
        occurredAt: event.occurredAt,
        fromSequence: event.range.fromSequence,
        toSequence: event.range.toSequence,
        applyStatus: event.range.applyStatus,
      };
      if (state.seenBatchIds.includes(event.eventId)) {
        return {
          ...state,
          activities: withActivity(state, {
            ...activity,
            key: `${activity.key}-absorbed`,
            outcome: "ABSORBED",
          }),
        };
      }

      const withoutRun = state.appliedRanges.filter(
        (range) => range.runKey !== event.range.runKey
      );
      return {
        ...state,
        appliedRanges: sortRanges([...withoutRun, event.range]),
        seenBatchIds: [...state.seenBatchIds, event.eventId],
        lastBatchAt: laterInstant(state.lastBatchAt, event.range.appliedAt),
        activities: withActivity(state, { ...activity, outcome: "APPLIED" }),
      };
    }

    default:
      return state;
  }
}

/**
 * 시간순 카드 목록. 결과 후보는 최상위에 두 번 나오지 않고 질문 아래로 들어간다.
 *
 * **닫힌 후보를 걸러내지 않는다.** `RESOLVE`로 닫힌 질문을 감추면 사용자가 그 질문을 되짚을
 * 표면이 없어지고, 철회된 후보는 무엇이 취소됐는지가 화면에서 사라진다.
 */
export function selectCards(state: ContextState): ContextCard[] {
  const all = Object.values(state.candidates);
  const results = new Map<string, ContextCandidateHead[]>();

  for (const candidate of all) {
    if (!candidate.resolvesCandidateId) continue;
    const bucket = results.get(candidate.resolvesCandidateId) ?? [];
    bucket.push(candidate);
    results.set(candidate.resolvesCandidateId, bucket);
  }

  /**
   * **계약의 정렬 키는 `(createdSequence, candidateId)` 둘이다.** 한 batch 가 여러 후보를
   * 같은 sequence 로 낼 수 있어서 `createdSequence` 만 비교하면 동률의 순서가 도착 순서에
   * 좌우된다 — 같은 원장을 역순 event 로 채운 화면과 snapshot 으로 채운 화면이 달라진다.
   */
  const byOrder = (
    a: { createdSequence: number; candidateId: string },
    b: { createdSequence: number; candidateId: string }
  ) =>
    a.createdSequence - b.createdSequence ||
    // TSID는 Crockford base32라 코드 단위 비교가 곧 서버의 `ORDER BY candidate_id ASC`다.
    // `localeCompare`는 로케일에 따라 숫자와 문자의 순서가 달라질 수 있어 쓰지 않는다.
    (a.candidateId < b.candidateId
      ? -1
      : a.candidateId > b.candidateId
        ? 1
        : 0);

  return all
    .filter((candidate) => {
      if (!candidate.resolvesCandidateId) return true;
      // 부모가 아직 안 왔으면 최상위에 남겨 둔다 — 안 그러면 화면에서 사라진다.
      return !(candidate.resolvesCandidateId in state.candidates);
    })
    .sort(byOrder)
    .map((candidate) => ({
      ...candidate,
      results: (results.get(candidate.candidateId) ?? []).sort(byOrder),
    }));
}

export type CoverageGap = {
  fromSequence: number;
  toSequence: number;
  fromStartedAtMs: number;
  toEndedAtMs: number;
};

/**
 * 적용 범위 **사이**의 구멍. 분류가 닿지 않은 구간이다.
 *
 * **양끝은 판정하지 않는다.** 첫 범위 이전과 마지막 범위 이후가 구멍인지는 note의 확정 전사
 * 범위를 함께 봐야 알 수 있고, 회의 중에는 「아직 안 왔다」와 구분되지 않는다.
 */
export function findCoverageGaps(ranges: AppliedRange[]): CoverageGap[] {
  const sorted = sortRanges(ranges);
  const gaps: CoverageGap[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (current.fromSequence <= previous.toSequence + 1) continue;
    gaps.push({
      fromSequence: previous.toSequence + 1,
      toSequence: current.fromSequence - 1,
      fromStartedAtMs: previous.toEndedAtMs,
      toEndedAtMs: current.fromStartedAtMs,
    });
  }
  return gaps;
}

/**
 * 「이 구간에 더 있을 수 있어요」로 그릴 범위인가.
 *
 * 셋을 가르지 않는다 — 원인은 다르지만 **사용자가 할 일이 같다.** 원인은 wire 에 그대로
 * 남아 있다.
 *
 * | 왜 덜 실렸나 | 필드 |
 * |---|---|
 * | 모델이 delta 상한에 닿았다 | `rawDeltaSaturated` |
 * | semantic unit 상한에 닿았다 | `semanticUnitSaturated` |
 * | **출력 일부가 기록되지 못했다** | `applyStatus === "PARTIAL_RECORDED"` |
 *
 * **셋째를 빠뜨리고 있었다.** 합성 시나리오 108발화를 lane 에 태운 실측에서 13런 중 포화는 1건뿐인데 모델 출력
 * 26건이 버려졌다 — 포화만 보면 그 26건이 화면에서 통째로 안 보이고, 구간은 「읽었다」로
 * 표시된다. 범위가 다 찼다는 표시가 내용이 다 담겼다는 뜻으로 읽히는 자리라, 이건 빈 화면
 * 보다 나쁘다. **안심시키는 거짓말이기 때문이다.**
 *
 * 이것도 여전히 「덜 실렸을 수 있다」이지 「덜 실렸다」가 아니다. `PARTIAL_RECORDED` 는
 * 기록되지 못한 출력이 있었다는 뜻이고, 그 출력이 실제로 새 항목이었는지는 모른다.
 */
export function isSaturated(range: AppliedRange) {
  return (
    range.rawDeltaSaturated ||
    range.semanticUnitSaturated ||
    range.applyStatus === "PARTIAL_RECORDED"
  );
}
