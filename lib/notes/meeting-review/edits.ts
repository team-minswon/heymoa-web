import type { ReviewItem, ReviewRelation } from "@/lib/notes/meeting-review/contract";

/**
 * 미저장 편집과 충돌 대조의 순수 reducer.
 *
 * 세 규칙이 전부다.
 * 1. 편집은 완료 단위로 저장한다. 저장 중에는 같은 키를 다시 보내지 않는다.
 * 2. 응답의 검토본 버전이 지금 아는 것보다 **클 때만** 반영한다. 늦은 응답이 최신을 덮지
 *    않게 하기 위해서다.
 * 3. 충돌은 로컬 편집을 **보존**하고 서버 값을 옆에 둔다. 사용자가 고르기 전에는 아무것도
 *    덮거나 지우지 않는다.
 */

export type ItemEdit = {
  content?: string;
  included?: boolean;
  /**
   * 편집을 시작한 시점의 항목 revision. CAS 는 이 값을 보낸다 — 편집 중 다른 창의 저장이
   * 폴링으로 들어와도 최신 revision 으로 그 변경을 덮지 않고 충돌로 잡는다.
   */
  baseRevision?: number;
};

export type RelationEdit = {
  judgement: "ACCEPTED" | "MODIFIED" | "REJECTED";
  label?: string;
  note?: string | null;
};

export type EditKey = `item:${string}` | `relation:${string}`;

export type Conflict =
  | { kind: "item"; local: ItemEdit; server: ReviewItem; currentReviewVersion: number | null }
  | {
      kind: "relation";
      local: RelationEdit;
      server: ReviewRelation;
      currentReviewVersion: number | null;
    };

export type EditsState = {
  /** 아는 검토본 버전. 저장의 CAS 에 실리고 응답으로 전진한다. */
  reviewVersion: number;
  pendingItems: Record<string, ItemEdit>;
  pendingRelations: Record<string, RelationEdit>;
  saving: ReadonlySet<EditKey>;
  conflicts: Record<EditKey, Conflict>;
  /** 저장 실패(충돌 아님). 키별 서버 문구. */
  failures: Record<EditKey, string>;
};

export function initialEdits(reviewVersion: number): EditsState {
  return {
    reviewVersion,
    pendingItems: {},
    pendingRelations: {},
    saving: new Set(),
    conflicts: {},
    failures: {},
  };
}

export type EditsAction =
  | { type: "sync-version"; reviewVersion: number }
  | { type: "edit-item"; itemId: string; edit: ItemEdit }
  | { type: "edit-relation"; relationId: string; edit: RelationEdit }
  | { type: "saving"; key: EditKey }
  | { type: "saved"; key: EditKey; reviewVersion: number }
  | { type: "conflict"; key: EditKey; conflict: Conflict }
  | { type: "failed"; key: EditKey; message: string }
  | { type: "keep-local"; key: EditKey }
  | { type: "take-server"; key: EditKey };

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function withoutKey(set: ReadonlySet<EditKey>, key: EditKey): ReadonlySet<EditKey> {
  if (!set.has(key)) return set;
  const next = new Set(set);
  next.delete(key);
  return next;
}

export function reduceEdits(state: EditsState, action: EditsAction): EditsState {
  switch (action.type) {
    case "sync-version":
      // 재조회가 더 새 버전을 알려 주면 따라간다. 뒤로 가지 않는다.
      return action.reviewVersion > state.reviewVersion
        ? { ...state, reviewVersion: action.reviewVersion }
        : state;

    case "edit-item": {
      const current = state.pendingItems[action.itemId] ?? {};
      return {
        ...state,
        pendingItems: {
          ...state.pendingItems,
          [action.itemId]: { ...current, ...action.edit },
        },
        failures: without(state.failures, `item:${action.itemId}`),
      };
    }

    case "edit-relation":
      return {
        ...state,
        pendingRelations: {
          ...state.pendingRelations,
          [action.relationId]: action.edit,
        },
        failures: without(state.failures, `relation:${action.relationId}`),
      };

    case "saving":
      return { ...state, saving: new Set([...state.saving, action.key]) };

    case "saved": {
      const [kind, id] = splitKey(action.key);
      const next: EditsState = {
        ...state,
        saving: withoutKey(state.saving, action.key),
        conflicts: without(state.conflicts, action.key),
        failures: without(state.failures, action.key),
        pendingItems:
          kind === "item" ? without(state.pendingItems, id) : state.pendingItems,
        pendingRelations:
          kind === "relation"
            ? without(state.pendingRelations, id)
            : state.pendingRelations,
      };
      // 늦은 응답은 버전을 뒤로 돌리지 않는다.
      return action.reviewVersion > state.reviewVersion
        ? { ...next, reviewVersion: action.reviewVersion }
        : next;
    }

    case "conflict":
      return {
        ...state,
        saving: withoutKey(state.saving, action.key),
        conflicts: { ...state.conflicts, [action.key]: action.conflict },
        reviewVersion: Math.max(
          state.reviewVersion,
          action.conflict.currentReviewVersion ?? state.reviewVersion
        ),
      };

    case "failed":
      return {
        ...state,
        saving: withoutKey(state.saving, action.key),
        failures: { ...state.failures, [action.key]: action.message },
      };

    case "keep-local":
      // 로컬 편집을 그대로 두고 충돌 표시만 걷는다. 다음 저장이 새 버전으로 나간다.
      return { ...state, conflicts: without(state.conflicts, action.key) };

    case "take-server": {
      const [kind, id] = splitKey(action.key);
      return {
        ...state,
        conflicts: without(state.conflicts, action.key),
        pendingItems:
          kind === "item" ? without(state.pendingItems, id) : state.pendingItems,
        pendingRelations:
          kind === "relation"
            ? without(state.pendingRelations, id)
            : state.pendingRelations,
      };
    }
  }
}

export function splitKey(key: EditKey): ["item" | "relation", string] {
  const index = key.indexOf(":");
  return [key.slice(0, index) as "item" | "relation", key.slice(index + 1)];
}

/** 승인 전에 저장해야 할 편집이 남아 있는가. 충돌 중인 것도 「미저장」이다. */
export function hasUnsavedEdits(state: EditsState): boolean {
  return (
    Object.keys(state.pendingItems).length > 0 ||
    Object.keys(state.pendingRelations).length > 0 ||
    Object.keys(state.conflicts).length > 0
  );
}

/** 화면에 그릴 값. 미저장 편집이 있으면 그것을, 없으면 서버 값을 준다. */
export function effectiveItem(state: EditsState, item: ReviewItem): ReviewItem {
  const edit = state.pendingItems[item.itemId];
  return edit ? { ...item, ...edit } : item;
}
