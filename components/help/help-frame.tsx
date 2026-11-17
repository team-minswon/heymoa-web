import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { BODY, CARD_TITLE, FOCUS } from "@/components/heymoa/landing/tokens";
import { AnchorCopy } from "@/components/help/anchor-copy";
import { HelpBadge } from "@/components/help/help-badge";
import { HelpPageToc } from "@/components/help/help-page-toc";
import { HelpSearch } from "@/components/help/help-search";
import { helpPathOf, navTitleOf } from "@/app/[lang]/help/_content/paths";
import { helpTopicsFor } from "@/app/[lang]/help/_content/topics";
import type {
  HelpBadgeName,
  HelpGroup,
  HelpTopic,
} from "@/app/[lang]/help/_content/types";
import { helpT } from "@/lib/help/i18n";
import { localePath, type Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

export const HELP_PAD = "w-full px-6 pt-8 pb-16 lg:px-8 xl:px-10";

const HELP_READING = "mx-auto w-full max-w-[920px] min-w-0";

export function HelpPageHead({
  crumbs,
  badge,
  title,
  description,
  children,
}: {
  crumbs?: readonly { label: string; href: string }[];
  badge?: HelpBadgeName;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header>
      {crumbs && crumbs.length > 0 ? (
        <nav aria-label="breadcrumb" className="flex items-center gap-2">
          <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-[13px] text-[var(--tv-muted)]">
            {crumbs.map((crumb, i) => (
              <li key={crumb.href} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden>›</span> : null}
                <Link
                  href={crumb.href}
                  className={cn(
                    "rounded-[4px] underline-offset-4 hover:text-[var(--tv-ink)] hover:underline",
                    FOCUS
                  )}
                >
                  {crumb.label}
                </Link>
              </li>
            ))}
          </ol>
          {badge ? <HelpBadge name={badge} /> : null}
        </nav>
      ) : null}
      <h1 className="m-0 mt-2 text-[32px] leading-[1.2] font-extrabold tracking-[-0.035em] text-[var(--tv-ink)] lg:text-[36px]">
        {title}
      </h1>
      <p className="m-0 mt-3 max-w-[760px] text-[16px] leading-[1.7] text-[var(--tv-muted)]">
        {description}
      </p>
      {children}
    </header>
  );
}

export function HelpPageFrame({
  locale = "ko",
  topic,
  group,
  prev,
  next,
}: {
  locale?: Locale;
  topic: HelpTopic;
  group: HelpGroup;
  prev?: HelpTopic;
  next?: HelpTopic;
}) {
  const outline = topic.sections.map(({ id, title }) => ({ id, title }));
  const t = helpT(locale);
  return (
    <div
      className={cn(
        HELP_PAD,
        "grid items-start xl:grid-cols-[minmax(0,1fr)_240px] xl:gap-10"
      )}
    >
      <HelpSearch targetId="help-article" />
      <div data-help-main="" className={HELP_READING}>
        <HelpPageHead
          crumbs={[
            { label: t("guide"), href: localePath(locale, "/help") },
            { label: group.title, href: localePath(locale, `/help/${group.slug}`) },
          ]}
          badge={topic.badge}
          title={topic.title}
          description={topic.summary}
        />

        <details className="details-motion mt-6 rounded-[10px] border border-[var(--tv-rule)] xl:hidden">
          <summary
            className={cn(
              "flex min-h-10 cursor-pointer items-center rounded-[10px] px-4 text-[14px] font-extrabold text-[var(--tv-ink)]",
              FOCUS
            )}
          >
            {t("page.onThisPage")}
          </summary>
          <HelpPageToc sections={outline} hideLabel className="px-3 pb-3" />
        </details>

        <article
          id="help-article"
          className="mt-8 border-t border-[var(--tv-rule)] pt-8"
        >
          {topic.sections.map((section, index) => (
            <section
              id={section.id}
              key={section.id}
              className={cn(
                "scroll-mt-[calc(var(--help-top)+16px)]",
                index > 0 && "mt-10 lg:mt-12"
              )}
            >
              <div
                data-help-heading=""
                className="group/heading -mx-2 flex items-center gap-1 rounded-[8px] px-2"
              >
                <h2 className={CARD_TITLE}>{section.title}</h2>
                <AnchorCopy id={section.id} title={section.title} />
              </div>
              <div className="mt-3 flex flex-col gap-3 lg:mt-4">
                {section.body.map((paragraph, i) =>
                  typeof paragraph === "string" ? (
                    <p key={i} className={cn(BODY, "[overflow-wrap:anywhere]")}>
                      {paragraph}
                    </p>
                  ) : (
                    <div key={i} className={cn(BODY, "[overflow-wrap:anywhere]")}>
                      {paragraph}
                    </div>
                  )
                )}
              </div>
            </section>
          ))}
        </article>

        {group.axis === "feature" ? (
          <RelatedSituations topic={topic} locale={locale} />
        ) : null}

        <nav
          aria-label={t("page.prevNext")}
          className="mt-8 grid gap-3 sm:grid-cols-2"
        >
          {prev ? (
            <StepLink topic={prev} direction="prev" locale={locale} />
          ) : (
            <span />
          )}
          {next ? (
            <StepLink topic={next} direction="next" locale={locale} />
          ) : (
            <span />
          )}
        </nav>
      </div>

      <aside
        aria-label={t("page.tocArea")}
        className="sticky top-[calc(var(--help-top)+32px)] hidden max-h-[calc(100dvh-var(--help-top)-64px)] overflow-y-auto xl:block"
      >
        <HelpPageToc sections={outline} />
      </aside>
    </div>
  );
}

function StepLink({
  topic,
  direction,
  locale,
}: {
  topic: HelpTopic;
  direction: "prev" | "next";
  locale: Locale;
}) {
  const next = direction === "next";
  const t = helpT(locale);
  return (
    <Link
      href={localePath(locale, helpPathOf(topic))}
      data-help-nav="prev_next"
      className={cn(
        "group flex flex-col gap-1 rounded-[16px] border border-[var(--tv-rule)] px-5 py-4 help-lift hover:border-[var(--tv-rule-strong)] hover:bg-[var(--tv-lav-soft)]",
        next && "sm:items-end sm:text-right",
        FOCUS
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--tv-muted)]">
        {next ? null : <ArrowLeft aria-hidden className="size-3.5" />}
        {next ? t("page.next") : t("page.prev")}
        {next ? <ArrowRight aria-hidden className="size-3.5" /> : null}
      </span>
      <span className="text-[16px] font-extrabold text-[var(--tv-ink)] group-hover:text-[var(--tv-brand-deep)]">
        {navTitleOf(topic)}
      </span>
    </Link>
  );
}

function RelatedSituations({
  topic,
  locale,
}: {
  topic: HelpTopic;
  locale: Locale;
}) {
  const situations = helpTopicsFor(locale).filter((each) =>
    each.related?.includes(topic.slug)
  );
  if (situations.length === 0) return null;
  return (
    <section
      aria-labelledby="related-situations"
      className="mt-6 rounded-[16px] border border-[var(--tv-rule)] p-6"
    >
      <h2
        id="related-situations"
        className="m-0 text-[16px] font-extrabold text-[var(--tv-ink)]"
      >
        {helpT(locale)("page.relatedSituations")}
      </h2>
      <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
        {situations.map((situation) => (
          <li key={situation.slug}>
            <Link
              href={localePath(locale, helpPathOf(situation))}
              data-help-nav="related"
              className={cn(
                "flex min-h-9 items-center rounded-[8px] px-2 text-[15px] text-[var(--tv-body)] help-fade hover:bg-[var(--tv-lav-soft)] hover:text-[var(--tv-ink)]",
                FOCUS
              )}
            >
              {situation.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
