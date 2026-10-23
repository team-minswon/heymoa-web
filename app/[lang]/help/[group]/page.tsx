import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { helpGroups } from "@/app/[lang]/help/_content/groups";
import { helpT } from "@/lib/help/i18n";
import {
  helpGroupBySlug,
  helpPathOf,
  navTitleOf,
  helpTopicsOfGroup,
} from "@/app/[lang]/help/_content/paths";
import { HelpBadge } from "@/components/help/help-badge";
import { HELP_PAD, HelpPageHead } from "@/components/help/help-frame";
import { JsonLd } from "@/components/help/json-ld";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { marketingLocale } from "@/lib/i18n/current";
import { localePath } from "@/lib/i18n/locales";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = () =>
  helpGroups.map(({ slug }) => ({ group: slug }));

type Props = { params: Promise<{ group: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await marketingLocale();
  const group = helpGroupBySlug((await params).group, locale);
  if (!group) return {};
  const title = `${group.title} · ${helpT(locale)("brandTitle")}`;
  const description = group.summary;
  const share = localizedMetadata(locale, `/help/${group.slug}`);
  return {
    title: { absolute: title },
    description,
    ...share,
    openGraph: { ...share.openGraph, title, description },
    twitter: { ...share.twitter, title, description },
  };
}

/** 그룹 소개: 그 그룹의 페이지를 카드로 보여 준다. 기능 그룹과 "상황별로 찾기"가 같은 틀이다. */
export default async function HelpGroupPage({ params }: Props) {
  const locale = await marketingLocale();
  const t = helpT(locale);
  const href = (path: string) => localePath(locale, path);
  const group = helpGroupBySlug((await params).group, locale);
  if (!group) notFound();
  const topics = helpTopicsOfGroup(group.slug, locale);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: siteConfig.name,
              item: siteConfig.url,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: t("guide"),
              item: `${siteConfig.url}${href("/help")}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: group.title,
              item: `${siteConfig.url}${href(`/help/${group.slug}`)}`,
            },
          ],
        }}
      />
      <div data-help-main="" className={HELP_PAD}>
        <HelpPageHead
          crumbs={[{ label: t("guide"), href: href("/help") }]}
          title={group.title}
          description={group.summary}
        />
        <ul className="m-0 mt-8 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {topics.map((topic) => (
            <li key={topic.slug} data-reveal="">
              <Link
                href={href(helpPathOf(topic))}
                data-help-nav="hub_card"
                className={cn(
                  "flex h-full flex-col gap-1.5 rounded-[20px] border border-[var(--tv-rule)] bg-white p-6 help-lift hover:border-[var(--tv-brand)] hover:bg-[var(--tv-lav-soft)]",
                  FOCUS
                )}
              >
                <span className="text-[18px] leading-[1.35] font-extrabold text-[var(--tv-ink)]">
                  {navTitleOf(topic)}
                  {topic.badge ? (
                    <HelpBadge name={topic.badge} className="ml-2 align-middle" />
                  ) : null}
                </span>
                <span className="text-[14px] leading-[1.65] text-[var(--tv-body)]">
                  {topic.summary}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
