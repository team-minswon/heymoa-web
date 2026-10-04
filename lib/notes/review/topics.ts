import type { MeetingReviewSummary } from "@/lib/notes/review/summary";

export type TopicChip = {
  ordinal: number;
  title: string;
  count: number;
  /** 주제 서술의 첫 문장. 제목만으로는 무엇을 정했는지 모른다 */
  gist: string | null;
};

/** 항목 → 주제 번호. 주제 밖 항목(사람이 더한 항목 포함)은 없다. */
export function topicIndex(summary: MeetingReviewSummary | null | undefined) {
  const index = new Map<string, number>();
  for (const topic of summary?.topics ?? []) {
    for (const member of topic.members) {
      if (!index.has(member.itemId)) index.set(member.itemId, topic.ordinal);
    }
  }
  return index;
}

/**
 * `count` 는 검토본에서 제외된 항목을 뺀다. 검토본에서 찾지 못한 member 는 센다.
 * [shown] 을 주면 화면에 서지 않는 항목도 뺀다 — 목차의 수와 그 주제로 좁혔을 때 보이는 수가 같아야 한다.
 */
export function topicChips(
  summary: MeetingReviewSummary | null | undefined,
  items: readonly { itemId: string; included: boolean }[],
  shown: (itemId: string) => boolean = () => true
): TopicChip[] {
  const excluded = new Set(items.filter((item) => !item.included).map((item) => item.itemId));
  return (summary?.topics ?? []).map((topic) => ({
    ordinal: topic.ordinal,
    title: topic.title,
    count: topic.members.filter((member) => !excluded.has(member.itemId) && shown(member.itemId)).length,
    gist: topic.sentences[0]?.text ?? null,
  }));
}

export type LinkedItem = { itemId: string; label: string };

/**
 * 이 항목과 관계로 이어진 다른 항목. 한 쌍에 관계가 여럿이면 처음 것만 쓴다.
 * 주제 소속을 뜻하는 관계는 뺀다 — 같은 주제라는 사실은 주제 번호가 이미 말한다.
 */
export function linkedItemsOf(
  summary: MeetingReviewSummary | null | undefined,
  itemId: string
): LinkedItem[] {
  const seen = new Set<string>();
  const linked: LinkedItem[] = [];
  for (const topic of summary?.topics ?? []) {
    for (const relation of topic.relations) {
      if (relation.sourceItemId !== itemId && relation.targetItemId !== itemId) continue;
      if (relation.sourceItemId === topic.agendaItemId || relation.targetItemId === topic.agendaItemId) continue;
      const other = relation.sourceItemId === itemId ? relation.targetItemId : relation.sourceItemId;
      if (other === itemId || seen.has(other)) continue;
      seen.add(other);
      linked.push({ itemId: other, label: relation.label });
    }
  }
  return linked;
}

/** 주제 번호 표기. 두 자리로 맞춰 줄마다 같은 폭을 차지한다. */
export const topicNumber = (ordinal: number) => String(ordinal).padStart(2, "0");
