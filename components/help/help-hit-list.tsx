import Link from "next/link";

import { FOCUS } from "@/components/heymoa/landing/tokens";
import type { HelpHit } from "@/lib/help/search-index";
import { cn } from "@/lib/utils";

export const hitHref = (hit: HelpHit, query: string) =>
  `${hit.path}?q=${encodeURIComponent(query)}#${hit.sectionId}`;

/** 검색 결과 한 줄 — 「주제 · 섹션」 + 일치 문장 발췌(일치 부분 강조). 허브와 ⌘K 팔레트가 같이 쓴다. */
export function HelpHitRow({
  hit,
  query,
  active,
  id,
  onNavigate,
}: {
  hit: HelpHit;
  query: string;
  active?: boolean;
  id?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      id={id}
      href={hitHref(hit, query)}
      onClick={onNavigate}
      role={active === undefined ? undefined : "option"}
      aria-selected={active}
      tabIndex={active === undefined ? 0 : -1}
      className={cn(
        "block rounded-[14px] border border-[var(--tv-rule)] bg-white px-4 py-3 transition-colors duration-150 hover:border-[var(--tv-brand)] hover:bg-[var(--tv-lav-soft)]",
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
      <span className="mt-1 block text-[14px] leading-[1.65] break-keep text-[var(--tv-body)]">
        {hit.excerpt.slice(0, hit.from)}
        <mark className="rounded-[3px] bg-[var(--tv-butter)] px-0.5 font-bold text-[var(--tv-ink)] underline decoration-[var(--tv-brand)] underline-offset-2">
          {hit.excerpt.slice(hit.from, hit.to)}
        </mark>
        {hit.excerpt.slice(hit.to)}
      </span>
    </Link>
  );
}
