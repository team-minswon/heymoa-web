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

export const NOTE_LIST_PAGE_SIZE = 30;

export type NoteListScope =
  | { kind: "project"; projectId: string }
  | { kind: "workspace"; workspaceId: string };

/**
 * 노트 목록을 **쪽 수만큼 이어 붙여 한 응답으로** 돌려준다 (APP-1019).
 *
 * `useInfiniteQuery` 로 가지 않은 이유: 목록 캐시를 만지는 곳이 여럿이다(회의 시작·종료가 행을
 * 고치고 정렬하고, 삭제가 행을 빼고, 새 회의가 맨 앞에 끼운다). 모두 `{ status, data: { data:
 * { notes } } }` 한 모양을 전제하므로, 쪽을 `pages` 배열로 나누면 그 갱신기를 전부 고쳐야 한다.
 * 여기서는 **쪽 수가 키에 들어가고 응답은 이어 붙인 한 덩어리**라 그대로 읽힌다.
 *
 * 키의 첫 칸은 생성 훅과 같은 경로라 `isNoteListQueryKey` 가 이 목록도 집는다.
 * 폴링과 무효화는 읽어 둔 쪽을 처음부터 다시 읽는다 — 쪽마다 요청 하나이고 쪽은 사용자가
 * 「더 보기」를 누른 만큼만 쌓인다.
 */
export function useNoteListPages({
  scope,
  pages,
  enabled,
  refetchInterval,
}: {
  scope: NoteListScope;
  /** 이어 붙일 쪽 수. 1 이면 첫 쪽만. */
  pages: number;
  enabled: boolean;
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
          // **첫 쪽이 아니면 이미 읽은 것까지만 돌려준다.** 던지면 키가 에러가 되어 보던 목록이
          // 통째로 사라진다. 남은 커서가 그대로 `hasMore` 라 「더 보기」가 다시 읽는다.
          if (page > 0 && !signal.aborted) break;
          throw error;
        }
        // 한 쪽이라도 실패하면 그 응답을 그대로 돌려준다 — 부르는 쪽이 200 만 목록으로 읽는다.
        // 첫 쪽이 아니면 위와 같이 읽은 것까지만 쓴다.
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
    // 쪽 수가 바뀌면 키가 바뀐다. 이전 목록을 붙들어 두지 않으면 「더 보기」마다 목록이 비었다 찬다.
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      refetchInterval(
        query.state.data?.status === 200 && query.state.data.data.success
          ? query.state.data.data.data.notes
          : undefined
      ),
  });
}
