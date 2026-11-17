"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import type {
  HelpBadgeName,
  HelpCluster,
  HelpGroup,
} from "@/app/[lang]/help/_content/types";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { HelpBadge } from "@/components/help/help-badge";
import { useHelpAxis } from "@/components/help/help-axis";
import { localePath, splitLocale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

type SidebarTopic = {
  slug: string;
  group: string;
  title: string;
  badge?: HelpBadgeName;
};

const ITEM =
  "group/item flex min-h-8 items-center gap-2 rounded-[8px] px-3 py-1 text-[14px] leading-[1.45] help-fade";

export function HelpSidebar({
  groups,
  clusters,
  topics,
}: {
  groups: readonly HelpGroup[];
  clusters: readonly HelpCluster[];
  topics: readonly SidebarTopic[];
}) {
  const pathname = splitLocale(usePathname()).path;
  const axis = useHelpAxis(pathname);
  const locale = useLocale();
  const t = useTranslations("help");
  const box = useRef<HTMLDivElement>(null);
  const sections =
    axis === "feature"
      ? groups
          .filter((group) => group.axis === "feature")
          .map((group) => ({
            key: group.slug,
            title: group.title,
            href: `/help/${group.slug}`,
            topics: topics.filter((topic) => topic.group === group.slug),
          }))
      : clusters.map((cluster) => ({
          key: cluster.title,
          title: cluster.title,
          href: null,
          topics: cluster.pages.flatMap((slug) =>
            topics.filter((topic) => topic.slug === slug)
          ),
        }));
  const [pending, setPending] = useState<string | null>(null);
  const current = pending ?? pathname;

  useEffect(() => {
    setPending(null); // eslint-disable-line react-hooks/set-state-in-effect -- 주소가 바뀌면 낙관적 표시를 거둔다
  }, [pathname]);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(null), 4000);
    return () => window.clearTimeout(timer);
  }, [pending]);
  const onPick = (path: string) => (event: React.MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setPending(path);
  };

  useLayoutEffect(() => {
    const el = box.current;
    const current = el?.querySelector<HTMLElement>("[aria-current='page']");
    if (!el || !current) return;
    const top = current.offsetTop;
    const bottom = top + current.offsetHeight;
    if (top < el.scrollTop + 48 || bottom > el.scrollTop + el.clientHeight - 48)
      el.scrollTop = top - el.clientHeight / 3;
  }, [current, axis]);

  return (
    <div
      ref={box}
      className="sticky top-[var(--help-top)] hidden h-[calc(100dvh-var(--help-top))] w-[264px] shrink-0 self-start overflow-y-auto border-r border-[var(--tv-rule)] bg-white lg:block"
    >
      <nav aria-label={t("sidebar")} className="flex flex-col gap-5 px-3 py-5">
        {sections.map((section) => (
          <div key={section.key}>
            <p className="m-0 mb-1">
              {section.href ? (
                <Link
                  href={localePath(locale, section.href)}
                  aria-current={current === section.href ? "page" : undefined}
                  data-help-nav="sidebar"
                  onClick={onPick(section.href)}
                  className={cn(
                    ITEM,
                    "font-extrabold text-[var(--tv-ink)] hover:bg-[var(--tv-lav-soft)]",
                    FOCUS,
                    current === section.href && "bg-[var(--tv-lav)]"
                  )}
                >
                  {section.title}
                </Link>
              ) : (
                <span
                  className={cn(
                    ITEM,
                    "min-h-8 font-extrabold text-[var(--tv-ink)]"
                  )}
                >
                  {section.title}
                </span>
              )}
            </p>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {section.topics.map((topic) => {
                const path = `/help/${topic.group}/${topic.slug}`;
                const on = current === path;
                return (
                  <li key={topic.slug}>
                    <Link
                      href={localePath(locale, path)}
                      aria-current={on ? "page" : undefined}
                      data-help-nav="sidebar"
                      onClick={onPick(path)}
                      className={cn(
                        ITEM,
                        FOCUS,
                        on
                          ? "bg-[var(--tv-lav)] text-[var(--tv-ink)]"
                          : "text-[var(--tv-body)] hover:bg-[var(--tv-lav-soft)] hover:text-[var(--tv-ink)]"
                      )}
                    >
                      <span className="min-w-0">{topic.title}</span>
                      {topic.badge ? <HelpBadge name={topic.badge} /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
