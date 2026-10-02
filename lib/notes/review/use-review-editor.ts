"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { CONFLICT_MESSAGE, errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { okData } from "@/lib/api/ok-data";
import {
  getGetMeetingReviewQueryKey,
  getGetMeetingReviewSummaryQueryKey,
  useCreateMeetingReviewItem,
  useUpdateMeetingReviewItem,
  type getMeetingReviewResponse,
} from "@/lib/api/generated/meeting-review/meeting-review";
import type {
  AddMeetingReviewItemRequest,
  MeetingReviewResponse,
  UpdateMeetingReviewItemRequest,
} from "@/lib/api/generated/models";
import { toast } from "@/lib/ui/toast";

type ItemPatch = Omit<UpdateMeetingReviewItemRequest, "expectedReviewVersion" | "expectedItemRevision">;
type NewItem = Omit<AddMeetingReviewItemRequest, "expectedReviewVersion">;

const CONFLICT = "MEETING_REVIEW_CONFLICT";
const NEW_ITEM = "new";

/**
 * 검토본을 고치는 길 하나. 모든 저장이 여기를 지난다.
 *
 * - **읽은 판을 싣는다.** 캐시의 검토본 판과 항목 판으로 보내고, 그사이 누가 고쳤으면 서버가 거절한다.
 * - **한 번에 하나.** 판을 올리는 저장 둘이 겹치면 뒤의 것이 옛 판으로 거절된다. 누르는 순간 잠근다.
 * - **저장 중에는 검토본 재조회를 멈춘다.** 늦게 온 옛 응답이 방금 저장한 값을 덮지 않게 한다.
 * - **거절되면 다시 읽을 때까지 그 줄을 잠근다.** 옛 판을 든 채 또 누르면 같은 거절이 반복된다.
 */
export function useReviewEditor(noteId: string) {
  const queryClient = useQueryClient();
  const queryKey = getGetMeetingReviewQueryKey(noteId);
  const meta = { suppressErrorToast: true };
  const update = useUpdateMeetingReviewItem({ mutation: { meta } });
  const create = useCreateMeetingReviewItem({ mutation: { meta } });
  const lock = useRef(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [conflictItemId, setConflictItemId] = useState<string | null>(null);

  const cached = () => okData(queryClient.getQueryData<getMeetingReviewResponse>(queryKey));

  const store = (review: MeetingReviewResponse) =>
    queryClient.setQueryData<getMeetingReviewResponse>(queryKey, (previous) =>
      previous ? { ...previous, status: 200, data: review } : previous
    );

  async function run(
    target: string,
    save: () => Promise<{ status: number; data: unknown }>
  ) {
    if (lock.current) return false;
    lock.current = true;
    setBusyItemId(target);
    await queryClient.cancelQueries({ queryKey });
    try {
      const response = await save();
      if (response.status === 200 || response.status === 201) {
        store(response.data as MeetingReviewResponse);
      }
      setConflictItemId(null);
      return true;
    } catch (error) {
      if (errorCodeOf(error) === CONFLICT) {
        // 새 항목에는 안내를 그릴 줄이 없다. 쓴 내용은 폼에 남으니 토스트로 알린다.
        if (target === NEW_ITEM) toast.error(CONFLICT_MESSAGE);
        else setConflictItemId(target);
        await queryClient.refetchQueries({ queryKey });
        // 그 사이 다른 사람이 주제 안에 항목을 더했으면 요약 members 도 달라졌다. 기다리지 않고 같이 읽는다.
        void queryClient.refetchQueries({ queryKey: getGetMeetingReviewSummaryQueryKey(noteId) });
      } else {
        toast.error(errorMessageOf(error, "저장하지 못했습니다."));
      }
      return false;
    } finally {
      lock.current = false;
      setBusyItemId(null);
    }
  }

  return {
    busyItemId,
    adding,
    conflictItemId,
    dismissConflict: () => setConflictItemId(null),

    updateItem(itemId: string, patch: ItemPatch) {
      const review = cached();
      const item = review?.items.find((row) => row.itemId === itemId);
      if (!review || !item) return Promise.resolve(false);
      return run(itemId, () =>
        update.mutateAsync({
          noteId,
          itemId,
          data: {
            expectedReviewVersion: review.reviewVersion,
            expectedItemRevision: item.revision,
            ...patch,
          },
        })
      );
    },

    async addItem(item: NewItem) {
      const review = cached();
      if (!review) return false;
      setAdding(true);
      try {
        const saved = await run(NEW_ITEM, () =>
          create.mutateAsync({
            noteId,
            data: { expectedReviewVersion: review.reviewVersion, ...item },
          })
        );
        // 서버가 새 항목을 주제 members 에 합쳤을 수 있다. 다시 읽은 뒤에 폼이 닫혀야 소속이 맞다.
        // 주제 번호를 보낸 추가만 요약 members 가 바뀐다. 전체 보기 추가는 요약을 기다리지 않는다.
        if (saved && item.topicOrdinal != null) {
          try {
            await queryClient.refetchQueries(
              { queryKey: getGetMeetingReviewSummaryQueryKey(noteId) },
              { throwOnError: true }
            );
          } catch {
            // 항목은 저장됐다. 요약만 못 읽었으니 폼은 닫고, 주제 목록이 낡을 수 있음을 알린다.
            toast.error("저장했지만 주제 목록을 새로 읽지 못했습니다. 새로고침하면 보입니다.");
          }
        }
        return saved;
      } finally {
        setAdding(false);
      }
    },
  };
}
