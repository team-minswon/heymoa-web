"use client";

import { useEffect, useRef } from "react";

import { track } from "@/lib/analytics/track";

/** 준비된 요약을 표시한 경우만 셉니다. 조회 재시도·캐시 갱신은 같은 열람입니다. */
export function useSummaryViewed(
  noteId: string,
  workspaceId: string | undefined,
  ready: boolean
) {
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || viewed.current === noteId) return;
    viewed.current = noteId;
    track("summary_viewed", { workspace_id: workspaceId });
  }, [ready, noteId, workspaceId]);
}
