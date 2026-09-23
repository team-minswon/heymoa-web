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
  const connect = (source: string, target: string, also: boolean) => {
    if (source === target || !present.has(source) || !present.has(target)) return;
    const key = [source, target].sort().join("→");
    if (!edges.has(key)) edges.set(key, { source, target, also });
  };
  for (const topic of summary.topics) {
    for (const relation of topic.relations) {
      connect(relation.sourceItemId, relation.targetItemId, false);
    }
    // 「다른 주제에도 속함」은 이 주제의 안건에도 붙었다는 뜻이라 안건에서 잇는다. 안건이 없을 때만 중심에서 잇는다.
    const alsoAnchor = topic.agendaItemId ?? topic.centerItemId;
    if (alsoAnchor) {
      for (const itemId of topic.alsoItemIds) connect(alsoAnchor, itemId, true);
    }
  }

  return {
    nodes,
    edges: [...edges.values()],
    topics: new Map(summary.topics.map((topic) => [topic.ordinal, topic.title])),
  };
}

/** 힘 배치의 점. 주제는 허브 점 하나로 서고, 항목은 그 허브에 매달린다 */
export type ForceNode = {
  id: string;
  hub: boolean;
  /** 허브면 null */
  item: GraphNode | null;
  /** 허브는 「01 제목」, 항목은 내용 */
  label: string;
  degree: number;
  radius: number;
  x: number;
  y: number;
};

/** 허브-항목 · 항목 사이 관계 · 다른 주제에도 속함 */
export type ForceLinkKind = "hub" | "relation" | "also";

export type ForceLink = { source: string; target: string; kind: ForceLinkKind };

export const hubId = (ordinal: number) => `topic:${ordinal}`;

export const topicNumber = (ordinal: number) => String(ordinal).padStart(2, "0");

/** 연결이 많을수록 크게. 제곱근이라 허브 몇 개가 판을 덮지 않는다 */
export function nodeRadius(degree: number, hub: boolean): number {
  return hub ? 8 + 0.8 * Math.sqrt(degree) : 5 + 0.7 * Math.sqrt(degree);
}

/** 화면에서 점 반지름의 아래위(px). 아래는 역할 색이 읽히는 크기, 위는 확대해도 점이 판을 덮지 않는 크기다 */
const SCREEN_RADIUS = { item: [4, 14], hub: [6, 22] } as const;

/** 그릴 반지름(배치 좌표). 배율 `scale` 에서 화면 크기가 위 범위를 벗어나지 않게 묶는다 */
export function screenRadius(radius: number, hub: boolean, scale: number): number {
  const [min, max] = SCREEN_RADIUS[hub ? "hub" : "item"];
  return Math.min(Math.max(radius, min / scale), max / scale);
}

/** 문자열에서 0~1 두 수를 뽑는다(FNV-1a). 같은 ID 는 늘 같은 자리에서 출발한다 */
function hashPair(id: string): [number, number] {
  let h = 2166136261;
  for (let at = 0; at < id.length; at += 1) {
    h ^= id.charCodeAt(at);
    h = Math.imul(h, 16777619);
  }
  const a = (h >>> 0) / 4294967296;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return [a, (h >>> 0) / 4294967296];
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function toForceGraph(graph: ReviewGraph): { nodes: ForceNode[]; links: ForceLink[] } {
  const ordinals = [...graph.topics.keys()].filter((ordinal) => graph.nodes.some((node) => node.group === ordinal));
  // 허브는 해바라기 씨 배열로 흩어 두고, 항목은 제 허브 곁에서 ID 로 정한 자리에서 출발한다.
  const hubAt = new Map(
    ordinals.map((ordinal, index) => {
      const r = 60 * Math.sqrt(index + 0.5);
      return [ordinal, { x: r * Math.cos(index * GOLDEN_ANGLE), y: r * Math.sin(index * GOLDEN_ANGLE) }];
    })
  );
  const spread = 60 * Math.sqrt(ordinals.length + 1);

  const links: ForceLink[] = [
    ...graph.nodes.flatMap((node): ForceLink[] =>
      node.group !== null && hubAt.has(node.group) ? [{ source: hubId(node.group), target: node.id, kind: "hub" }] : []
    ),
    ...graph.edges.map((edge): ForceLink => ({
      source: edge.source,
      target: edge.target,
      kind: edge.also ? "also" : "relation",
    })),
  ];
  const degree = new Map<string, number>();
  for (const { source, target } of links) {
    degree.set(source, (degree.get(source) ?? 0) + 1);
    degree.set(target, (degree.get(target) ?? 0) + 1);
  }

  const hubs = ordinals.map((ordinal): ForceNode => {
    const id = hubId(ordinal);
    const d = degree.get(id) ?? 0;
    return {
      id,
      hub: true,
      item: null,
      label: `${topicNumber(ordinal)} ${graph.topics.get(ordinal) ?? ""}`.trim(),
      degree: d,
      radius: nodeRadius(d, true),
      ...hubAt.get(ordinal)!,
    };
  });
  const items = graph.nodes.map((node): ForceNode => {
    const [a, b] = hashPair(node.id);
    const home = node.group !== null ? hubAt.get(node.group) : undefined;
    const r = home ? 8 + 22 * b : spread * Math.sqrt(b);
    const d = degree.get(node.id) ?? 0;
    return {
      id: node.id,
      hub: false,
      item: node,
      label: node.content,
      degree: d,
      radius: nodeRadius(d, false),
      x: (home?.x ?? 0) + r * Math.cos(a * 2 * Math.PI),
      y: (home?.y ?? 0) + r * Math.sin(a * 2 * Math.PI),
    };
  });
  return { nodes: [...hubs, ...items], links };
}

export function neighborsOf(links: readonly ForceLink[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const { source, target } of links) {
    map.set(source, (map.get(source) ?? new Set()).add(target));
    map.set(target, (map.get(target) ?? new Set()).add(source));
  }
  return map;
}
