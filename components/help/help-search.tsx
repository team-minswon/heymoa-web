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

/** 스크린리더 안내는 일치 수가 정해진 뒤 한 번만 읽는다. */
const ANNOUNCE_MS = 600;
/** 상단바(97) 아래로 이 높이 안에 든 일치는 가려진 것으로 본다. */
const TOP_SAFE = 120;

/** 주소 해시를 안전하게 읽는다. 깨진 인코딩(`#%`)은 빈 값으로 본다. */
const readHash = () => {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "";
  }
};

/**
 * 같은 페이지 안에서 `?q=` 가 바뀌는 이동(검색 팔레트 결과, 링크)을 알린다. 화면에는 아무것도 그리지 않아서, 정적 렌더가
 * 요구하는 Suspense 경계로 감싸도 자리가 밀리지 않는다.
 */
function UrlQuerySync({ onChange }: { onChange: (q: string) => void }) {
  const q = useSearchParams().get("q") ?? "";
  useEffect(() => onChange(q), [q, onChange]);
  return null;
}

/**
 * 본문 안 일치 이동 막대 (APP-1232 → APP-1245). 검색은 상단바 팔레트가 하고, 이 컴포넌트는 주소의 `?q=` 로 들어온
 * 페이지에서 본문의 일치를 칠하고 이전/다음으로 오가게 한다. 막대는 `?q=` 가 있을 때만 화면 아래에 **떠 있어서**(fixed)
 * 나타나도 본문이 밀리지 않는다. 본문 DOM 은 건드리지 않고 일치 구간을 CSS Custom Highlight API 로만 칠하므로 서버 HTML 과
 * 첫 클라이언트 렌더가 같다. 이 API 가 없는 브라우저에서는 칠하지 않고 개수와 이동(스크롤)만 된다. 칠하는 규칙은
 * `app/globals.css` 의 `::highlight(help-search*)`.
 */
export function HelpSearch({ targetId }: { targetId: string }) {
  const t = useTranslations("help.search");
  const rangesRef = useRef<Range[]>([]);
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(0);
  const [announce, setAnnounce] = useState("");
  const firstRun = useRef(true);
  // 주소로 처음 들어온 직후의 이동은 모션 없이 바로 간다(공유한 링크가 로드 뒤에 흘러가지 않게). 이후 이동은 부드럽게.
  const loaded = useRef(false);
  const jump = useRef(false);

  const syncFromUrl = useCallback((q: string) => {
    jump.current = !loaded.current && q !== "";
    loaded.current = true;
    firstRun.current = true; // 새 이동이니 `#섹션` 안 첫 일치부터 다시 찾는다
    setQuery(q);
  }, []);

  // 검색어가 바뀌면 일치를 다시 구하고 첫 일치를 활성으로 둔다. 목차에서 일치가 없는 조항은 흐리게 한다.
  useEffect(() => {
    const root = document.getElementById(targetId);
    const ranges = root ? findMatchRanges(root, query) : [];
    rangesRef.current = ranges;
    setTotal(ranges.length);
    // 처음 들어올 때는 주소의 `#섹션` 안 첫 일치부터 — 검색 결과에서 누른 그 자리다.
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
      // 이미 편하게 보이는 자리면 움직이지 않는다.
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
