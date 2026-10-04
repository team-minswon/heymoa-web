import type { ReviewItem } from "@/lib/notes/review/sections";
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

export type TopicDigest = TopicChip & {
  /** 주제 서술 전체 */
  text: string;
  /** 이 주제 항목이 처음 · 마지막으로 나온 때(ms). 인용으로 계산하고, 하나도 없으면 null */
  startMs: number | null;
  endMs: number | null;
  decisions: ReviewItem[];
  tasks: ReviewItem[];
  /** 결론 없이 남은 이슈 · 질문. 요약 보기의 섹션에는 없지만 주제를 펼치면 선다 */
  open: ReviewItem[];
};

/**
 * 주제를 펼쳐 읽는 단위로 묶는다(APP-865). 뺀 항목과 검토본에 없는 항목은 싣지 않는다 — 펼친 목록과
 * 개수가 같아야 한다. `count` 는 결정과 할 일 수다. 회의에서 처음 나온 때 차례로 서고, 때를 모르는
 * 주제는 끝에 번호 차례로 선다.
 */
export function topicDigests(
  summary: MeetingReviewSummary | null | undefined,
  itemsById: ReadonlyMap<string, ReviewItem>,
  citedAt: (item: ReviewItem) => number | null
): TopicDigest[] {
  const pick = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const item = itemsById.get(id);
      return item?.included ? [item] : [];
    });
  return (summary?.topics ?? [])
    .map((topic) => {
      const members = pick(topic.members.map((member) => member.itemId));
      const open = pick(topic.openItemIds);
      const times = [...members, ...open].flatMap((item) => {
        const at = citedAt(item);
        return at === null ? [] : [at];
      });
      const decisions = members.filter((item) => item.kind === "DECISION");
      const tasks = members.filter((item) => item.kind === "ACTION_ITEM");
      return {
        ordinal: topic.ordinal,
        title: topic.title,
        gist: topic.sentences[0]?.text ?? null,
        text: topic.sentences.map((sentence) => sentence.text).join(" "),
        count: decisions.length + tasks.length,
        startMs: times.length > 0 ? Math.min(...times) : null,
        endMs: times.length > 0 ? Math.max(...times) : null,
        decisions,
        tasks,
        open,
      };
    })
    .sort(
      (a, b) =>
        (a.startMs ?? Number.POSITIVE_INFINITY) - (b.startMs ?? Number.POSITIVE_INFINITY) ||
        a.ordinal - b.ordinal
    );
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
