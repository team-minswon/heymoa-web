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

/** 옛 server 는 `answerSeen` 을 안 준다. 그때는 숫자를 그리지 않는다 — 브라우저 기억으로 되돌아가지 않는다. */
function unseenOf(items: Item[]): Item[] {
  const tracksSeen = items.every(
    (item) => typeof (item.answerSeen as boolean | undefined) === "boolean"
  );
  return tracksSeen
    ? items.filter((item) => item.answer !== null && !item.answerSeen)
    : [];
}

/** 답이 있는 미읽음을 읽음으로 쓴 응답. 다른 항목과 응답 모양은 그대로다. */
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

/**
 * 내 문의와 새 답변 수. 사이드바 숫자와 문의 창이 같은 쿼리 캐시를 본다 — 한쪽에서 읽으면 다른 쪽도 바로 줄어든다.
 * 읽음은 서버가 안다(`answerSeen`, APP-1213) — 기기·주소가 달라도 같다.
 */
export function useFeedbackAnswers() {
  const queryClient = useQueryClient();
  const query = useGetMyFeedbacks({ query: { staleTime: 60_000 } });
  const key = getGetMyFeedbacksQueryKey();
  // 낙관적 갱신과 되돌림을 mutation 자신에 둔다 — 호출한 화면이 사라져도 되돌림이 돈다.
  const mark = useMarkFeedbackAnswersSeen({
    mutation: {
      // 조용한 동작이다 — 실패해도 숫자만 되돌리고 토스트를 띄우지 않는다.
      meta: { suppressErrorToast: true },
      onMutate: async () => {
        // 진행 중인 조회가 늦게 도착해 읽음을 미읽음으로 되돌리지 않게 먼저 멈춘다. 멈춘 조회(방금 보낸 문의를
        // 받아 오던 것일 수 있다)는 읽음 처리가 끝난 뒤 다시 돌린다 — 그 밖에는 다시 조회하지 않는다.
        const interrupted = queryClient.isFetching({ queryKey: key }) > 0;
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<Cached>(key);
        queryClient.setQueryData<Cached>(key, markedSeen(previous));
        // 같은 내용이 다시 와도 구조 공유로 참조가 같아지므로, 값이 아니라 갱신 횟수로 「그 뒤에 바뀌었나」를 본다.
        const version = queryClient.getQueryState(key)?.dataUpdateCount;
        return { previous, version, interrupted };
      },
      onSettled: (_data, _error, _variables, context) => {
        if (context?.interrupted)
          void queryClient.refetchQueries({ queryKey: key });
      },
      onError: (_error, _variables, context) => {
        // 그새 캐시가 다시 받은 목록으로 바뀌었으면 그쪽이 서버 사실이라 덮지 않는다.
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

  // 한 번에 하나만 보낸다. 실패하면 창을 다시 열 때까지 다시 부르지 않는다 — 되돌린 숫자가 곧바로 또 부르는 고리를 막는다.
  const { mutate, reset, isPending, isError: markFailed } = mark;
  const markSeen = useCallback(() => {
    if (unseen === 0 || isPending || markFailed) return;
    mutate();
  }, [unseen, isPending, markFailed, mutate]);

  // 응답이 와도 200 이 아니면(옛 server 의 404 등) 빈 목록이 아니라 실패다.
  const isError =
    query.isError || (query.data !== undefined && query.data.status !== 200);

  return {
    feedbacks,
    unseen,
    markSeen,
    /** 창을 닫을 때 부른다. 실패한 읽음 처리를 다음에 열 때 다시 시도하게 한다. */
    resetMarkSeen: reset,
    isLoading: query.isLoading,
    isError,
    refetch: query.refetch,
  };
}
