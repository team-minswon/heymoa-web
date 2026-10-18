"use client";

/* eslint-disable react-hooks/set-state-in-effect -- 주소(?q=)는 서버가 그린 HTML 과 첫 렌더를 맞추려고 마운트한 뒤에만 읽는다 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { FOCUS } from "@/components/heymoa/landing/tokens";
import { HelpHitRow } from "@/components/help/help-hit-list";
import { searchHelp } from "@/lib/help/search-index";
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
  announce: string;
  hits: ReturnType<typeof searchHelp>;
  loading: boolean;
  failed: boolean;
};
const HubContext = createContext<Hub | null>(null);
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
  const { entries, failed } = useHelpIndex(value.length > 0);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setValue(q);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(value), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }, [query]);

  const hits = query && entries ? searchHelp(entries, query) : [];

  useEffect(() => {
    if (!query || !entries) {
      setAnnounce("");
      return;
    }
    const timer = window.setTimeout(
      () =>
        setAnnounce(
          hits.length
            ? `${hits.length}곳에서 찾았어요`
            : "일치하는 내용이 없어요."
        ),
      ANNOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [query, entries, hits.length]);

  // `/` 와 ⌘K · Ctrl+K 모두 이 칸으로 온다(입력 중이 아닐 때의 `/`).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const palette =
        event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      const slash =
        event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!palette && !slash) return;
      const target = event.target;
      if (
        slash &&
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const clear = () => {
    setValue("");
    setQuery("");
    inputRef.current?.focus();
  };

  const loading = value.length > 0 && !entries && !failed;
  return (
    <HubContext.Provider
      value={{
        value,
        setValue,
        query,
        clear,
        inputRef,
        announce,
        hits,
        loading,
        failed,
      }}
    >
      {children}
    </HubContext.Provider>
  );
}

/** 큰 검색칸. 머리 판 안에 선다. */
export function HelpHubInput() {
  const { value, setValue, clear, inputRef, announce } = useHub();
  return (
    <div className="mt-8 max-w-[640px]">
      <div role="search" className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[var(--tv-muted)]"
        />
        <input
          ref={inputRef}
          type="search"
          value={value}
          aria-label="사용 가이드 전체에서 찾기"
          placeholder="검색어를 입력하세요 (예: 녹음, 용어 사전)"
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
            "h-14 w-full min-w-0 rounded-[16px] border border-[var(--tv-rule-strong)] bg-white pr-24 pl-12 text-[16px] text-[var(--tv-ink)] transition-colors duration-150 placeholder:text-[var(--tv-muted)] hover:border-[var(--tv-brand)] [&::-webkit-search-cancel-button]:hidden",
            FOCUS
          )}
        />
        {value ? (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={clear}
            className={cn(
              "absolute top-1/2 right-2.5 grid size-9 -translate-y-1/2 place-items-center rounded-[10px] text-[var(--tv-muted)] transition-colors duration-150 hover:bg-[var(--tv-lav)] hover:text-[var(--tv-ink)]",
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
  if (!query) return <>{children}</>;
  if (failed)
    return (
      <p className="m-0 text-[16px] leading-[1.75] break-keep text-[var(--tv-body)]">
        검색에 필요한 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.
      </p>
    );
  if (loading)
    return (
      <p className="m-0 text-[14px] text-[var(--tv-muted)]">찾는 중이에요…</p>
    );
  if (hits.length === 0)
    return (
      <p className="m-0 text-[16px] leading-[1.75] break-keep text-[var(--tv-body)]">
        「{query}」와 일치하는 내용이 없어요. 다른 낱말로 찾아보세요.
      </p>
    );
  return (
    <div>
      <p
        className="m-0 mb-3 text-[14px] font-bold text-[var(--tv-muted)]"
        aria-hidden
      >
        {hits.length}곳에서 찾았어요
      </p>
      <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 lg:grid-cols-2">
        {hits.map((hit) => (
          <li key={`${hit.path}#${hit.sectionId}`}>
            <HelpHitRow hit={hit} query={query} />
          </li>
        ))}
      </ul>
    </div>
  );
}
