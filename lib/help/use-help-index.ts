"use client";

import { useEffect, useState } from "react";

import type { HelpEntry } from "@/lib/help/search-index";

let cached: Promise<HelpEntry[]> | null = null;

/** 첫 호출 때만 색인을 받아 모듈에 둔다. 실패하면 다음에 다시 받는다. */
const load = () =>
  (cached ??= fetch("/help/search-index.json")
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<HelpEntry[]>;
    })
    .catch((error) => {
      cached = null;
      throw error;
    }));

/** `enabled` 가 참이 되면 색인을 불러온다. 그 전에는 null. */
export function useHelpIndex(enabled: boolean) {
  const [entries, setEntries] = useState<HelpEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled || entries) return;
    let live = true;
    setFailed(false); // eslint-disable-line react-hooks/set-state-in-effect -- 재시도마다 실패 표시를 걷는다
    load().then(
      (loaded) => live && setEntries(loaded),
      () => live && setFailed(true)
    );
    return () => {
      live = false;
    };
  }, [enabled, entries]);
  return { entries, failed };
}
