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
import { FOCUS, TV_VARS } from "@/components/heymoa/landing/tokens";
import { HelpHitRow, hitHref } from "@/components/help/help-hit-list";
import { searchHelp } from "@/lib/help/search-index";
import { goSamePage } from "@/lib/help/scroll";
import { useHelpIndex } from "@/lib/help/use-help-index";
import { cn } from "@/lib/utils";

const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * 가이드 전체 검색 팔레트. 머리 판의 「검색 ⌘K」 버튼이나 ⌘K / Ctrl+K 로 연다. 결과는 허브와 같은 줄(`HelpHitRow`)이고
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
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((now) => !now);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo(
    () => (entries && value.trim() ? searchHelp(entries, value) : []),
    [entries, value]
  );
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
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-bold text-[var(--tv-body)] help-fade hover:text-[var(--tv-brand-deep)] motion-reduce:transition-none",
          FOCUS
        )}
      >
        <Search aria-hidden className="size-4" />
        가이드 검색
        <kbd
          className="rounded-[6px] border border-[var(--tv-rule-strong)] px-1.5 font-sans text-[12px] text-[var(--tv-muted)]"
          aria-hidden
        >
          {hint}
        </kbd>
      </button>
      <Dialog
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
          showCloseButton={false}
          finalFocus={() => arrived.current ?? true}
          style={TV_VARS}
          className="top-[18vh] max-w-[640px] duration-200 translate-y-0 gap-0 rounded-[20px] bg-white p-0 text-[var(--tv-ink)] sm:max-w-[640px]"
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
