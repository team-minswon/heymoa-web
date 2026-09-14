import type {
  MeetingReviewResponseDataItemsItem,
  MeetingReviewResponseDataItemsItemKind,
} from "@/lib/api/generated/models";
import { CONTEXT_KIND_LABEL } from "@/lib/notes/proposals/presentation";

export type ReviewItem = MeetingReviewResponseDataItemsItem;
export type ReviewKind = MeetingReviewResponseDataItemsItemKind;

export type SectionKey = "DECISION" | "ACTION_ITEM" | "OPEN" | "REFERENCE";

/**
 * 검토 화면의 섹션. 회의가 끝난 사람이 묻는 순서다 — 무엇을 정했나, 누가 무엇을 하나,
 * 무엇이 안 풀렸나. 보고·인사이트·안건은 그 질문에 답하지 않아 「참고」로 접는다.
 */
export const REVIEW_SECTIONS: ReadonlyArray<{
  key: SectionKey;
  label: string;
  kinds: readonly ReviewKind[];
}> = [
  { key: "DECISION", label: "결정", kinds: ["DECISION"] },
  { key: "ACTION_ITEM", label: "할 일", kinds: ["ACTION_ITEM"] },
  { key: "OPEN", label: "이슈 · 질문", kinds: ["ISSUE", "QUESTION"] },
  { key: "REFERENCE", label: "참고", kinds: ["STATUS_REPORT", "INSIGHT", "AGENDA"] },
];

/** 담당 · 기한을 받는 종류. 할 일과 이슈 · 질문은 누가 언제까지 할지를 검토에서 정한다. */
export const ASSIGNABLE_KINDS: ReadonlySet<ReviewKind> = new Set<ReviewKind>(["ACTION_ITEM", "ISSUE", "QUESTION"]);

export const KIND_LABEL = CONTEXT_KIND_LABEL;

export type ReviewSection = {
  key: SectionKey;
  label: string;
  /** 보일 차례로 선 항목. 제외한 항목도 자리를 지킨다 — 옮기면 펼친 줄이 닫힌다 */
  items: ReviewItem[];
  /** 포함된 항목 수. 확정되는 것만 센다 */
  includedCount: number;
  kindCounts: Array<{ kind: ReviewKind; label: string; count: number }>;
};

const hasSuggestion = (item: ReviewItem) =>
  item.replacements.length > 0 || item.taskChanges.length > 0;

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
  const rank = (item: ReviewItem) => topicOf(item.itemId) ?? Number.MAX_SAFE_INTEGER;
  const visible = topic === null ? items : items.filter((item) => topicOf(item.itemId) === topic);

  return REVIEW_SECTIONS.map(({ key, label, kinds }) => {
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
      label,
      items: own,
      includedCount: own.filter((item) => item.included).length,
      kindCounts: kinds
        .map((kind) => ({
          kind,
          label: KIND_LABEL[kind],
          count: own.filter((item) => item.kind === kind && item.included).length,
        }))
        .filter((row) => row.count > 0),
    };
  });
}
