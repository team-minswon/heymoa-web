"use client";

import { useEffect, useRef } from "react";

import { track } from "@/lib/analytics/track";

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
