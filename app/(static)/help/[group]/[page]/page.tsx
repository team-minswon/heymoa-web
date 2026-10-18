import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  helpAxisOf,
  helpGroupBySlug,
  helpPathOf,
  helpTopicByPath,
} from "@/app/(static)/help/_content/paths";
import { helpTopics } from "@/app/(static)/help/_content/topics";
import { HelpPageFrame } from "@/components/help/help-frame";
import { JsonLd } from "@/components/help/json-ld";
import { HELP_MODIFIED, HELP_PUBLISHED } from "@/lib/help/dates";
import { textOf } from "@/lib/help/text";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = () =>
  helpTopics.map(({ group, slug }) => ({ group, page: slug }));

type Props = { params: Promise<{ group: string; page: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { group, page } = await params;
  const topic = helpTopicByPath(group, page);
  if (!topic) return {};
  const title = `${topic.title} · ${siteConfig.brandLabel} 사용법`;
  const url = helpPathOf(topic);
  return {
    title: { absolute: title },
    description: topic.summary,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description: topic.summary,
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: topic.summary,
    },
  };
}

/** 「질문 — 답」 꼴의 문단만 FAQ 로 낸다. 본문에 그대로 있는 글만 쓴다. */
function faqOf(sections: readonly { body: readonly React.ReactNode[] }[]) {
  const items = sections
    .flatMap((section) => section.body.map(textOf))
    .map((text) => text.split(" — "))
    .filter((parts) => parts.length === 2)
    .map(([name, text]) => ({
      "@type": "Question",
      name: name.replace(/[「」]/g, "").trim(),
      acceptedAnswer: { "@type": "Answer", text: text.trim() },
    }));
  return items.length > 0 ? items : null;
}

export default async function HelpTopicPage({ params }: Props) {
  const { group, page } = await params;
  const index = helpTopics.findIndex(
    (topic) => topic.group === group && topic.slug === page
  );
  if (index === -1) notFound();
  const topic = helpTopics[index];
  const groupInfo = helpGroupBySlug(group)!;
  const url = `${siteConfig.url}${helpPathOf(topic)}`;
  // FAQ 는 「질문 — 답」 문단이 있는 문제 해결 페이지만. 단계가 분명한 상황별 페이지는 HowTo 다 — 둘을 겹쳐 마크업하지 않는다.
  const faq = topic.howTo
    ? null
    : topic.slug === "troubleshooting"
      ? faqOf(topic.sections)
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
              name: "사용 가이드",
              item: `${siteConfig.url}/help`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: groupInfo.title,
              item: `${siteConfig.url}/help/${group}`,
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
          inLanguage: "ko",
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
            inLanguage: "ko",
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
        topic={topic}
        axis={helpAxisOf(topic)}
        prev={helpTopics[index - 1]}
        next={helpTopics[index + 1]}
      />
    </>
  );
}
