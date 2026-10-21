import type { Metadata } from "next";
import Link from "next/link";

import { legacyHelpAnchors } from "@/app/[lang]/help/_content/legacy-anchors";
import type { HelpPageId } from "@/app/[lang]/help/_content/ids";
import {
  helpAxisOf,
  helpPathOf,
  navTitleOf,
  helpTopicsOfGroup,
} from "@/app/[lang]/help/_content/paths";
import {
  helpGroupsFor,
  helpTopicsFor,
  situationClustersFor,
} from "@/app/[lang]/help/_content/topics";
import { HelpBadge } from "@/components/help/help-badge";
import { HELP_PAD, HelpPageHead } from "@/components/help/help-frame";
import {
  HelpHubBody,
  HelpHubInput,
  HelpHubProvider,
} from "@/components/help/help-hub-search";
import { JsonLd } from "@/components/help/json-ld";
import { LegacyHashRedirect } from "@/components/help/legacy-hash-redirect";
import { FOCUS } from "@/components/heymoa/landing/tokens";
import { marketingLocale } from "@/lib/i18n/current";
import { localePath } from "@/lib/i18n/locales";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { helpT } from "@/lib/help/i18n";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await marketingLocale();
  const t = helpT(locale);
  const title = `${t("guide")} · ${t("brandTitle")}`;
  const description = t("hub.description");
  return {
    title: { absolute: title },
    description,
    ...localizedMetadata(locale, "/help"),
    openGraph: {
      siteName: siteConfig.name,
      type: "website",
      url: localePath(locale, "/help"),
      title,
      description,
      locale: locale === "en" ? "en_US" : "ko_KR",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

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
export default async function HelpHubPage() {
  const locale = await marketingLocale();
  const t = helpT(locale);
  const topics = helpTopicsFor(locale);
  const href = (path: string) => localePath(locale, path);
  const featured = FEATURED.map(
    (id) => topics.find((topic) => topic.slug === id)!
  );
  const featureGroups = helpGroupsFor(locale).filter(
    (group) => group.axis === "feature"
  );
  const situations = topics.filter(
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
              name: t("guide"),
              item: `${siteConfig.url}${href("/help")}`,
            },
          ],
        }}
      />
      <LegacyHashRedirect map={legacyHelpAnchors(locale)} />
      <HelpHubProvider>
        <div data-help-main="" className={HELP_PAD}>
          <HelpPageHead title={t("brandTitle")} description={t("hub.lead")}>
            {t("hub.uiNote") ? (
              <p
                data-help-ui-note=""
                className="m-0 mt-3 max-w-[760px] rounded-[10px] bg-[var(--tv-lav-soft)] px-3 py-2 text-[14px] leading-[1.6] text-[var(--tv-body)]"
              >
                {t("hub.uiNote")}
              </p>
            ) : null}
            <HelpHubInput />
          </HelpPageHead>
          <div className="mt-8">
            <HelpHubBody>
              <h2 className={H2_SMALL}>{t("hub.featured")}</h2>
              <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
                {featured.map((topic) => (
                  <li key={topic.slug} data-reveal="">
                    <Link
                      href={href(helpPathOf(topic))}
                      data-help-nav="hub_card"
                      className={cn(
                        card,
                        "bg-[var(--tv-lav-soft)] hover:bg-[var(--tv-lav)]",
                        FOCUS
                      )}
                    >
                      <span className="text-[20px] leading-[1.3] font-extrabold tracking-[-0.03em] text-[var(--tv-ink)]">
                        {topic.title}
                      </span>
                      <span className="text-[15px] leading-[1.65] text-[var(--tv-body)]">
                        {topic.summary}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <section aria-labelledby="by-feature" className="mt-10">
                <h2 id="by-feature" className={H2_SMALL}>
                  {t("hub.byFeature")}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {featureGroups.map((group) => (
                    <div
                      key={group.slug}
                      data-reveal=""
                      className="help-lift rounded-[20px] border border-[var(--tv-rule)] bg-white p-5 hover:border-[var(--tv-rule-strong)]"
                    >
                      <h3 className="m-0 text-[18px] font-extrabold leading-[1.35] text-[var(--tv-ink)]">
                        <Link
                          href={href(`/help/${group.slug}`)}
                          data-help-nav="hub_card"
                          className={cn(
                            "rounded-[4px] hover:text-[var(--tv-brand-deep)]",
                            FOCUS
                          )}
                        >
                          {group.title}
                        </Link>
                      </h3>
                      <p className="m-0 mt-1 text-[14px] leading-[1.65] text-[var(--tv-muted)]">
                        {group.summary}
                      </p>
                      <ul className="m-0 mt-3 flex list-none flex-col gap-0.5 p-0">
                        {helpTopicsOfGroup(group.slug, locale).map((topic) => (
                          <li key={topic.slug}>
                            <Link
                              href={href(helpPathOf(topic))}
                      data-help-nav="hub_card"
                              className={cn(
                                "flex min-h-9 items-center gap-2 rounded-[8px] px-2 text-[15px] text-[var(--tv-body)] help-fade hover:bg-[var(--tv-lav-soft)] hover:text-[var(--tv-brand-deep)]",
                                FOCUS
                              )}
                            >
                              {navTitleOf(topic)}
                              {topic.badge ? <HelpBadge name={topic.badge} /> : null}
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
                  {t("hub.bySituation")}
                </h2>
                <div className="flex flex-col gap-6">
                  {situationClustersFor(locale).map((cluster) => (
                    <div key={cluster.title}>
                      <h3 className="m-0 mb-2 text-[15px] font-extrabold text-[var(--tv-ink)]">
                        {cluster.title}
                      </h3>
                      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {cluster.pages
                          .map((slug) => situations.find((t) => t.slug === slug)!)
                          .map((topic) => (
                            <li key={topic.slug} data-reveal="">
                              <Link
                                href={href(helpPathOf(topic))}
                      data-help-nav="hub_card"
                                className={cn(card, "gap-1 p-5", FOCUS)}
                              >
                                <span className="text-[16px] leading-[1.4] font-extrabold text-[var(--tv-ink)]">
                                  {navTitleOf(topic)}
                                  {topic.badge ? (
                                    <HelpBadge
                                      name={topic.badge}
                                      className="ml-2 align-middle"
                                    />
                                  ) : null}
                                </span>
                                <span className="text-[14px] leading-[1.6] text-[var(--tv-body)]">
                                  {topic.summary}
                                </span>
                              </Link>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            </HelpHubBody>
          </div>
        </div>
      </HelpHubProvider>
    </>
  );
}
