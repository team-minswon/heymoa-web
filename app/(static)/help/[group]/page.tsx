import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { helpGroups } from "@/app/(static)/help/_content/groups";
import {
  helpGroupBySlug,
  helpPathOf,
  helpTopicsOfGroup,
} from "@/app/(static)/help/_content/paths";
import {
  HELP_CONTAINER,
  HELP_ROOT,
  HELP_ROOT_PROPS,
  HelpHeader,
} from "@/components/help/help-frame";
import { HelpMotion } from "@/components/help/help-motion";
import { HelpPalette } from "@/components/help/help-palette";
import { JsonLd } from "@/components/help/json-ld";
import { FOCUS, TV_VARS } from "@/components/heymoa/landing/tokens";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = () =>
  helpGroups.map(({ slug }) => ({ group: slug }));

type Props = { params: Promise<{ group: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const group = helpGroupBySlug((await params).group);
  if (!group) return {};
  const title = `${group.title} · ${siteConfig.brandLabel} 사용법`;
  const url = `/help/${group.slug}`;
  return {
    title: { absolute: title },
    description: group.summary,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description: group.summary,
      locale: "ko_KR",
    },
    twitter: { card: "summary_large_image", title, description: group.summary },
  };
}

/** 그룹 소개: 그 그룹의 페이지를 카드로 보여 준다. 기능 그룹과 「상황별로 찾기」가 같은 틀이다. */
export default async function HelpGroupPage({ params }: Props) {
  const group = helpGroupBySlug((await params).group);
  if (!group) notFound();
  const topics = helpTopicsOfGroup(group.slug);
  return (
    <div style={TV_VARS} className={HELP_ROOT} {...HELP_ROOT_PROPS}>
      <HelpMotion />
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
              name: "사용 가이드",
              item: `${siteConfig.url}/help`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: group.title,
              item: `${siteConfig.url}/help/${group.slug}`,
            },
          ],
        }}
      />
      <HelpHeader
        label={
          <Link
            href="/help"
            className={cn(
              "rounded-[4px] underline-offset-4 hover:underline",
              FOCUS
            )}
          >
            ← 사용 가이드
          </Link>
        }
        title={group.title}
        description={group.summary}
      >
        <div className="mt-8 max-w-[640px]">
          <HelpPalette />
        </div>
      </HelpHeader>
      <div data-help-main="" className={cn(HELP_CONTAINER, "mt-8 lg:mt-12")}>
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
          {topics.map((topic) => (
            <li key={topic.slug} data-reveal="">
              <Link
                href={helpPathOf(topic)}
                className={cn(
                  "flex h-full flex-col gap-1.5 rounded-[20px] border border-[var(--tv-rule)] bg-white p-6 help-lift hover:border-[var(--tv-brand)] hover:bg-[var(--tv-lav-soft)]",
                  FOCUS
                )}
              >
                <span className="text-[18px] leading-[1.35] font-extrabold break-keep text-[var(--tv-ink)]">
                  {topic.title}
                </span>
                <span className="text-[14px] leading-[1.65] break-keep text-[var(--tv-body)]">
                  {topic.summary}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
