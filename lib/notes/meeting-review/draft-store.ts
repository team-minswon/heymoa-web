/**
 * 작성 중인 폼 초안(항목 추가 내용·유형, 연결 이름 수정과 그 기준 revision)의 노트별 보관소.
 *
 * 폼의 로컬 state 는 side ↔ full 전환(`NoteRouteSurface` 가 Sheet 와 div 를 갈아 끼운다)에
 * 재마운트로 사라진다. 편집 보관소(`edits-store`)는 제출된 편집만 갖고 작성 중인 글자는 모르니
 * 여기 따로 둔다. 제출·취소하면 지운다. 문서와 함께 사라지는 메모리다.
 */
export type AddItemResult = { ok: true } | { ok: false; message: string };
export type AddItemDraft = {
  kind: string;
  content: string;
  /** 보낸 요청. 폼이 재마운트돼도 이 약속을 이어 받아 같은 내용을 두 번 보내지 않는다. */
  pending?: Promise<AddItemResult>;
  /** 마지막 요청의 실패 사유. 성공은 초안 자체를 지우므로 여기 남지 않는다. */
  failure?: string;
};
export type ModifyRelationDraft = { label: string; baseRevision: number };

const store = new Map<string, Map<string, unknown>>();

export function loadDraft<T>(noteId: string, key: string): T | undefined {
  return store.get(noteId)?.get(key) as T | undefined;
}

export function storeDraft<T>(noteId: string, key: string, value: T) {
  const drafts = store.get(noteId) ?? new Map<string, unknown>();
  drafts.set(key, value);
  store.set(noteId, drafts);
}

export function clearDraft(noteId: string, key: string) {
  store.get(noteId)?.delete(key);
}
