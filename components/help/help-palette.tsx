"use client";

/* eslint-disable react-hooks/set-state-in-effect -- 열 때마다 입력과 선택을 처음으로 되돌린다 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

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
import { trackHelp } from "@/lib/help/analytics";
import { useHelpIndex } from "@/lib/help/use-help-index";
import { HELP_OVERLAY, HELP_VARS } from "@/components/help/help-vars";
import { cn } from "@/lib/utils";

const SETTLE_MS = 800;

const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

export function HelpPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState(0);
  const [hint, setHint] = useState("Ctrl K");
  const listRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("help.search");
  const { entries, failed } = useHelpIndex(open, useLocale());

  useEffect(() => {
    setHint(isMac() ? "⌘K" : "Ctrl K");
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((now) => {
          if (!now) trackHelp("help_search_opened", { surface: "palette", via: "keyboard" });
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
        trackHelp("help_search_opened", { surface: "palette", via: "keyboard" });
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
  useEffect(() => {
    const q = value.trim();
    if (!open || !entries || !q) return;
    const timer = window.setTimeout(
      () =>
        trackHelp("help_search_submitted", {
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
          trackHelp("help_search_opened", { surface: "palette", via: "click" });
          setOpen(true);
        }}
        aria-label={t("opener", { hint })}
        aria-keyshortcuts="Control+K Meta+K"
        className={cn(
          "relative flex size-10 items-center rounded-[10px] border border-[var(--tv-rule-strong)] bg-white text-left text-[14px] text-[var(--tv-muted)] help-fade hover:border-[var(--tv-ink)] sm:w-full sm:min-w-0 sm:pr-16 sm:pl-10",
          FOCUS
        )}
      >
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <span className="hidden truncate sm:block">{t("placeholderExample")}</span>
        <kbd
          className="pointer-events-none absolute top-1/2 right-3 hidden h-6 min-w-6 -translate-y-1/2 place-items-center rounded-[6px] border border-[var(--tv-rule-strong)] bg-white px-1.5 font-sans text-[12px] font-bold sm:grid"
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
          <DialogTitle className="sr-only">{t("dialogTitle")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("dialogHelp")}
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
              aria-label={t("label")}
              placeholder={t("placeholder")}
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
            aria-label={t("results")}
            className="h-[52vh] overflow-y-auto p-3"
          >
            {failed ? (
              <p className="m-0 p-3 text-[14px] text-[var(--tv-body)]">
                {t("failed")}
              </p>
            ) : !entries ? (
              <p className="m-0 p-3 text-[14px] text-[var(--tv-muted)]">
                {t("loading")}
              </p>
            ) : !searching ? (
              <div className="flex flex-col gap-1">
                <p className="m-0 px-3 pb-1 text-[13px] font-extrabold text-[var(--tv-muted)]">
                  {t("topics")}
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
              <p className="m-0 p-3 text-[14px] leading-[1.7] text-[var(--tv-body)]">
                {t("noMatch")}
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
