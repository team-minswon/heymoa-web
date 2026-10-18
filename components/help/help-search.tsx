"use client";

/* eslint-disable react-hooks/set-state-in-effect -- 주소(?q=)와 본문 DOM 은 서버가 그린 HTML 과 첫 렌더를 맞추려고 마운트한 뒤에만 읽는다 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { findMatchRanges, stepIndex } from "@/lib/help/match-ranges";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 100;
/** 스크린리더 안내는 타이핑이 멎은 뒤 한 번만 읽는다. */
const ANNOUNCE_MS = 600;

/** 입력 중이 아닐 때만 `/` 로 검색에 들어간다. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** 주소 해시를 안전하게 읽는다. 깨진 인코딩(`#%`)은 빈 값으로 본다. */
const readHash = () => {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "";
  }
};

/**
 * 같은 페이지 안에서 `?q=` 가 바뀌는 이동(⌘K 결과, 링크)을 알린다. 화면에는 아무것도 그리지 않아서, 정적 렌더가
 * 요구하는 Suspense 경계로 감싸도 자리가 밀리지 않는다.
 */
function UrlQuerySync({ onChange }: { onChange: (q: string) => void }) {
  const q = useSearchParams().get("q") ?? "";
  useEffect(() => onChange(q), [q, onChange]);
  return null;
}

/**
 * 사용 가이드 검색 (APP-1232). 본문 DOM 은 건드리지 않는다 — 일치 구간을 CSS Custom Highlight API 로만 칠하므로
 * 서버가 그린 HTML 과 첫 클라이언트 렌더가 그대로 같다. 이 API 가 없는 브라우저에서는 칠하지 않고, 개수와
 * 이전/다음 이동(스크롤)만 된다. 칠하는 규칙은 `app/globals.css` 의 `::highlight(help-search*)`.
 */
export function HelpSearch({ targetId }: { targetId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rangesRef = useRef<Range[]>([]);
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [announce, setAnnounce] = useState("");
  const firstRun = useRef(true);
  // 우리가 방금 주소에 쓴 검색어. 이것과 같으면 바깥 이동이 아니라 우리 자신의 기록이다.
  const written = useRef("");

  // 주소의 `?q=` 로 들어오면(허브 검색 결과, 공유한 링크, 같은 페이지의 ⌘K 결과) 그 검색어로 맞춘다.
  const syncFromUrl = useCallback((q: string) => {
    if (q === written.current) return;
    written.current = q;
    firstRun.current = true; // 새 이동이니 `#섹션` 안 첫 일치부터 다시 찾는다
    setValue(q);
    setQuery(q);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(value), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);

  // 검색어가 바뀌면 일치를 다시 구하고 첫 일치를 활성으로 둔다. 목차에서 일치가 없는 조항은 흐리게 한다.
  useEffect(() => {
    const root = document.getElementById(targetId);
    const ranges = root ? findMatchRanges(root, query) : [];
    rangesRef.current = ranges;
    setTotal(ranges.length);
    // 처음 들어올 때는 주소의 `#섹션` 안 첫 일치부터 — 허브 결과에서 누른 그 자리다.
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

    // 검색어를 주소에 남겨 링크로 나눌 수 있게 한다(같은 화면의 상태라 `replaceState`).
    const url = new URL(window.location.href);
    written.current = query;
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);

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

  // 칠하기와 스크롤.
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
      // 이미 편하게 보이는 자리면 움직이지 않는다 — 입력할 때마다 화면이 흔들리지 않게.
      if (rect.top < 96 || rect.bottom > window.innerHeight - 80) {
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        current.startContainer.parentElement?.scrollIntoView({
          block: "center",
          behavior: reduced ? "auto" : "smooth",
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
          total ? `일치하는 내용 ${total}개` : "일치하는 내용이 없어요."
        ),
      ANNOUNCE_MS
    );
    return () => window.clearTimeout(timer);
  }, [query, total]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const step = useCallback(
    (direction: 1 | -1) => setActive((now) => stepIndex(now, total, direction)),
    [total]
  );

  const clear = () => {
    setValue("");
    setQuery("");
    inputRef.current?.focus();
  };

  const searching = query.length > 0;

  return (
    <div role="search" className="flex flex-col gap-2">
      <Suspense fallback={null}>
        <UrlQuerySync onChange={syncFromUrl} />
      </Suspense>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--tv-muted)]"
        />
        <input
          ref={inputRef}
          type="search"
          value={value}
          aria-label="사용 가이드에서 찾기"
          placeholder="찾기"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            // 한글 조합 중의 Enter 는 글자를 확정할 뿐이다 — 이동으로 읽지 않는다.
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter") {
              event.preventDefault();
              step(event.shiftKey ? -1 : 1);
            } else if (event.key === "Escape") {
              event.preventDefault();
              if (value) clear();
              else inputRef.current?.blur();
            }
          }}
          className={cn(
            "h-10 w-full min-w-0 rounded-[10px] border border-[var(--tv-rule-strong)] bg-white pr-9 pl-9 text-[14px] text-[var(--tv-ink)] transition-colors duration-150 placeholder:text-[var(--tv-muted)] hover:border-[var(--tv-brand)] [&::-webkit-search-cancel-button]:hidden",
            FOCUS
          )}
        />
        {value ? (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={clear}
            className={cn(
              "absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-[8px] text-[var(--tv-muted)] transition-colors duration-150 hover:bg-[var(--tv-lav)] hover:text-[var(--tv-ink)]",
              FOCUS
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>

      {/* 이 줄은 늘 같은 높이다 — 일치 수가 나타나도 아래 목차가 밀리지 않는다. */}
      <div className="flex min-h-[44px] items-start justify-between gap-2 text-[13px] leading-[1.5] text-[var(--tv-muted)]">
        {!searching ? (
          <p className="m-0 flex items-center gap-1.5">
            <kbd className="grid h-5 min-w-5 place-items-center rounded-[6px] border border-[var(--tv-rule-strong)] bg-white px-1 font-sans text-[12px] font-bold text-[var(--tv-body)]">
              /
            </kbd>
            를 눌러 찾기
          </p>
        ) : total === 0 ? (
          <p className="m-0 break-keep">
            일치하는 내용이 없어요. 다른 낱말로 찾아보세요.
          </p>
        ) : (
          <>
            <p
              className="m-0 pt-1 font-bold tabular-nums text-[var(--tv-ink)]"
              aria-hidden
            >
              {active + 1} / {total}
            </p>
            <div className="flex gap-1">
              {(
                [
                  ["이전 일치", -1, ChevronUp],
                  ["다음 일치", 1, ChevronDown],
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
                    "size-8 text-[var(--tv-body)] hover:bg-white hover:text-[var(--tv-brand-deep)]",
                    FOCUS
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
