"use client";

/* eslint-disable react-hooks/set-state-in-effect -- 열 때마다 입력과 선택을 처음으로 되돌린다 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { HelpHitRow, hitHref, trackResultClick } from "@/components/help/help-hit-list";
import { searchHelp } from "@/lib/help/search-index";
import { goSamePage } from "@/lib/help/scroll";
import { track } from "@/lib/analytics/track";
import { useHelpIndex } from "@/lib/help/use-help-index";
import { HELP_OVERLAY, HELP_VARS } from "@/components/help/help-vars";
import { cn } from "@/lib/utils";

/** 입력이 멎었다고 보는 시간. */
const SETTLE_MS = 800;

const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * 가이드 전체 검색 팔레트. 상단바의 검색 버튼(⌘K 표시)이나 ⌘K / Ctrl+K 로 연다. 결과는 허브와 같은 줄(`HelpHitRow`)이고
 * ↑↓ 로 고르고 Enter 로 그 주제의 그 섹션으로 간다(도착한 페이지가 같은 검색어로 본문을 칠한다). 색인은 열 때 한 번 받는다.
 */
export function HelpPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState(0);
  const [hint, setHint] = useState("Ctrl K");
  const listRef = useRef<HTMLDivElement>(null);
  const { entries, failed } = useHelpIndex(open);

  useEffect(() => {
    setHint(isMac() ? "⌘K" : "Ctrl K");
  }, []);

  useEffect(() => {
    // ⌘K · Ctrl+K 는 입력칸에 포커스가 있어도 열고(브라우저의 Ctrl+K 동작은 막는다), 열려 있으면 닫는다.
    // `/` 는 입력 중이 아닐 때만 연다. 허브의 큰 검색칸이 있으면 그쪽이 `/` 를 받는다.
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((now) => {
          if (!now) track("help_search_opened", { surface: "palette", via: "keyboard" });
          return !now;
        });
      } else if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.defaultPrevented
      ) {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
        )
          return;
        if (document.querySelector("[data-help-hub-input]")) return;
        event.preventDefault();
        track("help_search_opened", { surface: "palette", via: "keyboard" });
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo(
    () => (entries && value.trim() ? searchHelp(entries, value) : []),
    [entries, value]
  );
  // 입력이 멎은 뒤 한 번 — 한 글자마다 세지 않는다. 검색어 원문은 보내지 않고 길이와 결과 수만 보낸다.
  useEffect(() => {
    const q = value.trim();
    if (!open || !entries || !q) return;
    const timer = window.setTimeout(
      () =>
        track("help_search_submitted", {
          query_length: q.length,
          result_count: hits.length,
          zero_results: hits.length === 0,
        }),
      SETTLE_MS
    );
    return () => window.clearTimeout(timer);
  }, [open, entries, value, hits.length]);
  const topics = useMemo(() => {
    const seen = new Map<string, string>();
    for (const entry of entries ?? []) seen.set(entry.path, entry.topicTitle);
    return [...seen];
  }, [entries]);

  // 같은 페이지의 결과면 라우터 없이 그 자리로 부드럽게 가고, 닫히며 포커스가 도착한 제목에 남게 한다.
  const arrived = useRef<HTMLElement | null>(null);
  const go = (href: string) => {
    setOpen(false);
    const same = goSamePage(href);
    arrived.current = same || null;
    if (same === false) router.push(href);
  };

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  const searching = value.trim().length > 0;
  const listId = "help-palette-list";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          track("help_search_opened", { surface: "palette", via: "click" });
          setOpen(true);
        }}
        aria-label={`검색어를 입력하세요 (예: 녹음, 용어 사전) ${hint} — 사용 가이드 검색`}
        aria-keyshortcuts="Control+K Meta+K"
        className={cn(
          "relative flex h-10 w-full min-w-0 items-center rounded-[10px] border border-[var(--tv-rule-strong)] bg-white pr-16 pl-10 text-left text-[14px] text-[var(--tv-muted)] help-fade hover:border-[var(--tv-ink)]",
          FOCUS
        )}
      >
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <span className="truncate">
          검색어를 입력하세요 (예: 녹음, 용어 사전)
        </span>
        <kbd
          className="pointer-events-none absolute top-1/2 right-3 grid h-6 min-w-6 -translate-y-1/2 place-items-center rounded-[6px] border border-[var(--tv-rule-strong)] bg-white px-1.5 font-sans text-[12px] font-bold"
          aria-hidden
        >
          {hint}
        </kbd>
      </button>
      <Dialog
        modal="trap-focus"
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            arrived.current = null;
            setValue("");
            setSelected(0);
          }
        }}
      >
        <DialogContent
          overlayClassName={HELP_OVERLAY}
          showCloseButton={false}
          finalFocus={() => arrived.current ?? true}
          style={HELP_VARS}
          className="top-[18vh] max-w-[640px] duration-(--help-base) motion-reduce:duration-0 translate-y-0 gap-0 rounded-[20px] bg-white p-0 text-[var(--tv-ink)] sm:max-w-[640px]"
        >
          <DialogTitle className="sr-only">사용 가이드 검색</DialogTitle>
          <DialogDescription className="sr-only">
            검색어를 입력하면 사용 가이드 전체에서 찾아요. 위아래 화살표 키로
            결과를 고르고 Enter를 누르면 이동해요.
          </DialogDescription>
          <div className="relative border-b border-[var(--tv-rule)]">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-[var(--tv-muted)]"
            />
            <input
              autoFocus
              type="search"
              role="combobox"
              aria-expanded={searching && hits.length > 0}
              aria-controls={listId}
              aria-activedescendant={
                hits.length ? `help-hit-${selected}` : undefined
              }
              aria-label="사용 가이드 전체에서 찾기"
              placeholder="검색어를 입력하세요"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setSelected(0);
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "ArrowDown" && hits.length) {
                  event.preventDefault();
                  setSelected((now) => (now + 1) % hits.length);
                } else if (event.key === "ArrowUp" && hits.length) {
                  event.preventDefault();
                  setSelected((now) => (now - 1 + hits.length) % hits.length);
                } else if (event.key === "Enter" && hits[selected]) {
                  event.preventDefault();
                  trackResultClick(hits[selected], selected + 1, value.trim());
                  go(hitHref(hits[selected], value.trim()));
                }
              }}
              className="h-14 w-full min-w-0 bg-transparent pr-5 pl-13 text-[16px] outline-none placeholder:text-[var(--tv-muted)] [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="검색 결과"
            className="max-h-[52vh] min-h-[160px] overflow-y-auto p-3"
          >
            {failed ? (
              <p className="m-0 p-3 text-[14px] text-[var(--tv-body)]">
                검색에 필요한 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해
                주세요.
              </p>
            ) : !entries ? (
              <p className="m-0 p-3 text-[14px] text-[var(--tv-muted)]">
                불러오는 중이에요…
              </p>
            ) : !searching ? (
              <div className="flex flex-col gap-1">
                <p className="m-0 px-3 pb-1 text-[13px] font-extrabold text-[var(--tv-muted)]">
                  주제
                </p>
                {topics.map(([path, title]) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => go(path)}
                    className={cn(
                      "rounded-[10px] px-3 py-2 text-left text-[15px] text-[var(--tv-body)] help-fade hover:bg-[var(--tv-lav-soft)] hover:text-[var(--tv-brand-deep)]",
                      FOCUS
                    )}
                  >
                    {title}
                  </button>
                ))}
              </div>
            ) : hits.length === 0 ? (
              <p className="m-0 p-3 text-[14px] leading-[1.7] break-keep text-[var(--tv-body)]">
                일치하는 내용이 없어요. 다른 낱말로 찾아보세요.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {hits.map((hit, index) => (
                  <HelpHitRow
                    key={`${hit.path}#${hit.sectionId}`}
                    id={`help-hit-${index}`}
                    hit={hit}
                    query={value.trim()}
                    rank={index + 1}
                    active={index === selected}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
