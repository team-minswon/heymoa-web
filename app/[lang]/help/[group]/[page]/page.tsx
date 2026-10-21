import type { Metadata } from "next";
import { marketingLocale } from "@/lib/i18n/current";
import { localePath } from "@/lib/i18n/locales";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { notFound } from "next/navigation";

import {
  helpGroupBySlug,
  helpPathOf,
  helpTopicByPath,
} from "@/app/[lang]/help/_content/paths";
import { helpTopics, helpTopicsFor } from "@/app/[lang]/help/_content/topics";
import { helpT } from "@/lib/help/i18n";
import { HelpPageFrame } from "@/components/help/help-frame";
import { JsonLd } from "@/components/help/json-ld";
import { HELP_MODIFIED, HELP_PUBLISHED } from "@/lib/help/dates";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = () =>
  helpTopics.map(({ group, slug }) => ({ group, page: slug }));

type Props = { params: Promise<{ group: string; page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { group, page } = await params;
  const locale = await marketingLocale();
  const topic = helpTopicByPath(group, page, locale);
  if (!topic) return {};
  const title = `${topic.title} · ${helpT(locale)("brandTitle")}`;
  const url = localePath(locale, helpPathOf(topic));
  return {
    title: { absolute: title },
    description: topic.summary,
    ...localizedMetadata(locale, helpPathOf(topic)),
    openGraph: {
      type: "article",
      url,
      title,
      description: topic.summary,
      locale: locale === "en" ? "en_US" : "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: topic.summary,
    },
  };
}

export default async function HelpTopicPage({ params }: Props) {
  const { group, page } = await params;
  const locale = await marketingLocale();
  const t = helpT(locale);
  const href = (path: string) => localePath(locale, path);
  const topics = helpTopicsFor(locale);
  const index = topics.findIndex(
    (topic) => topic.group === group && topic.slug === page
  );
  if (index === -1) notFound();
  const topic = topics[index];
  const groupInfo = helpGroupBySlug(group, locale)!;
  const url = `${siteConfig.url}${href(helpPathOf(topic))}`;
  // FAQ 는 마크다운의 "자주 묻는 질문"과 문제 해결 블록(증상 → 해결 방법)에서 온다. 단계가 분명한 상황별 페이지는 HowTo 다 — 둘을 겹쳐 마크업하지 않는다.
  const faq = topic.faq?.length
    ? topic.faq.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      }))
    : null;

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
              name: groupInfo.title,
              item: `${siteConfig.url}${href(`/help/${group}`)}`,
            },
            { "@type": "ListItem", position: 4, name: topic.title, item: url },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: topic.title,
          description: topic.summary,
          inLanguage: locale,
          datePublished: HELP_PUBLISHED,
          dateModified: HELP_MODIFIED,
          mainEntityOfPage: url,
          author: { "@type": "Organization", name: siteConfig.name },
          publisher: { "@type": "Organization", name: siteConfig.name },
        }}
      />
      {topic.howTo ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: topic.title,
            description: topic.summary,
            inLanguage: locale,
            step: topic.howTo.map((text, i) => ({
              "@type": "HowToStep",
              position: i + 1,
              text,
            })),
          }}
        />
      ) : null}
      {faq ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq,
          }}
        />
      ) : null}
      <HelpPageFrame
        locale={locale}
        topic={topic}
        group={groupInfo}
        prev={topics[index - 1]}
        next={topics[index + 1]}
      />
    </>
  );
}
