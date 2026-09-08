import { reduceEdits, type EditsAction, type EditsState } from "@/lib/notes/meeting-review/edits";

/**
 * 노트별 편집 상태의 보관소. `summary` 탭의 패널은 탭을 옮기면 언마운트되는데, 근거를
 * 확인하러 전사 탭에 다녀오는 것은 검토의 일부라 미저장 편집·충돌 대조가 그 사이 사라지면
 * 안 된다. 그래서 reducer 상태를 컴포넌트 밖에 두고 마운트 때 되찾는다.
 *
 * 문서(탭)와 함께 사라지는 메모리다 — 새로고침 뒤에는 서버 검토본이 정본이다.
 */
const store = new Map<string, EditsState>();
const listeners = new Map<string, Set<(state: EditsState) => void>>();

/**
 * `saving` 도 그대로 되찾는다. 언마운트된 화면이 보낸 요청은 같은 문서 안에서 반드시 끝나고,
 * 그 완료는 `settleStoredEdits` 로 여기 닿아 잠금을 푼다. 비우면 응답 전에 돌아온 화면이
 * 같은 편집을 한 번 더 보내 자기 중복 요청의 409 를 보게 된다.
 */
export function loadEdits(noteId: string): EditsState | undefined {
  return store.get(noteId);
}

export function storeEdits(noteId: string, state: EditsState) {
  store.set(noteId, state);
}

export function clearEdits(noteId: string) {
  store.delete(noteId);
}

/**
 * 저장 흐름이 끝났을 때 보관소에도 같은 사건을 적용하고, 지금 마운트된 화면이 있으면 알린다.
 * 패널이 언마운트된 뒤 도착한 응답은 옛 reducer 의 `dispatch` 로는 닿지 않고, 그새 다시
 * 마운트된 새 reducer 도 모른다 — 구독자에게 바뀐 상태를 넘겨 둘 다 맞춘다.
 */
export function settleStoredEdits(noteId: string, action: EditsAction) {
  const state = store.get(noteId);
  if (!state) return;
  const next = reduceEdits(state, action);
  store.set(noteId, next);
  listeners.get(noteId)?.forEach((listener) => listener(next));
}

export function subscribeEdits(noteId: string, listener: (state: EditsState) => void) {
  const set = listeners.get(noteId) ?? new Set();
  set.add(listener);
  listeners.set(noteId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(noteId);
  };
}
