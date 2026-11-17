"use client";

/* eslint-disable react-hooks/set-state-in-effect -- 주소(?q=)와 본문 DOM 은 서버가 그린 HTML 과 첫 렌더를 맞추려고 마운트한 뒤에만 읽는다 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { findMatchRanges, stepIndex } from "@/lib/help/match-ranges";
import { prefersReducedMotion } from "@/lib/help/scroll";
import { cn } from "@/lib/utils";

const HIGHLIGHT_CSS = `
::highlight(help-search) {
  background-color: var(--tv-butter);
  color: var(--tv-ink);
  text-decoration: underline;
  text-decoration-color: var(--tv-brand);
  text-decoration-thickness: 1px;
}
::highlight(help-search-active) {
  background-color: var(--tv-pop);
  color: var(--tv-ink);
  text-decoration: underline;
  text-decoration-color: var(--tv-brand-deep);
  text-decoration-thickness: 2px;
}`;

const ANNOUNCE_MS = 600;
const TOP_SAFE = 120;

const readHash = () => {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "";
  }
};

function UrlQuerySync({ onChange }: { onChange: (q: string) => void }) {
  const q = useSearchParams().get("q") ?? "";
  useEffect(() => onChange(q), [q, onChange]);
  return null;
}

export function HelpSearch({ targetId }: { targetId: string }) {
  const t = useTranslations("help.search");
  const rangesRef = useRef<Range[]>([]);
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [announce, setAnnounce] = useState("");
  const firstRun = useRef(true);
  const loaded = useRef(false);
  const jump = useRef(false);

  const syncFromUrl = useCallback((q: string) => {
    jump.current = !loaded.current && q !== "";
    loaded.current = true;
    firstRun.current = true;
    setQuery(q);
  }, []);

  useEffect(() => {
    const root = document.getElementById(targetId);
    const ranges = root ? findMatchRanges(root, query) : [];
    rangesRef.current = ranges;
    setTotal(ranges.length);
    let first = 0;
    if (firstRun.current && query) {
      firstRun.current = false;
      const hashId = readHash();
      const inSection = ranges.findIndex(
        (range) =>
          range.startContainer.parentElement?.closest("section[id]")?.id ===
          hashId
      );
      if (hashId && inSection > 0) first = inSection;
    }
    setActive(first);

    const hit = new Set<string>();
    for (const range of ranges) {
      const id = range.startContainer.parentElement?.closest("section[id]")?.id;
      if (id) hit.add(id);
    }
    const links = document.querySelectorAll<HTMLElement>("[data-toc-link]");
    for (const link of links) {
      const id = link.getAttribute("href")?.slice(1) ?? "";
      if (query && ranges.length > 0 && !hit.has(id)) link.dataset.miss = "";
      else delete link.dataset.miss;
    }
    return () => {
      for (const link of links) delete link.dataset.miss;
    };
  }, [query, targetId]);

  useEffect(() => {
    const ranges = rangesRef.current;
    const highlights = typeof CSS !== "undefined" ? CSS.highlights : undefined;
    const current = ranges[active];
    if (highlights && typeof Highlight !== "undefined") {
      highlights.set("help-search", new Highlight(...ranges));
      highlights.set(
        "help-search-active",
        new Highlight(...(current ? [current] : []))
      );
    }
    if (current) {
      const rect = current.getBoundingClientRect();
      if (rect.top < TOP_SAFE || rect.bottom > window.innerHeight - 80) {
        current.startContainer.parentElement?.scrollIntoView({
          block: "center",
          behavior: prefersReducedMotion() || jump.current ? "auto" : "smooth",
        });
      }
    }
    return () => {
      highlights?.delete("help-search");
      highlights?.delete("help-search-active");
    };
  }, [query, total, active]);

  useEffect(() => {
    if (!query) {
      setAnnounce("");
      return;
    }
    const timer = window.setTimeout(
      () =>
        setAnnounce(
          total ? t("inPageCount", { count: total }) : t("inPageNoneSentence")
        ),
      ANNOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [query, total, t]);

  const step = useCallback(
    (direction: 1 | -1) => {
      jump.current = false;
      setActive((now) => stepIndex(now, total, direction));
    },
    [total]
  );

  // 주소에서 검색어만 지운다. `null` 상태여야 Next 가 `useSearchParams` 에 알린다.
  const close = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  useEffect(() => {
    if (!query) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector("[role='dialog']")
      )
        close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [query, close]);

  return (
    <>
      <style>{HIGHLIGHT_CSS}</style>
      <Suspense fallback={null}>
        <UrlQuerySync onChange={syncFromUrl} />
      </Suspense>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {query ? (
        <div
          role="search"
          aria-label={t("inPage")}
          className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--tv-rule-strong)] bg-white py-1 pr-1.5 pl-4 text-[14px] text-[var(--tv-body)] shadow-[0_8px_24px_-12px_rgb(12_10_9/0.35)]"
        >
          <span className="max-w-[200px] truncate font-bold text-[var(--tv-ink)]">
            {query}
          </span>
          {total === 0 ? (
            <span className="px-2">{t("inPageNone")}</span>
          ) : (
            <>
              <span
                className="px-2 font-bold tabular-nums text-[var(--tv-ink)]"
                aria-hidden
              >
                {active + 1} / {total}
              </span>
              {(
                [
                  [t("prevMatch"), -1, ChevronUp],
                  [t("nextMatch"), 1, ChevronDown],
                ] as const
              ).map(([label, direction, Icon]) => (
                <Button
                  key={label}
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={label}
                  onClick={() => step(direction)}
                  className={cn(
                    "size-8 rounded-full text-[var(--tv-body)] hover:bg-[var(--tv-lav-soft)] hover:text-[var(--tv-ink)]",
                    FOCUS
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </Button>
              ))}
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("close")}
            onClick={close}
            className={cn(
              "size-8 rounded-full text-[var(--tv-body)] hover:bg-[var(--tv-lav-soft)] hover:text-[var(--tv-ink)]",
              FOCUS
            )}
          >
            <X aria-hidden className="size-4" />
          </Button>
        </div>
      ) : null}
    </>
  );
}
