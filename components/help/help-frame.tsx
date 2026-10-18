import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { BODY, CARD_TITLE, FOCUS } from "@/components/heymoa/landing/tokens";
import { AnchorCopy } from "@/components/help/anchor-copy";
import { HelpPageToc } from "@/components/help/help-page-toc";
import { HelpSearch } from "@/components/help/help-search";
import { helpTopics } from "@/app/(static)/help/_content/topics";
import type { HelpGroup, HelpTopic } from "@/app/(static)/help/_content/types";
import { cn } from "@/lib/utils";

/**
 * 사용 가이드 본문 칸의 바깥 여백. 가이드 셸(`app/(static)/help/layout.tsx`)이 상단바 · 사이드바를 세우고, 페이지는 이 여백 안에서
 * 화면 폭을 거의 다 쓴다(양옆 24~40, 초광폭 상한은 셸의 1800).
 */
export const HELP_PAD = "w-full px-6 pt-8 pb-16 lg:px-8 xl:px-10";

/** 읽기 폭 상한. 글줄이 너무 길어지지 않게 하되 영상 · 이미지 · 표는 이 칸을 꽉 쓴다. */
export const HELP_READING = "mx-auto w-full max-w-[920px] min-w-0";

/**
 * 페이지 머리말. 색 박스 없이 breadcrumb(작은 글씨) → h1 → 요약 두 줄 이내. 허브는 breadcrumb 이 없다.
 */
export function HelpPageHead({
  crumbs,
  title,
  description,
  children,
}: {
  crumbs?: readonly { label: string; href: string }[];
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header>
      {crumbs && crumbs.length > 0 ? (
        <nav aria-label="breadcrumb">
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
        </nav>
      ) : null}
      <h1 className="m-0 mt-2 text-[32px] leading-[1.2] font-extrabold tracking-[-0.035em] break-keep text-[var(--tv-ink)] lg:text-[36px]">
        {title}
      </h1>
      <p className="m-0 mt-3 max-w-[760px] text-[16px] leading-[1.7] break-keep text-[var(--tv-muted)]">
        {description}
      </p>
      {children}
    </header>
  );
}

/** 주제 한 페이지: 머리말 · 본문 · 이전/다음, 오른쪽에 이 페이지에서 목차(xl 이상. 그보다 좁으면 본문 위 접이식). */
export function HelpPageFrame({
  topic,
  group,
  prev,
  next,
}: {
  topic: HelpTopic;
  group: HelpGroup;
  prev?: HelpTopic;
  next?: HelpTopic;
}) {
  const outline = topic.sections.map(({ id, title }) => ({ id, title }));
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
            { label: "사용 가이드", href: "/help" },
            { label: group.title, href: `/help/${group.slug}` },
          ]}
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
            이 페이지에서
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

        {group.axis === "feature" ? <RelatedSituations topic={topic} /> : null}

        <nav
          aria-label="이전·다음 주제"
          className="mt-8 grid gap-3 sm:grid-cols-2"
        >
          {prev ? <StepLink topic={prev} direction="prev" /> : <span />}
          {next ? <StepLink topic={next} direction="next" /> : <span />}
        </nav>
      </div>

      <aside
        aria-label="이 페이지 목차 영역"
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
}: {
  topic: HelpTopic;
  direction: "prev" | "next";
}) {
  const next = direction === "next";
  return (
    <Link
      href={`/help/${topic.group}/${topic.slug}`}
      className={cn(
        "group flex flex-col gap-1 rounded-[16px] border border-[var(--tv-rule)] px-5 py-4 help-lift hover:border-[var(--tv-rule-strong)] hover:bg-[var(--tv-lav-soft)]",
        next && "sm:items-end sm:text-right",
        FOCUS
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--tv-muted)]">
        {next ? null : <ArrowLeft aria-hidden className="size-3.5" />}
        {next ? "다음 주제" : "이전 주제"}
        {next ? <ArrowRight aria-hidden className="size-3.5" /> : null}
      </span>
      <span className="break-keep text-[16px] font-extrabold text-[var(--tv-ink)] group-hover:text-[var(--tv-brand-deep)]">
        {topic.title}
      </span>
    </Link>
  );
}

/**
 * 기능 페이지 끝의 "이런 상황에서 보세요". 상황별 페이지가 이 페이지를 `related` 로 가리키면 자동으로 선다 — 글을 복제하지 않고
 * 링크만 둔다(탐색과 내부 링크망).
 */
function RelatedSituations({ topic }: { topic: HelpTopic }) {
  const situations = helpTopics.filter((t) => t.related?.includes(topic.slug));
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
        이런 상황에서 보세요
      </h2>
      <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
        {situations.map((situation) => (
          <li key={situation.slug}>
            <Link
              href={`/help/${situation.group}/${situation.slug}`}
              className={cn(
                "flex min-h-9 items-center rounded-[8px] px-2 text-[15px] break-keep text-[var(--tv-body)] help-fade hover:bg-[var(--tv-lav-soft)] hover:text-[var(--tv-ink)]",
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
