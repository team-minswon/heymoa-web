import type { TranscriptResponseDataSegmentsItem } from "@/lib/api/generated/models";
import type { ReviewItem } from "@/lib/notes/review/sections";

type Segment = TranscriptResponseDataSegmentsItem;

/**
 * 항목이 회의에서 나온 때(ms) — 인용한 스크립트 구간 중 가장 이른 시작이다. server 는 항목에 시각을 싣지
 * 않으므로 인용으로 계산한다(APP-865). 인용이 없거나 전사에서 못 찾으면 null 이다.
 */
export function citedAtOf(
  item: Pick<ReviewItem, "citations">,
  startOf: ReadonlyMap<string, number>
): number | null {
  let earliest: number | null = null;
  for (const { segmentId } of item.citations) {
    const at = startOf.get(segmentId);
    if (at !== undefined && (earliest === null || at < earliest)) earliest = at;
  }
  return earliest;
}

export const segmentStarts = (segments: readonly Segment[]) =>
  new Map(segments.map((segment) => [segment.segmentId, segment.startedAtMs]));

/** 회의 길이. 녹음 길이가 마지막 구간보다 짧게 오면 막대 밖으로 표시가 나가므로 둘 중 큰 값이다. */
export function meetingLengthOf(recordedMs: number | null | undefined, segments: readonly Segment[]) {
  return Math.max(recordedMs ?? 0, ...segments.map((segment) => segment.endedAtMs));
}

export type Quote = { segment: Segment; cited: boolean };

/**
 * 근거 발언 — 인용한 줄과 그 바로 앞 줄이다. 앞 줄은 무슨 말에 대한 답인지 보이는 맥락이라 흐리게 선다.
 * 스크립트 차례로 서고 겹치면 한 번만 선다.
 */
export function quotesOf(item: Pick<ReviewItem, "citations">, segments: readonly Segment[]): Quote[] {
  const cited = new Set(item.citations.map((row) => row.segmentId));
  const picked = new Set<number>();
  segments.forEach((segment, at) => {
    if (!cited.has(segment.segmentId)) return;
    if (at > 0) picked.add(at - 1);
    picked.add(at);
  });
  return [...picked]
    .sort((a, b) => a - b)
    .map((at) => ({ segment: segments[at], cited: cited.has(segments[at].segmentId) }));
}

/** 지도 눈금 이름. 시작은 `0:00`, 정시는 「1시간」, 그 밖은 「15분」 · 「1:15」 다. */
export function tickLabel(minutes: number) {
  if (minutes === 0) return "0:00";
  if (minutes < 60) return `${minutes}분`;
  const rest = minutes % 60;
  return rest === 0 ? `${minutes / 60}시간` : `${Math.floor(minutes / 60)}:${String(rest).padStart(2, "0")}`;
}

/**
 * 지도 눈금(분). 다섯 칸 안쪽이 되는 가장 잘게 나뉜 간격을 고르고 끝에 회의 길이를 둔다.
 * 끝과 너무 붙은 눈금은 이름이 겹치므로 뺀다.
 */
export function ticksOf(lengthMs: number): number[] {
  const total = Math.max(1, Math.round(lengthMs / 60_000));
  const step = [5, 10, 15, 30, 60, 120].find((size) => total / size <= 5) ?? 180;
  const ticks = [0];
  for (let minute = step; minute < total; minute += step) {
    if (total - minute >= total * 0.08) ticks.push(minute);
  }
  ticks.push(total);
  return ticks;
}

/** 회의 길이를 머리 칩에 쓸 말로. 「1시간 15분」 · 「42분」 · 「1분 미만」. */
export function lengthLabel(lengthMs: number) {
  const minutes = Math.round(lengthMs / 60_000);
  if (minutes < 1) return "1분 미만";
  if (minutes < 60) return `${minutes}분`;
  const rest = minutes % 60;
  return rest === 0 ? `${minutes / 60}시간` : `${Math.floor(minutes / 60)}시간 ${rest}분`;
}
