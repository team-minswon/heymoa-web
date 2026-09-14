import type { MeetingReviewResponseDataItemsItem } from "@/lib/api/generated/models";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";

type ReviewItem = MeetingReviewResponseDataItemsItem;

/** 그래프의 색 역할. 종류 일곱을 넷으로 줄여 한눈에 가른다 */
export type GraphRole = "DECISION" | "ACTION" | "OPEN" | "REFERENCE";

export const GRAPH_ROLE_ORDER: readonly GraphRole[] = [
  "DECISION",
  "ACTION",
  "OPEN",
  "REFERENCE",
];

export const GRAPH_ROLE_LABEL: Record<GraphRole, string> = {
  DECISION: "결정",
  ACTION: "할 일",
  OPEN: "미해결",
  REFERENCE: "참고",
};

export type GraphNode = {
  id: string;
  group: number | null;
  role: GraphRole;
  kind: ReviewItem["kind"];
  content: string;
  /** 주제의 가운데 항목 */
  center: boolean;
};

export type GraphEdge = {
  source: string;
  target: string;
  weight: number;
  /** 다른 주제의 안건에도 붙은 약한 연결 */
  also: boolean;
};

export type ReviewGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  topics: Map<number, string>;
};

/**
 * 검토 항목과 요약의 주제 묶음으로 그래프를 만든다. 제외한 항목은 확정에 안 들어가므로 그리지 않는다.
 * 미해결은 종류가 아니라 주제가 「결론 없이 남았다」고 짚은 이슈·질문이다 — 답이 나온 질문은 참고다.
 */
export function buildReviewGraph(
  summary: MeetingReviewSummary,
  items: readonly ReviewItem[]
): ReviewGraph {
  const shown = items.filter((item) => item.included);
  const present = new Set(shown.map((item) => item.itemId));
  const groupOf = new Map<string, number>();
  const open = new Set<string>();
  const centers = new Set<string>();
  for (const topic of summary.topics) {
    for (const member of topic.members) {
      if (!groupOf.has(member.itemId)) groupOf.set(member.itemId, topic.ordinal);
    }
    for (const itemId of topic.openItemIds) open.add(itemId);
    if (topic.centerItemId) centers.add(topic.centerItemId);
  }

  const nodes = shown.map((item): GraphNode => ({
    id: item.itemId,
    group: groupOf.get(item.itemId) ?? null,
    role:
      item.kind === "DECISION"
        ? "DECISION"
        : item.kind === "ACTION_ITEM"
          ? "ACTION"
          : (item.kind === "ISSUE" || item.kind === "QUESTION") && open.has(item.itemId)
            ? "OPEN"
            : "REFERENCE",
    kind: item.kind,
    content: item.content,
    center: centers.has(item.itemId),
  }));

  const edges = new Map<string, GraphEdge>();
  const connect = (source: string, target: string, weight: number, also: boolean) => {
    if (source === target || !present.has(source) || !present.has(target)) return;
    const key = [source, target].sort().join("→");
    if (!edges.has(key)) edges.set(key, { source, target, weight, also });
  };
  for (const topic of summary.topics) {
    for (const relation of topic.relations) {
      connect(relation.sourceItemId, relation.targetItemId, 1, false);
    }
    // 「다른 주제에도 속함」은 이 주제의 안건에도 붙었다는 뜻이라 안건에서 잇는다. 안건이 없을 때만 중심에서 잇는다.
    const alsoAnchor = topic.agendaItemId ?? topic.centerItemId;
    if (alsoAnchor) {
      for (const itemId of topic.alsoItemIds) connect(alsoAnchor, itemId, 0.12, true);
    }
  }

  return {
    nodes,
    edges: [...edges.values()],
    topics: new Map(summary.topics.map((topic) => [topic.ordinal, topic.title])),
  };
}
