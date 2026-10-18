"use client";

import { useCallback, useMemo, useState } from "react";

import { useGetMyFeedbacks } from "@/lib/api/generated/feedbacks/feedbacks";
import type { FeedbackResponseData } from "@/lib/api/generated/models";

/** 내 문의 탭을 마지막으로 본 시각의 가장 늦은 답변 시각. 이보다 늦은 답변만 「새 답변」이다. */
const SEEN_KEY = "heymoa:feedback-seen";

function readSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * 내 문의와 새 답변 수. 사이드바 뱃지와 문의 창이 같은 쿼리를 나눠 쓴다.
 * 본 시각은 이 브라우저에만 남긴다 — 서버에 읽음 상태를 두지 않는다(운영자는 DB 에 답만 넣는다).
 */
export function useFeedbackAnswers() {
  const query = useGetMyFeedbacks({ query: { staleTime: 60_000 } });
  const [seen, setSeen] = useState(readSeen);

  const feedbacks: FeedbackResponseData[] = useMemo(
    () =>
      query.data?.status === 200 && query.data.data.success
        ? (query.data.data.data?.feedbacks ?? [])
        : [],
    [query.data]
  );
  const unseen = feedbacks.filter(
    (item) => item.answeredAt !== null && item.answeredAt > seen
  ).length;

  const markSeen = useCallback(() => {
    const latest = feedbacks.reduce(
      (max, item) =>
        item.answeredAt !== null && item.answeredAt > max
          ? item.answeredAt
          : max,
      seen
    );
    if (latest === seen) return;
    setSeen(latest);
    try {
      window.localStorage.setItem(SEEN_KEY, latest);
    } catch {
      // 저장이 막힌 브라우저에서는 뱃지가 다음 방문에 다시 뜰 뿐이다.
    }
  }, [feedbacks, seen]);

  return { feedbacks, unseen, markSeen, isLoading: query.isLoading };
}
