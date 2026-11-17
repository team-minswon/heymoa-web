import Link from "next/link";
import { useTranslations } from "next-intl";

import { trackHelp } from "@/lib/help/analytics";
import { goSamePage } from "@/lib/help/scroll";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import type { HelpHit } from "@/lib/help/search-index";
import { cn } from "@/lib/utils";

export const trackResultClick = (hit: HelpHit, rank: number, query: string) =>
  trackHelp("help_result_clicked", {
    slug: hit.path.split("/").pop() ?? "",
    rank,
    query_length: query.length,
  });

export const hitHref = (hit: HelpHit, query: string) =>
  `${hit.path}?q=${encodeURIComponent(query)}#${hit.sectionId}`;

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
  rank?: number;
  onNavigate?: () => void;
}) {
  const t = useTranslations("help.search");
  return (
    <Link
      id={id}
      href={hitHref(hit, query)}
      onClick={(event) => {
        if (rank) trackResultClick(hit, rank, query);
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
          {hit.axis === "situation" ? t("situation") : t("feature")}
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
