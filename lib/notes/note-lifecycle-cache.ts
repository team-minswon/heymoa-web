import type { QueryClient } from "@tanstack/react-query";

import {
  getGetNoteQueryKey,
  type getNoteResponse,
  type getNotesResponse,
} from "@/lib/api/generated/notes/notes";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import type { NoteTopicEvent } from "@/lib/notes/note-topic-protocol";
import { isNoteListQueryKey } from "@/lib/notes/query-keys";

type LifecycleEvent = Extract<
  NoteTopicEvent,
  {
    type:
      | "meeting.started"
      | "meeting.ended"
      | "recording.started"
      | "recording.stopped";
  }
>;

export function applyNoteLifecycleEvent(
  queryClient: QueryClient,
  noteId: string,
  event: LifecycleEvent
): boolean {
  const {
    meetingStatus,
    meetingStartedAt,
    recordedDurationMs,
    activeSessionStartedAt,
  } = event;
  if (
    meetingStatus === undefined ||
    meetingStartedAt === undefined ||
    recordedDurationMs === undefined ||
    activeSessionStartedAt === undefined
  ) {
    return false;
  }

  const timing = {
    meetingStatus,
    meetingStartedAt,
    recordedDurationMs,
    activeSessionStartedAt,
  };
  const mergeTiming = <
    T extends { meetingStatus: string; recordedDurationMs: number },
  >(
    note: T
  ) => {
    if (note.meetingStatus === "ENDED" && meetingStatus !== "ENDED")
      return note;
    if (
      meetingStatus !== "ENDED" &&
      recordedDurationMs < note.recordedDurationMs
    )
      return note;
    return { ...note, ...timing };
  };
  queryClient.setQueryData<getNoteResponse>(
    getGetNoteQueryKey(noteId),
    (response) =>
      response?.status === 200 && response.data.success
        ? {
            ...response,
            data: { ...response.data, data: mergeTiming(response.data.data) },
          }
        : response
  );
  queryClient.setQueriesData<getNotesResponse>(
    { predicate: ({ queryKey }) => isNoteListQueryKey(queryKey) },
    (response) => {
      if (response?.status !== 200 || !response.data.success) return response;
      if (!response.data.data.notes.some((note) => note.noteId === noteId))
        return response;
      const notes = response.data.data.notes.map((note) =>
        note.noteId === noteId ? mergeTiming(note) : note
      );
      notes.sort(
        (
          a: NoteListResponseDataNotesItem,
          b: NoteListResponseDataNotesItem
        ) => {
          const aAt = a.meetingStartedAt ?? a.createdAt;
          const bAt = b.meetingStartedAt ?? b.createdAt;
          return (
            bAt.localeCompare(aAt) ||
            (b.noteId < a.noteId ? -1 : b.noteId > a.noteId ? 1 : 0)
          );
        }
      );
      return {
        ...response,
        data: { ...response.data, data: { ...response.data.data, notes } },
      };
    }
  );
  return true;
}
