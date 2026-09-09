import type {
  MeetingReviewResponseDataItemsItem,
  MeetingReviewResponseDataItemsItemKind,
  TranscriptResponseDataSegmentsItem,
} from "@/lib/api/generated/models";
import {
  CONTEXT_DISCUSSION_KINDS,
  CONTEXT_KIND_LABEL,
  CONTEXT_OUTCOME_KINDS,
  CONTEXT_REFERENCE_KINDS,
} from "@/lib/notes/proposals/presentation";

export type ReviewItem = MeetingReviewResponseDataItemsItem;
export type ReviewKind = MeetingReviewResponseDataItemsItemKind;

/**
 * 유형의 차례. 묶음 안에서 항목이 서는 순서다. 레일의 `GROUP_ORDER` 와 같다.
 */
export const REVIEW_KIND_ORDER: readonly ReviewKind[] = [
  "DECISION",
  "ACTION_ITEM",
  "AGENDA",
  "ISSUE",
  "QUESTION",
  "STATUS_REPORT",
  "INSIGHT",
];

/** 실시간 정리 레일과 같은 이름을 쓴다. 두 화면이 같은 명제를 다르게 부르지 않는다. */
export const REVIEW_KIND_LABEL: Record<ReviewKind, string> = CONTEXT_KIND_LABEL;

export type ReviewGroupKey = "OUTCOME" | "DISCUSSION" | "REFERENCE";

/**
 * 세 묶음 — 결론 → 논의 중 → 참고. 유형 일곱을 머리글로 세우면 회의가 아니라 양식으로
 * 읽힌다. 종료 직후 레일(design.pen G5 `ywpDW`)이 이렇게 묶고, 검토본도 같은 집합을 본다.
 * 읽는 사람이 묻는 것은 「이렇게 합의한 게 맞나」라 결론이 먼저다.
 */
export const REVIEW_GROUPS: ReadonlyArray<{
  key: ReviewGroupKey;
  label: string;
  kinds: ReadonlySet<ReviewKind>;
  /** 처음부터 접어 둔다. 본문은 결정·할 일이고 나머지는 개수만 보이면 된다. */
  collapsed: boolean;
}> = [
  { key: "OUTCOME", label: "결론", kinds: CONTEXT_OUTCOME_KINDS, collapsed: false },
  { key: "DISCUSSION", label: "논의 중", kinds: CONTEXT_DISCUSSION_KINDS, collapsed: true },
  { key: "REFERENCE", label: "참고", kinds: CONTEXT_REFERENCE_KINDS, collapsed: true },
];

export type ReviewGroup = {
  key: ReviewGroupKey;
  label: string;
  collapsed: boolean;
  /**
   * 유형 차례로 선 항목 전부. 제외한 것도 **자기 자리에** 있다 — 화면이 숨길 뿐 목록에서
   * 옮기지 않는다. 옮기면 줄이 재마운트돼 열린 편집기와 충돌 안내가 사라진다.
   */
  items: ReviewItem[];
  excludedCount: number;
};

/**
 * 항목을 세 묶음으로 나눈다. **결론은 비어도 남긴다** — 「이 회의는 결론이 없다」는 그 자체가
 * 검토할 사실이다. 다른 묶음은 항목이 있을 때만 선다.
 */
export function groupReviewItems(items: readonly ReviewItem[]): ReviewGroup[] {
  const rank = new Map(REVIEW_KIND_ORDER.map((kind, index) => [kind, index]));
  const byKind = (a: ReviewItem, b: ReviewItem) =>
    (rank.get(a.kind) ?? 99) - (rank.get(b.kind) ?? 99);
  return REVIEW_GROUPS.flatMap(({ key, label, kinds, collapsed }) => {
    const own = items.filter((item) => kinds.has(item.kind)).sort(byKind);
    if (own.length === 0 && key !== "OUTCOME") return [];
    return [
      {
        key,
        label,
        collapsed,
        items: own,
        excludedCount: own.filter((item) => !item.included).length,
      },
    ];
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
