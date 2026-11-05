import type {
  MeetingReviewResponseDataItemsItem,
  MeetingReviewResponseDataItemsItemKind,
} from "@/lib/api/generated/models";
import { missingChoicesOf } from "@/lib/notes/review/saved-choices";

export type ReviewItem = MeetingReviewResponseDataItemsItem;
export type ReviewKind = MeetingReviewResponseDataItemsItemKind;

export type SectionKey = "DECISION" | "ACTION_ITEM" | "OPEN" | "REFERENCE";

/**
 * 검토 화면의 섹션. 이름은 `notes.review.sections.names.<key>` 다. 회의가 끝난 사람이 묻는 순서다 — 무엇을 정했나, 누가 무엇을 하나,
 * 무엇이 안 풀렸나. 보고·인사이트·안건은 그 질문에 답하지 않아 「참고」로 접는다.
 */
export const REVIEW_SECTIONS: ReadonlyArray<{
  key: SectionKey;
  kinds: readonly ReviewKind[];
}> = [
  { key: "DECISION", kinds: ["DECISION"] },
  { key: "ACTION_ITEM", kinds: ["ACTION_ITEM"] },
  { key: "OPEN", kinds: ["ISSUE", "QUESTION"] },
  { key: "REFERENCE", kinds: ["STATUS_REPORT", "INSIGHT", "AGENDA"] },
];

/**
 * 요약 보기에 서는 섹션(APP-864). 회의 뒤 사람이 묻는 「무엇을 정했고 누가 무엇을 하나」만 남긴다.
 * 이슈 · 질문 · 참고는 요약 보기에 서지 않고(그래프 보기에는 선다), 확정에는 그대로 들어간다.
 */
const SUMMARY_SECTION_KEYS: ReadonlySet<SectionKey> = new Set<SectionKey>([
  "DECISION",
  "ACTION_ITEM",
]);

export const isSummarySection = (key: SectionKey) =>
  SUMMARY_SECTION_KEYS.has(key);

/** 이 종류의 항목이 요약 보기에 서는가. */
export const isSummaryKind = (kind: ReviewKind) =>
  REVIEW_SECTIONS.some(
    (row) => SUMMARY_SECTION_KEYS.has(row.key) && row.kinds.includes(kind)
  );

/** 담당 · 기한을 받는 종류. 할 일과 이슈 · 질문은 누가 언제까지 할지를 검토에서 정한다. */
export const ASSIGNABLE_KINDS: ReadonlySet<ReviewKind> = new Set<ReviewKind>([
  "ACTION_ITEM",
  "ISSUE",
  "QUESTION",
]);

export type ReviewSection = {
  key: SectionKey;
  /** 보일 차례로 선 항목. 제외한 항목도 자리를 지킨다 — 옮기면 펼친 줄이 닫힌다 */
  items: ReviewItem[];
  /** 포함된 항목 수. 확정되는 것만 센다 */
  includedCount: number;
};

const hasSuggestion = (item: ReviewItem) =>
  item.replacements.length > 0 ||
  item.taskChanges.length > 0 ||
  missingChoicesOf(item).length > 0;

/**
 * 항목을 섹션으로 나눈다. 제안이 붙은 항목이 먼저 선다 — 사람이 고를 것이 있는 줄이다.
 * 그다음은 주제 순서, 주제 밖 항목은 끝이다. [topic] 을 주면 그 주제의 항목만 남긴다.
 */
export function sectionsOf(
  items: readonly ReviewItem[],
  topicOf: (itemId: string) => number | null,
  topic: number | null = null
): ReviewSection[] {
  const order = new Map(items.map((item, index) => [item.itemId, index]));
  const rank = (item: ReviewItem) =>
    topicOf(item.itemId) ?? Number.MAX_SAFE_INTEGER;
  const visible =
    topic === null
      ? items
      : items.filter((item) => topicOf(item.itemId) === topic);

  return REVIEW_SECTIONS.map(({ key, kinds }) => {
    const own = visible
      .filter((item) => kinds.includes(item.kind))
      .sort(
        (a, b) =>
          Number(hasSuggestion(b)) - Number(hasSuggestion(a)) ||
          rank(a) - rank(b) ||
          (order.get(a.itemId) ?? 0) - (order.get(b.itemId) ?? 0)
      );
    return {
      key,
      items: own,
      includedCount: own.filter((item) => item.included).length,
    };
  });
}
