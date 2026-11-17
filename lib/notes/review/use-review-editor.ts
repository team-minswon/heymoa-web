"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useTranslations } from "next-intl";

import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { okData } from "@/lib/api/ok-data";
import { getGetAnalysisFlowQueryKey } from "@/lib/api/generated/analysis/analysis";
import {
  getGetMeetingReviewQueryKey,
  getGetMeetingReviewQueryOptions,
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
  const tError = useTranslations("errors");
  const t = useTranslations("notes.review.editor");
  const [conflictMessage, setConflictMessage] = useState(() => tError("conflict"));

  const cached = () =>
    okData(queryClient.getQueryData<getMeetingReviewResponse>(queryKey));

  const store = (review: MeetingReviewResponse) =>
    queryClient.setQueryData<getMeetingReviewResponse>(queryKey, (previous) =>
      previous ? { ...previous, status: 200, data: review } : previous
    );

  async function run(
    target: string,
    save: () => Promise<{ status: number; data: unknown }>,
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
        toast.error(errorMessageOf(error, tError("reviewConfirmed")));
        moveFlowStatus(queryClient, noteId, "CONFIRMED");
        void queryClient.refetchQueries({
          queryKey: getGetAnalysisFlowQueryKey(noteId),
        });
        void queryClient.refetchQueries({ queryKey });
        void queryClient.invalidateQueries({
          queryKey: getGetMeetingReviewSummaryQueryKey(noteId),
        });
        void queryClient.invalidateQueries({
          predicate: (query) => isProjectTaskQueryKey(query.queryKey),
        });
      } else if (errorCodeOf(error) === CONFLICT) {
        if (target !== NEW_ITEM) {
          setConflictItemId(target);
          setConflictMessage(t("conflict"));
        }
        try {
          await queryClient.fetchQuery({
            ...getGetMeetingReviewQueryOptions(noteId),
            staleTime: 0,
          });
          if (target === NEW_ITEM) toast.error(tError("conflict"));
          else setConflictMessage(tError("conflict"));
        } catch {
          toast.error(t("conflictReloadFailed"));
        }
        void queryClient.refetchQueries({
          queryKey: getGetMeetingReviewSummaryQueryKey(noteId),
        });
      } else {
        toast.error(errorMessageOf(error, t("saveFailed")));
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
    conflictMessage,
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
        "projectSelected" in patch ||
          "included" in patch ||
          "due" in patch ||
          patch.decisions
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
