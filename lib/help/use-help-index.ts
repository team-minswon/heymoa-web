"use client";

import { useEffect, useState } from "react";

import type { HelpEntry } from "@/lib/help/search-index";
import { localePath, type Locale } from "@/lib/i18n/locales";

/** 언어판마다 한 벌. 다른 언어판의 결과가 섞이지 않게 언어가 캐시 키다. */
const cached = new Map<Locale, Promise<HelpEntry[]>>();

/** 언어마다 첫 호출 때만 색인을 받아 모듈에 둔다. 실패하면 다음에 다시 받는다. */
const load = (locale: Locale) => {
  let entries = cached.get(locale);
  if (!entries) {
    entries = fetch(localePath(locale, "/help/search-index.json"))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<HelpEntry[]>;
      })
      .catch((error) => {
        cached.delete(locale);
        throw error;
      });
    cached.set(locale, entries);
  }
  return entries;
};

/** `enabled` 가 참이 되면 그 언어판의 색인을 불러온다. 그 전에는 null. */
export function useHelpIndex(enabled: boolean, locale: Locale) {
  const [entries, setEntries] = useState<HelpEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled || entries) return;
    let live = true;
    setFailed(false); // eslint-disable-line react-hooks/set-state-in-effect -- 재시도마다 실패 표시를 걷는다
    load(locale).then(
      (loaded) => live && setEntries(loaded),
      () => live && setFailed(true)
    );
    return () => {
      live = false;
    };
  }, [enabled, entries, locale]);
  return { entries, failed };
}
