"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { useGetMyFeedbacks } from "@/lib/api/generated/feedbacks/feedbacks";
import type { FeedbackResponseData } from "@/lib/api/generated/models";

/** 내 문의 탭을 마지막으로 본 시각의 가장 늦은 답변 시각. 이보다 늦은 답변만 「새 답변」이다. */
const SEEN_KEY = "heymoa:feedback-seen";

/** 같은 문서 안의 훅(사이드바·문의 창)이 서로의 변경을 알아채게 한다. `storage` 이벤트는 다른 탭에만 온다. */
const SEEN_EVENT = "heymoa:feedback-seen-change";

function readSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribeSeen(onChange: () => void) {
  window.addEventListener(SEEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SEEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * 내 문의와 새 답변 수. 사이드바 뱃지와 문의 창이 같은 쿼리를 나눠 쓴다.
 * 본 시각은 이 브라우저에만 남긴다 — 서버에 읽음 상태를 두지 않는다(운영자는 DB 에 답만 넣는다).
 */
export function useFeedbackAnswers() {
  const query = useGetMyFeedbacks({ query: { staleTime: 60_000 } });
  const seen = useSyncExternalStore(subscribeSeen, readSeen, () => "");

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
    try {
      window.localStorage.setItem(SEEN_KEY, latest);
    } catch {
      // 저장이 막힌 브라우저에서는 뱃지가 다음 방문에 다시 뜰 뿐이다.
    }
    window.dispatchEvent(new Event(SEEN_EVENT));
  }, [feedbacks, seen]);

  return { feedbacks, unseen, markSeen, isLoading: query.isLoading };
}
