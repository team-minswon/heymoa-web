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
