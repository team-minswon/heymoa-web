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
/** 주소의 `?q=` 를 알린다(마운트 · 뒤로/앞으로). 화면에는 아무것도 그리지 않는다. */
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

/**
 * 허브의 검색 상태. 큰 검색칸(`HelpHubInput`, 머리 판 안)과 결과(`HelpHubBody`)가 서로 떨어져 서 있어서 상태를 context 로
 * 나눈다. 색인은 검색을 시작할 때 한 번 내려받는다. 결과를 누르면 그 주제의 그 섹션으로 가고, 도착한 페이지가 같은
 * 검색어(`?q=`)로 본문을 칠한다.
 */
export function HelpHubProvider({ children }: { children: React.ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [announce, setAnnounce] = useState("");
  const timer = useRef(0);
  // 우리가 방금 주소에 쓴 검색어. 이것과 같은 주소 변화는 바깥 이동이 아니라 우리 자신의 기록이라 입력을 되돌리지 않는다.
  const written = useRef<string | null>(null);
  // 사용자가 직접 입력한 검색어만 센다(뒤로 가기로 복원된 주소의 검색어는 세지 않는다).
  const typed = useRef(false);
  // 검색칸을 처음 연 방법(`/` 키인지 눌러서인지). 마운트마다 한 번만 센다.
  const openedBy = useRef<"keyboard" | "click" | null>(null);
  const opened = useRef(false);
  const onFocus = () => {
    if (opened.current) return;
    opened.current = true;
    trackHelp("help_search_opened", { surface: "hub", via: openedBy.current ?? "click" });
  };
  const t = useTranslations("help.search");
  const { entries, failed } = useHelpIndex(value.length > 0, useLocale());

  // 주소가 원본이다. 마운트 · 뒤로/앞으로 · 새로고침으로 주소가 정해지면 그 검색어를 읽어 오기만 하고 **주소를 쓰지 않는다**.
  // (예전에는 마운트 효과가 주소의 `?q=` 를 지웠다가 100ms 뒤 다시 붙였다 — 뒤로 갔을 때 주소가 뒤늦게 바뀌었다.)
  const syncFromUrl = useCallback((q: string) => {
    if (q === written.current) return;
    window.clearTimeout(timer.current);
    setValue(q);
    setQuery(q);
  }, []);

  // 주소는 사용자가 입력할 때만 쓴다(같은 항목을 바꾸는 `replaceState` 라 history 가 쌓이지 않는다).
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
    // 입력이 멎은 뒤(ANNOUNCE_MS) 한 번 — 한 글자마다 세지 않는다.
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

  // 입력 중이 아닐 때의 `/` 는 이 칸으로 온다. ⌘K · Ctrl+K 는 상단바의 검색 팔레트가 받는다.
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

/** 큰 검색칸. 머리 판 안에 선다. */
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

/** 검색어가 없으면 `children`(주제 카드), 있으면 결과 목록. */
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
