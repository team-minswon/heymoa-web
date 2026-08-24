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

/**
 * 전사 행과 커버리지 행을 회의 축 하나에 세운다.
 *
 * 같은 좌표에서는 **전사가 먼저**다. 공백 안내가 그 구간 첫 발화보다 위에 서면 무엇에 대한
 * 안내인지 읽는 순서가 뒤집힌다.
 */
export function withCoverageRows(
  rows: TranscriptRow[],
  appliedRanges: AppliedRange[]
): MergedTranscriptRow[] {
  const overlays: ContextTimelineRow[] = [
    ...findCoverageGaps(appliedRanges).map(
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
