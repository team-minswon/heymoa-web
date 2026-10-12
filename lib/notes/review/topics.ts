import type { ReviewItem } from "@/lib/notes/review/sections";
import { summaryTopics, topicKey, type MeetingReviewSummary, type SummarySentence } from "@/lib/notes/review/summary";

export type TopicChip = {
  ordinal: number;
  title: string;
  count: number;
  /** 주제 한 줄. 제목만으로는 무엇을 정했는지 모른다 */
  gist: string | null;
};

/** 항목 → 주제 번호. 주제 밖 항목(사람이 더한 항목 포함)은 없다. */
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
  /** 화면 key. 옛 노트(안건 행 없음)는 agendaId 가 null 이라 순서 번호로 대신한다 */
  key: string;
  agendaId: string | null;
  /** 설명 · 결론 · 남은 일. 회의 중이거나 분석이 못 만들었으면 빈 배열이다 */
  description: SummarySentence[];
  conclusions: SummarySentence[];
  openItems: SummarySentence[];
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
  return summaryTopics(summary)
    .map((topic) => {
      const members = pick(topic.members.map((member) => member.itemId));
      const open = pick(topic.openItemIds);
      const times = [...members, ...open].flatMap((item) => {
        const at = citedAt(item);
        return at === null ? [] : [at];
      });
      // 서술은 description. 안건 행이 없는 옛 요약(agendaId 없음)만 합친 문장을 쓴다 — 새 안건의 합친 문장에는
      // 결론 · 남은 일이 섞여 있어 쓰면 겹친다. 서버가 그 칸을 지우면 빈 값이다.
      const narrative = topic.agendaId === null ? (topic.sentences ?? []) : topic.description;
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
        // 주제 한 줄은 서버의 summary. 없으면 예전처럼 서술의 첫 문장이다
        gist: topic.summary ?? narrative[0]?.text ?? null,
        text: narrative.map((row) => row.text).join(" "),
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
  for (const topic of summaryTopics(summary)) {
    // 주제의 안건 항목에서 나가는 관계는 「이 주제에 속한다」는 뜻이라 관련 항목이 아니다
    const agendaItems = new Set(topic.members.filter((member) => member.kind === "AGENDA").map((member) => member.itemId));
    for (const relation of topic.relations) {
      if (relation.sourceItemId !== itemId && relation.targetItemId !== itemId) continue;
      if (agendaItems.has(relation.sourceItemId) || agendaItems.has(relation.targetItemId)) continue;
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
