/**
 * 노트 소켓(STOMP)이 열린 노트. 그 노트의 회의 상태는 소켓이 이미 무효화하므로 이벤트 스트림의 `meeting` 힌트를 건너뛴다
 * (PRO-67 I02). 노트 실시간 provider 가 연결을 여는 동안 등록한다 — 같은 노트를 두 번 열 수 있어 개수로 센다.
 */
const open = new Map<string, number>();

export function noteSocketOpened(noteId: string) {
  open.set(noteId, (open.get(noteId) ?? 0) + 1);
  return () => {
    const count = (open.get(noteId) ?? 1) - 1;
    if (count <= 0) open.delete(noteId);
    else open.set(noteId, count);
  };
}

export function isNoteSocketOpen(noteId: string) {
  return open.has(noteId);
}
