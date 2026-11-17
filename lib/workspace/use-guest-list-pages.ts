import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { WorkspaceGuestListResponseDataGuestsItem } from "@/lib/api/generated/models";
import {
  getGetWorkspaceGuestsQueryKey,
  getWorkspaceGuests,
  type getWorkspaceGuestsResponse,
} from "@/lib/api/generated/workspaces/workspaces";

export const GUEST_LIST_PAGE_SIZE = 30;

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
    queryFn: async ({
      signal,
    }): Promise<getWorkspaceGuestsResponse & { partial?: boolean }> => {
      const merged: WorkspaceGuestListResponseDataGuestsItem[] = [];
      let partial = false;
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
          if (page > 0 && !signal.aborted) {
            partial = true;
            break;
          }
          throw error;
        }
        if (response.status !== 200 || !response.data.success) {
          if (page > 0) {
            partial = true;
            break;
          }
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
        partial,
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
