import type {
  MeetingReviewResponseDataItemsItem,
  MeetingReviewResponseDataItemsItemKind,
} from "@/lib/api/generated/models";
import { missingChoicesOf } from "@/lib/notes/review/saved-choices";

export type ReviewItem = MeetingReviewResponseDataItemsItem;
export type ReviewKind = MeetingReviewResponseDataItemsItemKind;

export type SectionKey = "DECISION" | "ACTION_ITEM" | "OPEN" | "REFERENCE";

export const REVIEW_SECTIONS: ReadonlyArray<{
  key: SectionKey;
  kinds: readonly ReviewKind[];
}> = [
  { key: "DECISION", kinds: ["DECISION"] },
  { key: "ACTION_ITEM", kinds: ["ACTION_ITEM"] },
  { key: "OPEN", kinds: ["ISSUE", "QUESTION"] },
  { key: "REFERENCE", kinds: ["STATUS_REPORT", "INSIGHT", "AGENDA"] },
];

const SUMMARY_SECTION_KEYS: ReadonlySet<SectionKey> = new Set<SectionKey>([
  "DECISION",
  "ACTION_ITEM",
]);

export const isSummarySection = (key: SectionKey) =>
  SUMMARY_SECTION_KEYS.has(key);

export const isSummaryKind = (kind: ReviewKind) =>
  REVIEW_SECTIONS.some(
    (row) => SUMMARY_SECTION_KEYS.has(row.key) && row.kinds.includes(kind)
  );

export const ASSIGNABLE_KINDS: ReadonlySet<ReviewKind> = new Set<ReviewKind>([
  "ACTION_ITEM",
  "ISSUE",
  "QUESTION",
]);

export type ReviewSection = {
  key: SectionKey;
  items: ReviewItem[];
  includedCount: number;
};

const hasSuggestion = (item: ReviewItem) =>
  item.replacements.length > 0 ||
  item.taskChanges.length > 0 ||
  missingChoicesOf(item).length > 0;

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
