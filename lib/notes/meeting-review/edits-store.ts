import { reduceEdits, type EditsAction, type EditsState } from "@/lib/notes/meeting-review/edits";

/**
 * 노트별 편집 상태의 보관소. `summary` 탭의 패널은 탭을 옮기면 언마운트되는데, 근거를
 * 확인하러 전사 탭에 다녀오는 것은 검토의 일부라 미저장 편집·충돌 대조가 그 사이 사라지면
 * 안 된다. 그래서 reducer 상태를 컴포넌트 밖에 두고 마운트 때 되찾는다.
 *
 * 문서(탭)와 함께 사라지는 메모리다 — 새로고침 뒤에는 서버 검토본이 정본이다.
 */
const store = new Map<string, EditsState>();

/**
 * 되찾을 때 `saving` 은 비운다 — 언마운트된 reducer 는 완료를 받지 못하므로 그 표시가 남으면
 * 버튼이 잠긴 채다. 미저장 편집은 그대로라 다시 저장하면 되고, 이미 저장됐으면 재조회가 같은
 * 값을 보여 준다.
 */
export function loadEdits(noteId: string): EditsState | undefined {
  const state = store.get(noteId);
  return state ? { ...state, saving: new Set() } : undefined;
}

export function storeEdits(noteId: string, state: EditsState) {
  store.set(noteId, state);
}

export function clearEdits(noteId: string) {
  store.delete(noteId);
}

/**
 * 저장 흐름이 끝났을 때 보관소에도 같은 사건을 적용한다. 패널이 언마운트된 뒤 도착한
 * 응답은 reducer 의 `dispatch` 로는 닿지 않으므로, 여기서 적용해야 되찾은 상태가 이미
 * 저장된 편집을 다시 보내지 않는다.
 */
export function settleStoredEdits(noteId: string, action: EditsAction) {
  const state = store.get(noteId);
  if (state) store.set(noteId, reduceEdits(state, action));
}
