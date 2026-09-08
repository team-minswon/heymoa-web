/**
 * 작성 중인 폼 초안(항목 추가 내용·연결 이름 수정)의 노트별 보관소.
 *
 * 폼의 로컬 state 는 side ↔ full 전환(`NoteRouteSurface` 가 Sheet 와 div 를 갈아 끼운다)에
 * 재마운트로 사라진다. 편집 보관소(`edits-store`)는 제출된 편집만 갖고 작성 중인 글자는 모르니
 * 여기 따로 둔다. 제출·취소하면 지운다. 문서와 함께 사라지는 메모리다.
 */
const store = new Map<string, Map<string, string>>();

export function loadDraft(noteId: string, key: string): string | undefined {
  return store.get(noteId)?.get(key);
}

export function storeDraft(noteId: string, key: string, value: string) {
  const drafts = store.get(noteId) ?? new Map<string, string>();
  drafts.set(key, value);
  store.set(noteId, drafts);
}

export function clearDraft(noteId: string, key: string) {
  store.get(noteId)?.delete(key);
}
