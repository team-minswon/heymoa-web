"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import {
  getGetMyFeedbacksQueryKey,
  useGetMyFeedbacks,
  useMarkFeedbackAnswersSeen,
  type getMyFeedbacksResponse,
} from "@/lib/api/generated/feedbacks/feedbacks";
import type { FeedbackListResponseDataFeedbacksItem } from "@/lib/api/generated/models";

type Item = FeedbackListResponseDataFeedbacksItem;
type Cached = getMyFeedbacksResponse | undefined;

function itemsOf(cached: Cached): Item[] {
  return cached?.status === 200 && cached.data.success
    ? (cached.data.data?.feedbacks ?? [])
    : [];
}

function unseenOf(items: Item[]): Item[] {
  const tracksSeen = items.every(
    (item) => typeof (item.answerSeen as boolean | undefined) === "boolean"
  );
  return tracksSeen
    ? items.filter((item) => item.answer !== null && !item.answerSeen)
    : [];
}

function markedSeen(cached: Cached): Cached {
  if (cached?.status !== 200 || !cached.data.data) return cached;
  const ids = new Set(unseenOf(itemsOf(cached)).map((item) => item.feedbackId));
  return {
    ...cached,
    data: {
      ...cached.data,
      data: {
        ...cached.data.data,
        feedbacks: cached.data.data.feedbacks.map((item) =>
          ids.has(item.feedbackId) ? { ...item, answerSeen: true } : item
        ),
      },
    },
  };
}

export function useFeedbackAnswers() {
  const queryClient = useQueryClient();
  const query = useGetMyFeedbacks({ query: { staleTime: 60_000 } });
  const key = getGetMyFeedbacksQueryKey();
  const mark = useMarkFeedbackAnswersSeen({
    mutation: {
      meta: { suppressErrorToast: true },
      onMutate: async () => {
        const interrupted = queryClient.isFetching({ queryKey: key }) > 0;
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<Cached>(key);
        queryClient.setQueryData<Cached>(key, markedSeen(previous));
        const version = queryClient.getQueryState(key)?.dataUpdateCount;
        return { previous, version, interrupted };
      },
      onSettled: (_data, _error, _variables, context) => {
        if (context?.interrupted)
          void queryClient.refetchQueries({ queryKey: key });
      },
      onError: (_error, _variables, context) => {
        if (
          context &&
          queryClient.getQueryState(key)?.dataUpdateCount === context.version
        )
          queryClient.setQueryData<Cached>(key, context.previous);
      },
    },
  });

  const feedbacks = useMemo(() => itemsOf(query.data), [query.data]);
  const unseen = useMemo(() => unseenOf(feedbacks).length, [feedbacks]);

  const { mutate, reset, isPending, isError: markFailed } = mark;
  const markSeen = useCallback(() => {
    if (unseen === 0 || isPending || markFailed) return;
    mutate();
  }, [unseen, isPending, markFailed, mutate]);

  const isError =
    query.isError || (query.data !== undefined && query.data.status !== 200);

  return {
    feedbacks,
    unseen,
    markSeen,
    resetMarkSeen: reset,
    isLoading: query.isLoading,
    isError,
    refetch: query.refetch,
  };
}
