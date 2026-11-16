"use client";

import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef } from "react";

/**
 * 숨겨 둔 탭이 다시 보이는 순간 이 화면의 조회를 다시 읽는다(APP-1660).
 *
 * 노트 탭은 읽던 스크롤 위치를 지키려고 지우지 않고 숨긴다. 그래서 탭에 들어올 때마다 일어나던
 * 마운트 재조회(`refetchOnMount: "always"`)가 없어진다 — 그 순간을 여기서 대신 건다.
 * 꺼진(`enabled: false`) 조회는 invalidate 가 다시 부르지 않는다.
 */
export function useRefetchOnReveal(active: boolean, queryKeys: QueryKey[]) {
  const queryClient = useQueryClient();
  const wasActive = useRef(active);
  const refetch = useEffectEvent(() => {
    for (const queryKey of queryKeys)
      void queryClient.invalidateQueries({ queryKey });
  });
  useEffect(() => {
    if (active && !wasActive.current) refetch();
    wasActive.current = active;
  }, [active]);
}
