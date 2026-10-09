"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import {
  CONFIRMED_MESSAGE,
  CONFLICT_MESSAGE,
  errorCodeOf,
  errorMessageOf,
} from "@/lib/api/error-message";
import { okData } from "@/lib/api/ok-data";
import { getGetAnalysisFlowQueryKey } from "@/lib/api/generated/analysis/analysis";
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
import {
  applyItemPatch,
  restoreItemFields,
} from "@/lib/notes/review/apply-item-patch";
import { moveFlowStatus } from "@/lib/notes/review/flow-cache";
import { isProjectTaskQueryKey } from "@/lib/tasks/task-groups";
import { toast } from "@/lib/ui/toast";

type ItemPatch = Omit<
  UpdateMeetingReviewItemRequest,
  "expectedReviewVersion" | "expectedItemRevision"
>;
type NewItem = Omit<AddMeetingReviewItemRequest, "expectedReviewVersion">;

const CONFLICT = "MEETING_REVIEW_CONFLICT";
const CONFIRMED = "MEETING_REVIEW_CONFIRMED";
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

  const cached = () =>
    okData(queryClient.getQueryData<getMeetingReviewResponse>(queryKey));

  const store = (review: MeetingReviewResponse) =>
    queryClient.setQueryData<getMeetingReviewResponse>(queryKey, (previous) =>
      previous ? { ...previous, status: 200, data: review } : previous
    );

  async function run(
    target: string,
    save: () => Promise<{ status: number; data: unknown }>,
    /**
     * 응답 전에 화면에 먼저 거는 값과 그것을 되돌리는 법(APP-1033). 서버가 정하는 값이 걸린 저장에는 안 준다.
     * 되돌림은 **지금 캐시에서 그 항목의 칸만** 이전 값으로 돌린다 — 전체 사본을 복원하면 그사이 다른 조회가 가져온
     * 더 새 검토본을 옛 판으로 덮는다.
     */
    optimistic?: {
      apply: (
        review: NonNullable<ReturnType<typeof cached>>
      ) => NonNullable<ReturnType<typeof cached>>;
      restore: (
        current: NonNullable<ReturnType<typeof cached>>,
        before: NonNullable<ReturnType<typeof cached>>
      ) => NonNullable<ReturnType<typeof cached>>;
    }
  ) {
    if (lock.current) return false;
    lock.current = true;
    setBusyItemId(target);
    await queryClient.cancelQueries({ queryKey });
    // 먼저 건 값은 응답이 오면 서버 값으로 갈린다. 실패하면 이 읽은 값으로 그 칸만 되돌린다.
    const before = cached();
    if (optimistic && before) {
      queryClient.setQueryData<getMeetingReviewResponse>(
        queryKey,
        (previous) =>
          previous?.status === 200 && previous.data.success
            ? {
                ...previous,
                data: { ...previous.data, data: optimistic.apply(before) },
              }
            : previous
      );
    }
    try {
      const response = await save();
      if (response.status === 200 || response.status === 201) {
        store(response.data as MeetingReviewResponse);
      }
      setConflictItemId(null);
      return true;
    } catch (error) {
      if (optimistic && before) {
        queryClient.setQueryData<getMeetingReviewResponse>(
          queryKey,
          (previous) =>
            previous?.status === 200 && previous.data.success
              ? {
                  ...previous,
                  data: {
                    ...previous.data,
                    data: optimistic.restore(previous.data.data, before),
                  },
                }
              : previous
        );
      }
      if (errorCodeOf(error) === CONFIRMED) {
        // 다시 읽어도 고칠 수 없다. 흐름 상태를 읽어 화면이 확정(읽기 전용)으로 바뀌게 한다. 입력은 남긴다.
        toast.error(errorMessageOf(error, CONFIRMED_MESSAGE));
        // 재조회가 늦거나 실패해도 편집이 다시 켜지지 않게 캐시를 먼저 확정으로 옮긴다. 검토본도 같이 읽는다.
        moveFlowStatus(queryClient, noteId, "CONFIRMED");
        void queryClient.refetchQueries({
          queryKey: getGetAnalysisFlowQueryKey(noteId),
        });
        void queryClient.refetchQueries({ queryKey });
        // 확정된 판으로 주제 목록 · 칩 개수 · 할 일이 달라졌다. 같이 낡음 처리한다.
        void queryClient.invalidateQueries({
          queryKey: getGetMeetingReviewSummaryQueryKey(noteId),
        });
        void queryClient.invalidateQueries({
          predicate: (query) => isProjectTaskQueryKey(query.queryKey),
        });
      } else if (errorCodeOf(error) === CONFLICT) {
        // 새 항목에는 안내를 그릴 줄이 없다. 쓴 내용은 폼에 남으니 토스트로 알린다.
        if (target === NEW_ITEM) toast.error(CONFLICT_MESSAGE);
        else setConflictItemId(target);
        await queryClient.refetchQueries({ queryKey });
        // 그 사이 다른 사람이 주제 안에 항목을 더했으면 요약 members 도 달라졌다. 기다리지 않고 같이 읽는다.
        void queryClient.refetchQueries({
          queryKey: getGetMeetingReviewSummaryQueryKey(noteId),
        });
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
      return run(
        itemId,
        () =>
          update.mutateAsync({
            noteId,
            itemId,
            data: {
              expectedReviewVersion: review.reviewVersion,
              expectedItemRevision: item.revision,
              ...patch,
            },
          }),
        // 응답 전에 먼저 걸 수 있는 칸이 있으면 건다(포함 여부·기한·제안 선택). 내용·담당은 서버가 정하므로 안 건다.
        "included" in patch || "due" in patch || patch.decisions
          ? {
              apply: (current) => applyItemPatch(current, itemId, patch),
              restore: (current) => restoreItemFields(current, item, patch),
            }
          : undefined
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
        return saved;
      } finally {
        setAdding(false);
      }
    },
  };
}
