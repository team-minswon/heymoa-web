import Link from "next/link";

import { track } from "@/lib/analytics/track";
import { goSamePage } from "@/lib/help/scroll";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import type { HelpHit } from "@/lib/help/search-index";
import { cn } from "@/lib/utils";

/** 결과를 눌렀다 — 주제 slug · 순위 · 검색어 길이만 보낸다(검색어 원문은 보내지 않는다). */
export const trackResultClick = (hit: HelpHit, rank: number, query: string) =>
  track("help_result_clicked", {
    slug: hit.path.split("/").pop() ?? "",
    rank,
    query_length: query.length,
  });

export const hitHref = (hit: HelpHit, query: string) =>
  `${hit.path}?q=${encodeURIComponent(query)}#${hit.sectionId}`;

/** 검색 결과 한 줄 — "주제 · 섹션" + 일치 문장 발췌(일치 부분 강조). 허브와 ⌘K 팔레트가 같이 쓴다. */
export function HelpHitRow({
  hit,
  query,
  active,
  id,
  rank,
  onNavigate,
}: {
  hit: HelpHit;
  query: string;
  active?: boolean;
  id?: string;
  /** 결과 목록에서의 순위(1부터). 눌렀을 때 이벤트에 싣는다. */
  rank?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      id={id}
      href={hitHref(hit, query)}
      onClick={(event) => {
        if (rank) trackResultClick(hit, rank, query);
        // 같은 페이지의 결과는 라우터 없이 부드럽게 그 자리로 간다(다른 페이지는 링크가 이동한다).
        const plain =
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey;
        if (plain && goSamePage(hitHref(hit, query)) !== false)
          event.preventDefault();
        onNavigate?.();
      }}
      role={active === undefined ? undefined : "option"}
      aria-selected={active}
      tabIndex={active === undefined ? 0 : -1}
      className={cn(
        "block rounded-[14px] border border-[var(--tv-rule)] bg-white px-4 py-3 help-fade hover:border-[var(--tv-brand)] hover:bg-[var(--tv-lav-soft)]",
        active && "border-[var(--tv-brand)] bg-[var(--tv-lav-soft)]",
        FOCUS
      )}
    >
      <span className="flex items-center gap-2 text-[13px] font-extrabold text-[var(--tv-brand-deep)]">
        <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-[var(--tv-lav)] px-2 text-[11px] font-extrabold text-[var(--tv-ink)]">
          {hit.axis === "situation" ? "상황" : "기능"}
        </span>
        <span className="min-w-0">
          {hit.topicTitle} · {hit.sectionTitle}
        </span>
      </span>
      <span className="mt-1 block text-[14px] leading-[1.65] text-[var(--tv-body)]">
        {hit.excerpt.slice(0, hit.from)}
        <mark className="rounded-[3px] bg-[var(--tv-butter)] px-0.5 font-bold text-[var(--tv-ink)] underline decoration-[var(--tv-brand)] underline-offset-2">
          {hit.excerpt.slice(hit.from, hit.to)}
        </mark>
        {hit.excerpt.slice(hit.to)}
      </span>
    </Link>
  );
}
