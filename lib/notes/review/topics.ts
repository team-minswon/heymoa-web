import type { CitedSpan } from "@/lib/notes/review/moments";
import type { ReviewItem } from "@/lib/notes/review/sections";
import {
  summaryTopics,
  topicKey,
  type MeetingReviewSummary,
  type SummarySentence,
} from "@/lib/notes/review/summary";

export type TopicChip = {
  ordinal: number;
  title: string;
  count: number;
  gist: string | null;
};

export function topicIndex(summary: MeetingReviewSummary | null | undefined) {
  const index = new Map<string, number>();
  for (const topic of summaryTopics(summary)) {
    for (const member of topic.members) {
      if (!index.has(member.itemId)) index.set(member.itemId, topic.ordinal);
    }
  }
  return index;
}

export type TopicDigest = TopicChip & {
  key: string;
  agendaId: string | null;
  description: SummarySentence[];
  conclusions: SummarySentence[];
  openItems: SummarySentence[];
  text: string;
  startMs: number | null;
  endMs: number | null;
  decisions: ReviewItem[];
  tasks: ReviewItem[];
  open: ReviewItem[];
};

export function topicDigests(
  summary: MeetingReviewSummary | null | undefined,
  itemsById: ReadonlyMap<string, ReviewItem>,
  spanOf: (item: ReviewItem) => CitedSpan | null
): TopicDigest[] {
  const pick = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const item = itemsById.get(id);
      return item?.included ? [item] : [];
    });
  return summaryTopics(summary)
    .map((topic) => {
      const members = pick(topic.members.map((member) => member.itemId));
      const added = members
        .filter(
          (item) =>
            (item.kind === "QUESTION" || item.kind === "ISSUE") &&
            Boolean(item.authoredByUserId)
        )
        .map((item) => item.itemId);
      const open = pick([...new Set([...topic.openItemIds, ...added])]);
      const spans = [...members, ...open].flatMap((item) => {
        const span = spanOf(item);
        return span === null ? [] : [span];
      });
      const narrative = topic.description;
      const narrativeText = narrative
        .map((row) => row.text)
        .join(" ")
        .trim();
      const text = narrativeText || topic.summary?.trim() || "";
      const decisions = members.filter((item) => item.kind === "DECISION");
      const tasks = members.filter((item) => item.kind === "ACTION_ITEM");
      return {
        key: topicKey(topic),
        agendaId: topic.agendaId,
        ordinal: topic.ordinal,
        title: topic.title,
        description: topic.description,
        conclusions: topic.conclusions,
        openItems: topic.openItems,
        gist: topic.summary?.trim() || text || null,
        text,
        count: decisions.length + tasks.length,
        startMs:
          spans.length > 0
            ? Math.min(...spans.map((span) => span.startMs))
            : null,
        endMs:
          spans.length > 0
            ? Math.max(...spans.map((span) => span.endMs))
            : null,
        decisions,
        tasks,
        open,
      };
    })
    .sort(
      (a, b) =>
        (a.startMs ?? Number.POSITIVE_INFINITY) -
          (b.startMs ?? Number.POSITIVE_INFINITY) || a.ordinal - b.ordinal
    );
}

export type LinkedItem = { itemId: string; kind: string; label: string };

export function linkedItemsOf(
  summary: MeetingReviewSummary | null | undefined,
  itemId: string
): LinkedItem[] {
  const seen = new Set<string>();
  const linked: LinkedItem[] = [];
  for (const topic of summaryTopics(summary)) {
    const agendaItems = new Set(
      topic.members
        .filter((member) => member.kind === "AGENDA")
        .map((member) => member.itemId)
    );
    for (const relation of topic.relations) {
      if (relation.sourceItemId !== itemId && relation.targetItemId !== itemId)
        continue;
      if (
        agendaItems.has(relation.sourceItemId) ||
        agendaItems.has(relation.targetItemId)
      )
        continue;
      const other =
        relation.sourceItemId === itemId
          ? relation.targetItemId
          : relation.sourceItemId;
      if (other === itemId || seen.has(other)) continue;
      seen.add(other);
      linked.push({
        itemId: other,
        kind: relation.kind,
        label: relation.label,
      });
    }
  }
  return linked;
}

export const topicNumber = (ordinal: number) =>
  String(ordinal).padStart(2, "0");
