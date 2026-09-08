import type { EditsState } from "@/lib/notes/meeting-review/edits";

/**
 * 노트별 편집 상태의 보관소. `summary` 탭의 패널은 탭을 옮기면 언마운트되는데, 근거를
 * 확인하러 전사 탭에 다녀오는 것은 검토의 일부라 미저장 편집·충돌 대조가 그 사이 사라지면
 * 안 된다. 그래서 reducer 상태를 컴포넌트 밖에 두고 마운트 때 되찾는다.
 *
 * 문서(탭)와 함께 사라지는 메모리다 — 새로고침 뒤에는 서버 검토본이 정본이다.
 */
const store = new Map<string, EditsState>();

export function loadEdits(noteId: string): EditsState | undefined {
  return store.get(noteId);
}

export function storeEdits(noteId: string, state: EditsState) {
  store.set(noteId, state);
}

export function clearEdits(noteId: string) {
  store.delete(noteId);
}
