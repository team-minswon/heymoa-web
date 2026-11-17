import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getGetNotesQueryKey,
  getGetWorkspaceNotesQueryKey,
  getNotes,
  getWorkspaceNotes,
  type getNotesResponse,
} from "@/lib/api/generated/notes/notes";
import type {
  NoteListResponseData,
  NoteListResponseDataNotesItem,
} from "@/lib/api/generated/models";

const NOTE_LIST_PAGE_SIZE = 30;

type NoteListScope =
  | { kind: "project"; projectId: string }
  | { kind: "workspace"; workspaceId: string };

export function useNoteListPages({
  scope,
  pages,
  enabled,
  refetchInterval,
  refetchIntervalInBackground,
}: {
  scope: NoteListScope;
  pages: number;
  enabled: boolean;
  refetchIntervalInBackground?: boolean;
  refetchInterval: (
    notes: NoteListResponseDataNotesItem[] | undefined
  ) => number;
}) {
  const baseKey =
    scope.kind === "project"
      ? getGetNotesQueryKey(scope.projectId)
      : getGetWorkspaceNotesQueryKey(scope.workspaceId);

  return useQuery({
    queryKey: [...baseKey, { limit: NOTE_LIST_PAGE_SIZE, pages }],
    queryFn: async ({ signal }): Promise<getNotesResponse> => {
      const merged: NoteListResponseDataNotesItem[] = [];
      let last: getNotesResponse | undefined;
      for (let page = 0; page < pages; page += 1) {
        const params = {
          limit: String(NOTE_LIST_PAGE_SIZE),
          ...(last?.status === 200 && last.data.data.nextSortedAt
            ? {
                afterSortedAt: last.data.data.nextSortedAt,
                afterNoteId: last.data.data.nextNoteId ?? undefined,
              }
            : {}),
        };
        let response: getNotesResponse;
        try {
          response =
            scope.kind === "project"
              ? await getNotes(scope.projectId, params, { signal })
              : await getWorkspaceNotes(scope.workspaceId, params, { signal });
        } catch (error) {
          if (page > 0 && !signal.aborted) break;
          throw error;
        }
        if (response.status !== 200 || !response.data.success) {
          if (page > 0) break;
          return response;
        }
        for (const note of response.data.data.notes) {
          if (!merged.some((seen) => seen.noteId === note.noteId)) {
            merged.push(note);
          }
        }
        last = response;
        if (!response.data.data.hasMore) break;
      }
      const tail = last?.status === 200 ? last.data.data : undefined;
      const data: NoteListResponseData = {
        notes: merged,
        hasMore: tail?.hasMore ?? false,
        nextSortedAt: tail?.nextSortedAt ?? null,
        nextNoteId: tail?.nextNoteId ?? null,
      };
      return {
        status: 200,
        headers: last?.headers ?? new Headers(),
        data: { success: true, error: null, data },
      };
    },
    enabled,
    refetchIntervalInBackground,
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      refetchInterval(
        query.state.data?.status === 200 && query.state.data.data.success
          ? query.state.data.data.data.notes
          : undefined
      ),
  });
}
