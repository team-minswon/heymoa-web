import type { AppliedRange } from "@/lib/notes/context-candidates/contract";
import {
  findCoverageGaps,
  isSaturated,
  type CoverageGap,
} from "@/lib/notes/context-candidates/reducer";
import type { TranscriptRow } from "@/lib/transcription/presentation";

/**
 * 분류 커버리지를 전사 축에 얹는다.
 *
 * **여기가 `lib/notes` 인 이유는 의존 방향이다.** 전사는 후보를 모른다 — `lib/transcription`
 * 이 후보를 import 하면 feature 가 늘 때마다 전사를 고치게 된다. 반대 방향은 괜찮다.
 *
 * 좌표는 `startedAtMs` 다. `interleaveTranscript` 가 같은 축으로 세우므로 sequence 로 얹으면
 * 자리가 어긋난다.
 */

export type ContextTimelineRow =
  | { type: "coverage-gap"; startedAtMs: number; gap: CoverageGap }
  | { type: "saturated"; startedAtMs: number; range: AppliedRange };

export type MergedTranscriptRow = TranscriptRow | ContextTimelineRow;

/** 전사 양끝. **종료된 전사에서만 넘긴다** — 진행 중에는 후미 공백이 정상이다. */
export type TranscriptEdges = {
  fromSequence: number;
  toSequence: number;
  fromStartedAtMs: number;
  toEndedAtMs: number;
};

/**
 * 범위 사이의 공백에 더해 **양끝 공백**을 센다. 첫/마지막 분류 실행이 기록을 못 남기면
 * (`REJECTED_OUTPUT` 은 `appliedRanges` 에 안 온다) 그 구간은 범위 *사이*가 아니라
 * 선두·후미라, 사이만 보면 경고 없이 조용히 빠진다.
 *
 * **범위가 하나도 없으면 아무것도 안 만든다** — 분류가 아예 안 돈 회의(기능 이전의
 * 노트들)와 「전부 거절됐다」를 화면이 구분할 방법이 없고, 전자를 공백으로 칠하면
 * 오래된 회의마다 가짜 경고가 선다.
 */
function findEdgeGaps(
  appliedRanges: AppliedRange[],
  edges: TranscriptEdges
): CoverageGap[] {
  if (appliedRanges.length === 0) return [];
  const sorted = [...appliedRanges].sort(
    (a, b) => a.fromSequence - b.fromSequence
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const gaps: CoverageGap[] = [];
  if (first.fromSequence > edges.fromSequence) {
    gaps.push({
      fromSequence: edges.fromSequence,
      toSequence: first.fromSequence - 1,
      fromStartedAtMs: edges.fromStartedAtMs,
      toEndedAtMs: first.fromStartedAtMs,
    });
  }
  if (last.toSequence < edges.toSequence) {
    gaps.push({
      fromSequence: last.toSequence + 1,
      toSequence: edges.toSequence,
      fromStartedAtMs: last.toEndedAtMs,
      toEndedAtMs: edges.toEndedAtMs,
    });
  }
  return gaps;
}

/**
 * 전사 행과 커버리지 행을 회의 축 하나에 세운다.
 *
 * 같은 좌표에서는 **전사가 먼저**다. 공백 안내가 그 구간 첫 발화보다 위에 서면 무엇에 대한
 * 안내인지 읽는 순서가 뒤집힌다.
 */
export function withCoverageRows(
  rows: TranscriptRow[],
  appliedRanges: AppliedRange[],
  edges: TranscriptEdges | null = null
): MergedTranscriptRow[] {
  const overlays: ContextTimelineRow[] = [
    ...[
      ...findCoverageGaps(appliedRanges),
      ...(edges ? findEdgeGaps(appliedRanges, edges) : []),
    ].map(
      (gap) =>
        ({
          type: "coverage-gap",
          startedAtMs: gap.fromStartedAtMs,
          gap,
        }) as const
    ),
    ...appliedRanges.filter(isSaturated).map(
      (range) =>
        ({
          type: "saturated",
          startedAtMs: range.toEndedAtMs,
          range,
        }) as const
    ),
  ];

  if (overlays.length === 0) return rows;

  return [...rows, ...overlays].sort(
    (a, b) =>
      a.startedAtMs - b.startedAtMs ||
      // 같은 좌표면 전사가 먼저다.
      (isOverlay(a) ? 1 : 0) - (isOverlay(b) ? 1 : 0)
  );
}

function isOverlay(row: MergedTranscriptRow) {
  return row.type === "coverage-gap" || row.type === "saturated";
}
