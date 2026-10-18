import type { Metadata } from "next";
import Link from "next/link";

import { LEGACY_HELP_ANCHORS } from "@/app/(static)/help/_content/legacy-anchors";
import { helpGroups } from "@/app/(static)/help/_content/groups";
import type { HelpPageId } from "@/app/(static)/help/_content/ids";
import {
  helpAxisOf,
  helpPathOf,
  helpTopicsOfGroup,
} from "@/app/(static)/help/_content/paths";
import { helpTopics } from "@/app/(static)/help/_content/topics";
import { HELP_PAD, HelpPageHead } from "@/components/help/help-frame";
import {
  HelpHubBody,
  HelpHubInput,
  HelpHubProvider,
} from "@/components/help/help-hub-search";
import { JsonLd } from "@/components/help/json-ld";
import { LegacyHashRedirect } from "@/components/help/legacy-hash-redirect";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-static";

const TITLE = `${siteConfig.brandLabel} 사용법`;
const DESCRIPTION = `헤이모아(${siteConfig.name})의 회의 기록, 화자 지정, 회의 맥락과 용어 사전, 요약 검토, 데스크톱 앱과 AI 앱 연결 방법을 주제별로 알려 줘요.`;

export const metadata: Metadata = {
  title: { absolute: `사용 가이드 · ${TITLE}` },
  description: DESCRIPTION,
  alternates: { canonical: "/help" },
  openGraph: {
    type: "website",
    url: "/help",
    title: `사용 가이드 · ${TITLE}`,
    description: DESCRIPTION,
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: `사용 가이드 · ${TITLE}`,
    description: DESCRIPTION,
  },
};

/** 허브 위쪽에 크게 세우는 페이지. 처음 오는 사람이 가장 먼저 찾는 것들이다. */
const FEATURED: readonly HelpPageId[] = [
  "getting-started",
  "terms-context",
  "review",
];

const card =
  "flex h-full flex-col gap-1.5 rounded-[20px] border border-[var(--tv-rule)] bg-white p-5 help-lift hover:border-[var(--tv-rule-strong)] hover:bg-[var(--tv-lav-soft)]";

const H2_SMALL =
  "m-0 mb-4 text-[14px] font-extrabold tracking-[0.02em] text-[var(--tv-muted)]";

/**
 * 사용 가이드 허브 (APP-1231). 머리 판 안의 큰 검색칸이 입구이고(전 페이지 검색), 그 아래 "자주 찾는 주제", 그리고 두 축 —
 * 기능별(그룹 카드와 그 안의 페이지)과 상황별("이럴 때" 레시피)이 나란히 선다. 옛 한 장짜리 시절의 `#해시` 링크는
 * `LegacyHashRedirect` 가 새 주소로 옮긴다.
 */
export default function HelpHubPage() {
  const featured = FEATURED.map(
    (id) => helpTopics.find((topic) => topic.slug === id)!
  );
  const featureGroups = helpGroups.filter((group) => group.axis === "feature");
  const situations = helpTopics.filter(
    (topic) => helpAxisOf(topic) === "situation"
  );
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
          ],
        }}
      />
      <LegacyHashRedirect map={LEGACY_HELP_ANCHORS} />
      <HelpHubProvider>
        <div data-help-main="" className={HELP_PAD}>
          <HelpPageHead
            title={TITLE}
            description="궁금한 낱말을 찾거나, 기능 또는 상황으로 골라 읽어 보세요."
          >
            <HelpHubInput />
          </HelpPageHead>
          <div className="mt-8">
            <HelpHubBody>
              <h2 className={H2_SMALL}>자주 찾는 주제</h2>
              <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
                {featured.map((topic) => (
                  <li key={topic.slug} data-reveal="">
                    <Link
                      href={helpPathOf(topic)}
                      className={cn(
                        card,
                        "bg-[var(--tv-lav-soft)] hover:bg-[var(--tv-lav)]",
                        FOCUS
                      )}
                    >
                      <span className="text-[20px] leading-[1.3] font-extrabold tracking-[-0.03em] break-keep text-[var(--tv-ink)]">
                        {topic.title}
                      </span>
                      <span className="text-[15px] leading-[1.65] break-keep text-[var(--tv-body)]">
                        {topic.summary}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <section aria-labelledby="by-feature" className="mt-10">
                <h2 id="by-feature" className={H2_SMALL}>
                  기능별로 찾기
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {featureGroups.map((group) => (
                    <div
                      key={group.slug}
                      data-reveal=""
                      className="help-lift rounded-[20px] border border-[var(--tv-rule)] bg-white p-5 hover:border-[var(--tv-rule-strong)]"
                    >
                      <h3 className="m-0 text-[18px] font-extrabold leading-[1.35] break-keep text-[var(--tv-ink)]">
                        <Link
                          href={`/help/${group.slug}`}
                          className={cn(
                            "rounded-[4px] hover:text-[var(--tv-brand-deep)]",
                            FOCUS
                          )}
                        >
                          {group.title}
                        </Link>
                      </h3>
                      <p className="m-0 mt-1 text-[14px] leading-[1.65] break-keep text-[var(--tv-muted)]">
                        {group.summary}
                      </p>
                      <ul className="m-0 mt-3 flex list-none flex-col gap-0.5 p-0">
                        {helpTopicsOfGroup(group.slug).map((topic) => (
                          <li key={topic.slug}>
                            <Link
                              href={helpPathOf(topic)}
                              className={cn(
                                "flex min-h-9 items-center rounded-[8px] px-2 text-[15px] break-keep text-[var(--tv-body)] help-fade hover:bg-[var(--tv-lav-soft)] hover:text-[var(--tv-brand-deep)]",
                                FOCUS
                              )}
                            >
                              {topic.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
              <section aria-labelledby="by-situation" className="mt-10">
                <h2 id="by-situation" className={H2_SMALL}>
                  상황별로 찾기
                </h2>
                <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {situations.map((topic) => (
                    <li key={topic.slug} data-reveal="">
                      <Link
                        href={helpPathOf(topic)}
                        className={cn(card, "gap-1 p-5", FOCUS)}
                      >
                        <span className="text-[16px] leading-[1.4] font-extrabold break-keep text-[var(--tv-ink)]">
                          {topic.title}
                        </span>
                        <span className="text-[14px] leading-[1.6] break-keep text-[var(--tv-body)]">
                          {topic.summary}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </HelpHubBody>
          </div>
        </div>
      </HelpHubProvider>
    </>
  );
}
