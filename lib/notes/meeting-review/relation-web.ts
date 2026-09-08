import type { ReviewItem, ReviewRelation } from "@/lib/notes/meeting-review/contract";
import { directionFrom } from "@/lib/notes/meeting-review/select";

/**
 * 선택한 항목의 **직접 연결(1-hop)** 배치. 그래프 라이브러리 없이 좌표만 계산한다.
 *
 * 가운데에 선택 항목, 왼쪽에 들어오는 관계의 끝점, 오른쪽에 나가는 관계의 끝점을 세로로
 * 고르게 놓는다. 간선은 `label` · 방향 · 근거 개수만 싣는다 — `kind` 로 분기하지 않는다.
 * 그리는 것은 컴포넌트 몫이고 여기는 React 를 모른다.
 */

export type WebNode = {
  id: string;
  side: "center" | "left" | "right";
  x: number;
  y: number;
  /** 검토 항목이면 항목 내용, 승인 항목(APPROVED 끝점)이면 계약이 준 내용 또는 ID. */
  label: string;
  kind: string | null;
  /** 검토본 안의 항목이 아니면(승인 항목·제외된 항목) 흐리게 그린다. */
  reachable: boolean;
};

export type WebEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  citationCount: number;
  stale: boolean;
  judgement: ReviewRelation["judgement"]["status"];
  /**
   * 같은 두 끝점 사이의 간선 순서. 0 이 가운데, ±1·±2… 가 위아래 — 양방향이나 이름이 다른
   * 관계가 둘 이상이면 선과 이름이 겹치지 않게 그리는 쪽이 이만큼 비켜 놓는다.
   */
  lane: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type RelationWeb = {
  width: number;
  height: number;
  nodes: WebNode[];
  edges: WebEdge[];
};

export type RelationWebOptions = {
  width?: number;
  rowHeight?: number;
  minHeight?: number;
};

const DEFAULTS = { width: 640, rowHeight: 56, minHeight: 160 };

function endpointId(ref: ReviewRelation["from"]) {
  return `${ref.type}:${ref.itemId}`;
}

function endpointLabel(
  ref: ReviewRelation["from"],
  relation: ReviewRelation,
  itemsById: ReadonlyMap<string, ReviewItem>
) {
  if (ref.type === "REVIEW") {
    const item = itemsById.get(ref.itemId);
    if (item) return { label: item.content, kind: item.kind, reachable: item.included };
  }
  if (ref.type === "APPROVED" && relation.previousApproved?.itemId === ref.itemId) {
    return {
      label: relation.previousApproved.content,
      kind: relation.previousApproved.kind,
      reachable: false,
    };
  }
  return { label: ref.itemId, kind: null, reachable: false };
}

export function layoutRelationWeb(
  centerId: string,
  itemsById: ReadonlyMap<string, ReviewItem>,
  relations: readonly ReviewRelation[],
  options: RelationWebOptions = {}
): RelationWeb | null {
  const center = itemsById.get(centerId);
  if (!center) return null;

  const { width, rowHeight, minHeight } = { ...DEFAULTS, ...options };
  const incoming: ReviewRelation[] = [];
  const outgoing: ReviewRelation[] = [];
  for (const relation of relations) {
    if (relation.judgement.status === "REJECTED") continue;
    const direction = directionFrom(centerId, relation);
    if (direction === "incoming") incoming.push(relation);
    else if (direction === "outgoing") outgoing.push(relation);
  }

  const rows = Math.max(incoming.length, outgoing.length, 1);
  const height = Math.max(minHeight, rows * rowHeight);
  const centerX = width / 2;
  const leftX = width * 0.15;
  const rightX = width * 0.85;
  const yOf = (index: number, count: number) =>
    count <= 1 ? height / 2 : rowHeight / 2 + (index * (height - rowHeight)) / (count - 1);

  const nodes: WebNode[] = [
    {
      id: `REVIEW:${centerId}`,
      side: "center",
      x: centerX,
      y: height / 2,
      label: center.content,
      kind: center.kind,
      reachable: center.included,
    },
  ];
  const edges: WebEdge[] = [];
  const seen = new Set(nodes.map((node) => node.id));

  const place = (list: ReviewRelation[], side: "left" | "right", x: number) => {
    list.forEach((relation, index) => {
      const ref = side === "left" ? relation.from : relation.to;
      const id = endpointId(ref);
      const y = yOf(index, list.length);
      if (!seen.has(id)) {
        seen.add(id);
        nodes.push({ id, side, x, y, ...endpointLabel(ref, relation, itemsById) });
      }
      const node = nodes.find((candidate) => candidate.id === id)!;
      edges.push({
        id: relation.relationId,
        from: side === "left" ? id : `REVIEW:${centerId}`,
        to: side === "left" ? `REVIEW:${centerId}` : id,
        label: relation.judgement.label ?? relation.label,
        citationCount: relation.citations.length,
        stale: relation.stale,
        judgement: relation.judgement.status,
        lane: 0,
        x1: side === "left" ? node.x : centerX,
        y1: side === "left" ? node.y : height / 2,
        x2: side === "left" ? centerX : node.x,
        y2: side === "left" ? height / 2 : node.y,
      });
    });
  };

  place(incoming, "left", leftX);
  place(outgoing, "right", rightX);

  // 같은 끝점 쌍(방향 무관)끼리 묶어 가운데부터 위아래로 벌린다.
  const groups = new Map<string, WebEdge[]>();
  for (const edge of edges) {
    const key = [edge.from, edge.to].sort().join("|");
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  }
  for (const group of groups.values()) {
    group.forEach((edge, index) => {
      edge.lane = index - (group.length - 1) / 2;
    });
  }

  return { width, height, nodes, edges };
}
