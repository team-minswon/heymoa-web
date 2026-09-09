import type {
  MeetingReviewResponseDataItemsItem,
  MeetingReviewResponseDataItemsItemKind,
  TranscriptResponseDataSegmentsItem,
} from "@/lib/api/generated/models";
import { CONTEXT_KIND_LABEL } from "@/lib/notes/proposals/presentation";

export type ReviewItem = MeetingReviewResponseDataItemsItem;
export type ReviewKind = MeetingReviewResponseDataItemsItemKind;

/**
 * 섹션 순서. 서버는 항목을 평평한 목록으로 주므로 화면이 묶고 세운다. 요약 탭의
 * 개요·액션 아이템·결정과 같은 역할이다 — 회의를 훑는 순서가 곧 섹션 순서다.
 */
export const REVIEW_KIND_ORDER: readonly ReviewKind[] = [
  "AGENDA",
  "DECISION",
  "ACTION_ITEM",
  "ISSUE",
  "QUESTION",
  "STATUS_REPORT",
  "INSIGHT",
];

/** 실시간 정리 레일과 같은 이름을 쓴다. 두 화면이 같은 명제를 다르게 부르지 않는다. */
export const REVIEW_KIND_LABEL: Record<ReviewKind, string> = CONTEXT_KIND_LABEL;

export type ReviewSection = {
  kind: ReviewKind;
  label: string;
  items: ReviewItem[];
};

/**
 * 항목을 kind 순서로 묶는다. **항목이 없는 kind는 섹션을 만들지 않는다** — 일곱 머리글 중
 * 넷이 비어 있으면 회의가 아니라 양식으로 읽힌다. 제외한 항목은 자기 자리에 남긴다(복원할 수 있다).
 */
export function groupReviewItems(items: readonly ReviewItem[]): ReviewSection[] {
  return REVIEW_KIND_ORDER.flatMap((kind) => {
    const own = items.filter((item) => item.kind === kind);
    return own.length ? [{ kind, label: REVIEW_KIND_LABEL[kind], items: own }] : [];
  });
}

export type Evidence = {
  segmentId: string;
  text: string;
  startedAtMs: number;
  /** 라벨만 있다. 이름은 화자 배정이 끝나야 알 수 있고 그 표시는 전사 탭이 맡는다. */
  speakerLabel: string | null;
};

/**
 * 인용(`segmentId`)을 전사 줄로 푼다. 같은 줄을 두 번 인용해도 한 번만, 발화 순서대로.
 * 전사에 없는 줄은 뺀다 — 개수는 호출부가 `citations.length`로 따로 보여 준다.
 */
export function resolveCitations(
  citations: readonly { segmentId: string }[],
  segments: readonly TranscriptResponseDataSegmentsItem[]
): Evidence[] {
  const bySegment = new Map(segments.map((segment) => [segment.segmentId, segment]));
  const seen = new Set<string>();
  const found: Evidence[] = [];
  for (const { segmentId } of citations) {
    const segment = bySegment.get(segmentId);
    if (!segment || seen.has(segmentId)) continue;
    seen.add(segmentId);
    found.push({
      segmentId,
      text: segment.text,
      startedAtMs: segment.startedAtMs,
      speakerLabel: segment.speakerLabel,
    });
  }
  return found.sort((a, b) => a.startedAtMs - b.startedAtMs);
}
