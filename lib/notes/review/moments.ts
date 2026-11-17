import type { TranscriptResponseDataSegmentsItem } from "@/lib/api/generated/models";
import type { ReviewItem } from "@/lib/notes/review/sections";

type Segment = TranscriptResponseDataSegmentsItem;

export type CitedSpan = { startMs: number; endMs: number };

export const segmentsById = (segments: readonly Segment[]) =>
  new Map(segments.map((segment) => [segment.segmentId, segment]));

export function citedSpanOf(
  item: Pick<ReviewItem, "citations">,
  byId: ReadonlyMap<string, Segment>
): CitedSpan | null {
  let span: CitedSpan | null = null;
  for (const { segmentId } of item.citations) {
    const segment = byId.get(segmentId);
    if (!segment) continue;
    span = span
      ? {
          startMs: Math.min(span.startMs, segment.startedAtMs),
          endMs: Math.max(span.endMs, segment.endedAtMs),
        }
      : { startMs: segment.startedAtMs, endMs: segment.endedAtMs };
  }
  return span;
}

export type Quote = { segment: Segment; cited: boolean };

export function quotesOf(
  item: Pick<ReviewItem, "citations">,
  segments: readonly Segment[]
): Quote[] {
  const cited = new Set(item.citations.map((row) => row.segmentId));
  const picked = new Set<number>();
  segments.forEach((segment, at) => {
    if (!cited.has(segment.segmentId)) return;
    if (at > 0) picked.add(at - 1);
    picked.add(at);
  });
  return [...picked]
    .sort((a, b) => a - b)
    .map((at) => ({
      segment: segments[at],
      cited: cited.has(segments[at].segmentId),
    }));
}

export function tickLabel(
  minutes: number,
  units: {
    minutes: (count: number) => string;
    hours: (count: number) => string;
  }
) {
  if (minutes === 0) return "0:00";
  if (minutes < 60) return units.minutes(minutes);
  const rest = minutes % 60;
  return rest === 0
    ? units.hours(minutes / 60)
    : `${Math.floor(minutes / 60)}:${String(rest).padStart(2, "0")}`;
}

export function ticksOf(lengthMs: number): number[] {
  const total = Math.max(1, Math.round(lengthMs / 60_000));
  const step =
    [5, 10, 15, 30, 60, 120].find((size) => total / size <= 5) ?? 180;
  const ticks = [0];
  for (let minute = step; minute < total; minute += step) {
    if (total - minute >= total * 0.08) ticks.push(minute);
  }
  ticks.push(total);
  return ticks;
}

export function lengthParts(lengthMs: number) {
  const minutes = Math.round(lengthMs / 60_000);
  if (minutes < 1) return null;
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
