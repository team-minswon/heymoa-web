import type {
  ApprovalGate,
  MeetingReview,
  RegionStatus,
  ReviewItem,
  ReviewRelation,
} from "@/lib/notes/meeting-review/contract";

/**
 * 계약 응답 → 화면용 타입. **화면 컴포넌트는 이 파일의 타입만 읽는다.** 계약이 제안과
 * 달라지면 `contract.ts` 와 여기까지만 바뀌고 컴포넌트는 그대로여야 한다.
 *
 * 순수 함수다. React 도 Query 도 모른다.
 */

export type ScreenRegion = {
  regionId: string;
  title: string;
  kind: string;
  items: ReviewItem[];
};

export type ReviewScreen = {
  noteId: string;
  reviewVersion: number;
  projectApprovalVersion: number | null;
  readiness: MeetingReview["readiness"];
  regions: ScreenRegion[];
  /** 영역에 안 들어간 항목(사람이 추가하고 영역을 안 정한 것 등). */
  unplacedItems: ReviewItem[];
  itemsById: ReadonlyMap<string, ReviewItem>;
  evaluation: MeetingReview["evaluation"];
  relations: ReviewRelation[];
  /** 항목 ID → 그 항목이 끝점인 관계. 1-hop 뷰와 카드 배지가 읽는다. */
  relationsByItem: ReadonlyMap<string, ReviewRelation[]>;
  approval: ApprovalGate;
  approved: MeetingReview["approved"];
  /** 미검토 항목·관계의 집합. 게이트 목록과 카드 강조가 같은 판정을 쓴다. */
  unreviewedItemIds: ReadonlySet<string>;
  unreviewedRelationIds: ReadonlySet<string>;
  counts: {
    items: number;
    excluded: number;
    unreviewedItems: number;
    unreviewedRelations: number;
    staleRelations: number;
  };
};

export function toReviewScreen(review: MeetingReview): ReviewScreen {
  const itemsById = new Map(review.items.map((item) => [item.itemId, item]));
  const placed = new Set<string>();

  const regions = [...review.regions]
    .sort((a, b) => a.order - b.order)
    .map((region) => {
      const items = region.itemIds.flatMap((itemId) => {
        const item = itemsById.get(itemId);
        if (!item) return [];
        placed.add(itemId);
        return [item];
      });
      return {
        regionId: region.regionId,
        title: region.title,
        kind: region.kind,
        items,
      };
    });

  const unplacedItems = review.items.filter((item) => !placed.has(item.itemId));

  const relationsByItem = new Map<string, ReviewRelation[]>();
  for (const relation of review.relations) {
    for (const ref of [relation.from, relation.to]) {
      if (ref.type !== "REVIEW") continue;
      const list = relationsByItem.get(ref.itemId) ?? [];
      list.push(relation);
      relationsByItem.set(ref.itemId, list);
    }
  }

  const unreviewedItemIds = new Set(review.approval.unreviewedItemIds);
  const unreviewedRelationIds = new Set(review.approval.unreviewedRelationIds);

  return {
    noteId: review.noteId,
    reviewVersion: review.reviewVersion,
    projectApprovalVersion: review.projectApprovalVersion,
    readiness: review.readiness,
    regions,
    unplacedItems,
    itemsById,
    evaluation: review.evaluation,
    relations: review.relations,
    relationsByItem,
    approval: review.approval,
    approved: review.approved ?? null,
    unreviewedItemIds,
    unreviewedRelationIds,
    counts: {
      items: review.items.length,
      excluded: review.items.filter((item) => !item.included).length,
      unreviewedItems: unreviewedItemIds.size,
      unreviewedRelations: unreviewedRelationIds.size,
      staleRelations: review.relations.filter((relation) => relation.stale)
        .length,
    },
  };
}

/** 영역 상태를 화면의 네 갈래로 접는다. 「기다림」은 spinner, 「지속」은 Alert 다. */
export type RegionPresentation =
  | { kind: "waiting"; reason: "not-ready" | "generating" }
  | { kind: "empty" }
  | { kind: "failed" }
  | { kind: "ready"; stale: boolean };

export function presentRegion(status: RegionStatus): RegionPresentation {
  switch (status) {
    case "NOT_READY":
      return { kind: "waiting", reason: "not-ready" };
    case "GENERATING":
      return { kind: "waiting", reason: "generating" };
    case "EMPTY":
      return { kind: "empty" };
    case "FAILED":
      return { kind: "failed" };
    case "STALE":
      return { kind: "ready", stale: true };
    case "READY":
      return { kind: "ready", stale: false };
  }
}

/**
 * 준비가 끝나기 전에만 폴링한다. 계약에 준비 완료 신호가 없어 저주기 재조회로 받는다.
 * 어느 영역이든 기다리는 중이면 계속 돈다.
 */
export function needsPolling(readiness: MeetingReview["readiness"]): boolean {
  return Object.values(readiness).some(
    (status) => status === "NOT_READY" || status === "GENERATING"
  );
}

/** 관계 하나를 항목 시점에서 본 방향. 1-hop 뷰의 좌우 배치가 쓴다. */
export function directionFrom(
  itemId: string,
  relation: ReviewRelation
): "outgoing" | "incoming" | "none" {
  if (relation.from.type === "REVIEW" && relation.from.itemId === itemId) {
    return "outgoing";
  }
  if (relation.to.type === "REVIEW" && relation.to.itemId === itemId) {
    return "incoming";
  }
  return "none";
}
