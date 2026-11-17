import type { QueryClient } from "@tanstack/react-query";

import { getGetNoteQueryKey } from "@/lib/api/generated/notes/notes";
import { getGetNoteTranscriptQueryKey } from "@/lib/api/generated/transcription/transcription";
import { isNoteListQueryKey } from "@/lib/notes/query-keys";

export function invalidateNoteLists(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) => isNoteListQueryKey(queryKey),
  });
}

export function invalidateNoteLifecycle(
  queryClient: QueryClient,
  noteId: string
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) }),
    invalidateNoteLists(queryClient),
  ]);
}

export function invalidateNoteTranscript(
  queryClient: QueryClient,
  noteId: string
) {
  return queryClient.invalidateQueries({
    queryKey: getGetNoteTranscriptQueryKey(noteId),
  });
}
