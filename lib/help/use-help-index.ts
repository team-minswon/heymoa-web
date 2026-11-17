"use client";

import { useEffect, useState } from "react";

import type { HelpEntry } from "@/lib/help/search-index";
import { localePath, type Locale } from "@/lib/i18n/locales";

const cached = new Map<Locale, Promise<HelpEntry[]>>();

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
