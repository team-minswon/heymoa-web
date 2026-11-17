import type { MeetingReviewResponseDataItemsItem } from "@/lib/api/generated/models";
import type { MeetingLinkIndex } from "@/lib/notes/review/meeting-links";
import {
  summaryTopics,
  type MeetingReviewSummary,
} from "@/lib/notes/review/summary";
import { topicNumber } from "@/lib/notes/review/topics";

type ReviewItem = MeetingReviewResponseDataItemsItem;

export type GraphRole = "DECISION" | "ACTION" | "OPEN" | "REFERENCE";

export const GRAPH_ROLE_ORDER: readonly GraphRole[] = [
  "DECISION",
  "ACTION",
  "OPEN",
  "REFERENCE",
];

export type GraphNode = {
  id: string;
  group: number | null;
  role: GraphRole;
  kind: ReviewItem["kind"];
  content: string;
  alsoGroups: number[];
};

export type GraphEdge = {
  source: string;
  target: string;
};

export type ReviewGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  agendaEdges: GraphEdge[];
  topics: Map<number, string>;
};

export function buildReviewGraph(
  summary: MeetingReviewSummary,
  items: readonly ReviewItem[],
  agendaLinks?: MeetingLinkIndex["byAgendaId"]
): ReviewGraph {
  const shown = items.filter((item) => item.included);
  const present = new Set(shown.map((item) => item.itemId));
  const groupsOf = new Map<string, number[]>();
  const open = new Set<string>();
  const join = (itemId: string, ordinal: number) => {
    const groups = groupsOf.get(itemId) ?? [];
    if (!groups.includes(ordinal)) groupsOf.set(itemId, [...groups, ordinal]);
  };
  for (const topic of summaryTopics(summary)) {
    for (const member of topic.memberships) {
      if (!member.secondary) join(member.itemId, topic.ordinal);
    }
    for (const itemId of topic.openItemIds) open.add(itemId);
  }
  for (const topic of summaryTopics(summary)) {
    for (const member of topic.memberships) {
      if (member.secondary) join(member.itemId, topic.ordinal);
    }
  }

  const nodes = shown.map(
    (item): GraphNode => ({
      id: item.itemId,
      group: groupsOf.get(item.itemId)?.[0] ?? null,
      role:
        item.kind === "DECISION"
          ? "DECISION"
          : item.kind === "ACTION_ITEM"
            ? "ACTION"
            : (item.kind === "ISSUE" || item.kind === "QUESTION") &&
                open.has(item.itemId)
              ? "OPEN"
              : "REFERENCE",
      kind: item.kind,
      content: item.content,
      alsoGroups: groupsOf.get(item.itemId)?.slice(1) ?? [],
    })
  );

  const edges = new Map<string, GraphEdge>();
  const connect = (source: string, target: string) => {
    if (source === target || !present.has(source) || !present.has(target))
      return;
    const key = [source, target].sort().join("→");
    if (!edges.has(key)) edges.set(key, { source, target });
  };
  for (const topic of summaryTopics(summary)) {
    for (const relation of topic.relations)
      connect(relation.sourceItemId, relation.targetItemId);
  }

  const ordinalByAgenda = new Map(
    summaryTopics(summary).flatMap((topic) =>
      topic.agendaId ? [[topic.agendaId, topic.ordinal] as const] : []
    )
  );
  const agendaEdges = new Map<string, GraphEdge>();
  for (const [agendaId, previous] of agendaLinks ?? []) {
    const current = ordinalByAgenda.get(agendaId);
    if (current === undefined) continue;
    for (const target of previous) {
      if (target.noteId !== summary.noteId) continue;
      const earlier = ordinalByAgenda.get(target.agendaId);
      if (earlier === undefined || earlier === current) continue;
      const source = hubId(earlier),
        destination = hubId(current);
      agendaEdges.set(`${source}→${destination}`, {
        source,
        target: destination,
      });
    }
  }

  return {
    nodes,
    edges: [...edges.values()],
    agendaEdges: [...agendaEdges.values()],
    topics: new Map(
      summaryTopics(summary).map((topic) => [topic.ordinal, topic.title])
    ),
  };
}

export type ForceNode = {
  id: string;
  hub: boolean;
  item: GraphNode | null;
  label: string;
  degree: number;
  memberCount?: number;
  radius: number;
  x: number;
  y: number;
};

export type ForceLinkKind = "hub" | "relation" | "also" | "agenda";

export type ForceLink = { source: string; target: string; kind: ForceLinkKind };

export const hubId = (ordinal: number) => `topic:${ordinal}`;

export function nodeRadius(degree: number, hub: boolean): number {
  return hub ? 8 + 0.8 * Math.sqrt(degree) : 5 + 0.7 * Math.sqrt(degree);
}

const SCREEN_RADIUS = { item: [4, 14], hub: [6, 22] } as const;

export function screenRadius(
  radius: number,
  hub: boolean,
  scale: number
): number {
  const [min, max] = SCREEN_RADIUS[hub ? "hub" : "item"];
  return Math.min(Math.max(radius, min / scale), max / scale);
}

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

export function toForceGraph(graph: ReviewGraph): {
  nodes: ForceNode[];
  links: ForceLink[];
} {
  const linkedAgendas = new Set(
    graph.agendaEdges.flatMap((edge) => [edge.source, edge.target])
  );
  const ordinals = [...graph.topics.keys()].filter(
    (ordinal) =>
      linkedAgendas.has(hubId(ordinal)) ||
      graph.nodes.some(
        (node) => node.group === ordinal || node.alsoGroups.includes(ordinal)
      )
  );
  const hubAt = new Map(
    ordinals.map((ordinal, index) => {
      const r = 60 * Math.sqrt(index + 0.5);
      return [
        ordinal,
        {
          x: r * Math.cos(index * GOLDEN_ANGLE),
          y: r * Math.sin(index * GOLDEN_ANGLE),
        },
      ];
    })
  );
  const spread = 60 * Math.sqrt(ordinals.length + 1);

  const links: ForceLink[] = [
    ...graph.nodes.flatMap((node): ForceLink[] =>
      node.group !== null && hubAt.has(node.group)
        ? [{ source: hubId(node.group), target: node.id, kind: "hub" }]
        : []
    ),
    ...graph.edges.map(
      (edge): ForceLink => ({
        source: edge.source,
        target: edge.target,
        kind: "relation",
      })
    ),
    ...graph.agendaEdges.map(
      (edge): ForceLink => ({ ...edge, kind: "agenda" })
    ),
    ...graph.nodes.flatMap((node): ForceLink[] =>
      node.alsoGroups.flatMap((group): ForceLink[] =>
        hubAt.has(group)
          ? [{ source: hubId(group), target: node.id, kind: "also" }]
          : []
      )
    ),
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
      label:
        `${topicNumber(ordinal)} ${graph.topics.get(ordinal) ?? ""}`.trim(),
      degree: d,
      memberCount: graph.nodes.filter(
        (node) => node.group === ordinal || node.alsoGroups.includes(ordinal)
      ).length,
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

export function neighborsOf(
  links: readonly ForceLink[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const { source, target } of links) {
    map.set(source, (map.get(source) ?? new Set()).add(target));
    map.set(target, (map.get(target) ?? new Set()).add(source));
  }
  return map;
}
