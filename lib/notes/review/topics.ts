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
  /** 안건 요약 전문. 문장 수나 길이를 제한하지 않는다 */
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
  /** 이 주제 근거 발화의 첫 시작 · 마지막 끝(ms). 인용으로 계산하고, 하나도 없으면 null */
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
      // 남은 질문 · 이슈는 서버 요약의 openItemIds 다. **사람이 이 주제에 직접 더한 질문 · 이슈는 거기 들지 않는다** —
      // 요약은 분석이 만든 것이라 members 에만 합쳐진다. 그대로 두면 펼친 주제와 회의록에서 통째로 빠졌다
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
      // 옛 응답에는 한 줄 summary와 긴 description이 함께 있다. 펼친 내용과 내보내기에서 전문을 보존한다.
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
        // 새 안건은 summary 전문, 옛 응답의 접힌 개요는 기존 한 줄 summary다.
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
      const labels: Record<string, string> = {
        LEADS_TO: "연결",
        SUPPORTS: "보완",
        PROGRESS: "보고",
        RESOLVES: "해결",
      };
      linked.push({
        itemId: other,
        label: labels[relation.kind] ?? relation.label,
      });
    }
  }
  return linked;
}

/** 주제 번호 표기. 두 자리로 맞춰 줄마다 같은 폭을 차지한다. */
export const topicNumber = (ordinal: number) =>
  String(ordinal).padStart(2, "0");
