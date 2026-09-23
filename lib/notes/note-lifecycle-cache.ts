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

/** 구 서버 프레임에는 네 필드가 없다. 부분 프레임은 REST 재조회로 수렴시킨다. */
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
    // 재연결 직후 이전 세션의 프레임이 늦게 올 수 있다. 종료된 회의를 되살리거나
    // 더 오래된 녹음 길이로 되감지 않는다.
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
      // 회의가 처음 시작되면 목록 위치도 바뀐다. 이 이벤트로 갱신한 행에 한해서
      // 서버의 meetingStartedAt ?: createdAt 순서를 캐시 안에서 유지한다.
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
