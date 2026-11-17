"use client";

/* eslint-disable react-hooks/set-state-in-effect -- 주소(?q=)는 서버가 그린 HTML 과 첫 렌더를 맞추려고 마운트한 뒤에만 읽는다 */

import { useLocale, useTranslations } from "next-intl";
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { FOCUS } from "@/components/heymoa/landing/tokens";
import { HelpHitRow } from "@/components/help/help-hit-list";
import { searchHelp } from "@/lib/help/search-index";
import { trackHelp } from "@/lib/help/analytics";
import { useHelpIndex } from "@/lib/help/use-help-index";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 100;
const ANNOUNCE_MS = 600;

type Hub = {
  value: string;
  setValue: (value: string) => void;
  query: string;
  clear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFocus: () => void;
  announce: string;
  hits: ReturnType<typeof searchHelp>;
  loading: boolean;
  failed: boolean;
};
const HubContext = createContext<Hub | null>(null);
function UrlQuerySync({ onChange }: { onChange: (q: string) => void }) {
  const q = useSearchParams().get("q") ?? "";
  useEffect(() => onChange(q), [q, onChange]);
  return null;
}

const useHub = () => {
  const hub = useContext(HubContext);
  if (!hub) throw new Error("HelpHubProvider 안에서 써야 합니다");
  return hub;
};

export function HelpHubProvider({ children }: { children: React.ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [announce, setAnnounce] = useState("");
  const timer = useRef(0);
  const written = useRef<string | null>(null);
  const typed = useRef(false);
  const openedBy = useRef<"keyboard" | "click" | null>(null);
  const opened = useRef(false);
  const onFocus = () => {
    if (opened.current) return;
    opened.current = true;
    trackHelp("help_search_opened", { surface: "hub", via: openedBy.current ?? "click" });
  };
  const t = useTranslations("help.search");
  const { entries, failed } = useHelpIndex(value.length > 0, useLocale());

  const syncFromUrl = useCallback((q: string) => {
    if (q === written.current) return;
    window.clearTimeout(timer.current);
    setValue(q);
    setQuery(q);
  }, []);

  const writeUrl = (q: string) => {
    written.current = q;
    const url = new URL(window.location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  };
  const type = (next: string) => {
    typed.current = true;
    setValue(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setQuery(next);
      writeUrl(next);
    }, DEBOUNCE_MS);
  };

  const hits = query && entries ? searchHelp(entries, query) : [];

  useEffect(() => {
    if (!query || !entries) {
      setAnnounce("");
      return;
    }
    const timer = window.setTimeout(() => {
      setAnnounce(
        hits.length ? t("found", { count: hits.length }) : t("noMatch")
      );
      if (typed.current) {
        typed.current = false;
        trackHelp("help_search_submitted", {
          query_length: query.length,
          result_count: hits.length,
          zero_results: hits.length === 0,
        });
      }
    }, ANNOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, entries, hits.length, t]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const slash =
        event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!slash) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      event.preventDefault();
      openedBy.current = "keyboard";
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const clear = () => {
    window.clearTimeout(timer.current);
    setValue("");
    setQuery("");
    writeUrl("");
    inputRef.current?.focus();
  };

  const loading = value.length > 0 && !entries && !failed;
  return (
    <HubContext.Provider
      value={{
        value,
        setValue: type,
        query,
        clear,
        inputRef,
        onFocus,
        announce,
        hits,
        loading,
        failed,
      }}
    >
      <Suspense fallback={null}>
        <UrlQuerySync onChange={syncFromUrl} />
      </Suspense>
      {children}
    </HubContext.Provider>
  );
}

export function HelpHubInput() {
  const { value, setValue, clear, inputRef, onFocus, announce } = useHub();
  const t = useTranslations("help.search");
  return (
    <div className="mt-5 max-w-[640px]">
      <div role="search" className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[var(--tv-muted)]"
        />
        <input
          ref={inputRef}
          data-help-hub-input=""
          onFocus={onFocus}
          type="search"
          value={value}
          aria-label={t("label")}
          placeholder={t("placeholderExample")}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              event.preventDefault();
              if (value) clear();
              else inputRef.current?.blur();
            }
          }}
          className={cn(
            "h-12 w-full min-w-0 rounded-[12px] border border-[var(--tv-rule-strong)] bg-white pr-24 pl-12 text-[16px] text-[var(--tv-ink)] help-fade placeholder:text-[var(--tv-muted)] hover:border-[var(--tv-brand)] [&::-webkit-search-cancel-button]:hidden",
            FOCUS
          )}
        />
        {value ? (
          <button
            type="button"
            aria-label={t("clear")}
            onClick={clear}
            className={cn(
              "absolute top-1/2 right-2.5 grid size-9 -translate-y-1/2 place-items-center rounded-[10px] text-[var(--tv-muted)] help-fade hover:bg-[var(--tv-lav)] hover:text-[var(--tv-ink)]",
              FOCUS
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-4 flex -translate-y-1/2 items-center gap-1 text-[12px] font-bold text-[var(--tv-muted)]"
          >
            <kbd className="grid h-6 min-w-6 place-items-center rounded-[6px] border border-[var(--tv-rule-strong)] bg-white px-1.5 font-sans">
              /
            </kbd>
          </span>
        )}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}

export function HelpHubBody({ children }: { children: React.ReactNode }) {
  const { query, hits, loading, failed } = useHub();
  const t = useTranslations("help.search");
  if (!query) return <>{children}</>;
  if (failed)
    return (
      <p className="m-0 text-[16px] leading-[1.75] text-[var(--tv-body)]">
        {t("failed")}
      </p>
    );
  if (loading)
    return (
      <p className="m-0 text-[14px] text-[var(--tv-muted)]">{t("searching")}</p>
    );
  if (hits.length === 0)
    return (
      <p className="m-0 text-[16px] leading-[1.75] text-[var(--tv-body)]">
        {t("noMatchFor", { query })}
      </p>
    );
  return (
    <div>
      <p
        className="m-0 mb-3 text-[14px] font-bold text-[var(--tv-muted)]"
        aria-hidden
      >
        {t("found", { count: hits.length })}
      </p>
      <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 lg:grid-cols-2">
        {hits.map((hit, rank) => (
          <li key={`${hit.path}#${hit.sectionId}`}>
            <HelpHitRow hit={hit} query={query} rank={rank + 1} />
          </li>
        ))}
      </ul>
    </div>
  );
}
