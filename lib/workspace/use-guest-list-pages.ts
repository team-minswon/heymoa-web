import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { WorkspaceGuestListResponseDataGuestsItem } from "@/lib/api/generated/models";
import {
  getGetWorkspaceGuestsQueryKey,
  getWorkspaceGuests,
  type getWorkspaceGuestsResponse,
} from "@/lib/api/generated/workspaces/workspaces";

export const GUEST_LIST_PAGE_SIZE = 30;

/**
 * 임시 참여자 **관리 화면**의 목록. 쪽 수만큼 이어 붙인 한 응답을 돌려준다 (APP-1032).
 *
 * 쪽 수가 키에 들어가고 응답은 한 덩어리라, 목록 캐시를 만지는 쪽(삭제·연동의 무효화)은 그대로 읽는다. 키의 첫 칸은
 * 생성 훅과 같은 경로라 `invalidateQueries({ queryKey: getGetWorkspaceGuestsQueryKey(id) })` 가 이 목록도 집는다.
 *
 * **선택 상자와 화자 드롭다운은 이걸 쓰지 않는다.** 그쪽은 후보를 전건에서 세우므로 `limit` 없이 전건을 부르는
 * 생성 훅 그대로다 — 쪽으로 자르면 후보가 조용히 빠진다.
 */
export function useGuestListPages({
  workspaceId,
  pages,
}: {
  workspaceId: string;
  pages: number;
}) {
  return useQuery({
    queryKey: [
      ...getGetWorkspaceGuestsQueryKey(workspaceId),
      { limit: GUEST_LIST_PAGE_SIZE, pages },
    ],
    queryFn: async ({ signal }): Promise<getWorkspaceGuestsResponse> => {
      const merged: WorkspaceGuestListResponseDataGuestsItem[] = [];
      let last: getWorkspaceGuestsResponse | undefined;
      for (let page = 0; page < pages; page += 1) {
        const params = {
          limit: String(GUEST_LIST_PAGE_SIZE),
          ...(last?.status === 200 && last.data.data?.nextGuestId
            ? {
                afterDisplayName: last.data.data.nextDisplayName ?? undefined,
                afterGuestId: last.data.data.nextGuestId,
              }
            : {}),
        };
        let response: getWorkspaceGuestsResponse;
        try {
          response = await getWorkspaceGuests(workspaceId, params, { signal });
        } catch (error) {
          // 첫 쪽이 아니면 이미 읽은 것까지만 돌려준다 — 던지면 보던 목록이 통째로 사라진다.
          if (page > 0 && !signal.aborted) break;
          throw error;
        }
        if (response.status !== 200 || !response.data.success) {
          if (page > 0) break;
          return response;
        }
        for (const guest of response.data.data.guests) {
          if (!merged.some((seen) => seen.guestId === guest.guestId)) {
            merged.push(guest);
          }
        }
        last = response;
        if (!response.data.data.hasMore) break;
      }
      const tail = last?.status === 200 ? last.data.data : undefined;
      return {
        status: 200,
        headers: last?.headers ?? new Headers(),
        data: {
          success: true,
          error: null,
          data: {
            guests: merged,
            totalCount: tail?.totalCount ?? merged.length,
            hasMore: tail?.hasMore ?? false,
            nextDisplayName: tail?.nextDisplayName ?? null,
            nextGuestId: tail?.nextGuestId ?? null,
          },
        },
      };
    },
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
  });
}
