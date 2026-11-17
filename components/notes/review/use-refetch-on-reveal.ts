"use client";

import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef } from "react";

/** 숨긴 탭이 다시 보이는 순간 조회를 다시 읽는다. 꺼진(`enabled: false`) 조회는 invalidate 가 다시 부르지 않는다. */
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
