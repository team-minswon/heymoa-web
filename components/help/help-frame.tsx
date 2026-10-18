import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import {
  BODY,
  CARD_TITLE,
  FOCUS,
  H2,
  LEAD,
  RADIUS,
  TV_VARS,
} from "@/components/heymoa/landing/tokens";
import { AnchorCopy } from "@/components/help/anchor-copy";
import { HelpMotion } from "@/components/help/help-motion";
import { HelpPalette } from "@/components/help/help-palette";
import { HelpPageToc } from "@/components/help/help-page-toc";
import { HelpSearch } from "@/components/help/help-search";
import { HelpTopicList } from "@/components/help/help-topic-list";
import { helpGroups } from "@/app/(static)/help/_content/groups";
import { helpTopics } from "@/app/(static)/help/_content/topics";
import type { HelpAxis, HelpTopic } from "@/app/(static)/help/_content/types";
import { cn } from "@/lib/utils";

/**
 * 사용 가이드 전용 기둥. 약관 · 개인정보의 공통 틀(`CONTAINER` 1120)보다 넓다 — 문서 사이트처럼 왼쪽 주제 목록 · 가운데
 * 본문 · 오른쪽 「이 페이지」 목차 셋이 서야 해서다. 1440 에서 좌우 40 을 빼고 남는 1280 을 쓴다(240 + 본문 756 + 220 + 간격).
 * 머리 판도 같은 기둥에 서서 본문과 가장자리가 맞는다.
 */
export const HELP_CONTAINER = "mx-auto w-full max-w-[1360px] px-5 lg:px-10";

export const HELP_ROOT =
  "w-full flex-1 bg-white pb-6 text-[var(--tv-ink)] lg:pb-8";

/** 가이드 루트에 붙는 표식. 모션 배선(`HelpMotion`)이 이 안의 요소만 만진다. */
export const HELP_ROOT_PROPS = { "data-help-root": "" } as const;

export function HelpHeader({
  label,
  action,
  title,
  description,
  children,
}: {
  label: React.ReactNode;
  /** 라벨 줄 오른쪽(가이드 검색 버튼). */
  action?: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(HELP_CONTAINER, "pt-3 lg:pt-6")}>
      <header
        className={cn(
          RADIUS.face,
          "bg-[var(--tv-lav)] px-6 py-10 lg:px-12 lg:py-14"
        )}
      >
        <div className="flex min-h-10 items-center justify-between gap-3">
          <p className="m-0 inline-flex h-7 items-center rounded-full bg-white px-3 text-[13px] font-extrabold leading-none tracking-[0.02em] text-[var(--tv-brand-deep)]">
            {label}
          </p>
          {action}
        </div>
        <h1 className={cn(H2, "mt-4 max-w-[820px]")}>{title}</h1>
        <p className={cn(LEAD, "mt-4 max-w-[640px]")}>{description}</p>
        {children}
      </header>
    </div>
  );
}

/** 주제 한 페이지: 머리 판 · 왼쪽 주제 목록 · 본문 · 오른쪽 목차 · 이전/다음. */
export function HelpPageFrame({
  topic,
  axis,
  prev,
  next,
}: {
  topic: HelpTopic;
  axis: HelpAxis;
  prev?: HelpTopic;
  next?: HelpTopic;
}) {
  const outline = topic.sections.map(({ id, title }) => ({ id, title }));
  return (
    <div style={TV_VARS} className={HELP_ROOT} {...HELP_ROOT_PROPS}>
      <HelpMotion />
      <HelpHeader
        label={
          <Link
            href="/help"
            className={cn(
              "rounded-[4px] hover:underline underline-offset-4",
              FOCUS
            )}
          >
            ← 사용 가이드
          </Link>
        }
        action={<HelpPalette />}
        title={topic.title}
        description={topic.summary}
      />

      <div
        className={cn(
          HELP_CONTAINER,
          "mt-8 grid items-start gap-6 lg:mt-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[240px_minmax(0,1fr)_220px]"
        )}
      >
        <aside className="box-border rounded-[20px] bg-[var(--tv-lav-soft)] p-5 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
          <HelpSearch targetId="help-article" />
          <div className="mt-5">
            <HelpTopicList
              groups={helpGroups}
              topics={helpTopics}
              current={topic.slug}
              axis={axis}
            />
          </div>
        </aside>

        <div data-help-main="" className="min-w-0 max-w-[800px]">
          <HelpPageToc
            sections={outline}
            className="mb-4 rounded-[20px] bg-[var(--tv-lav-soft)] p-4 xl:hidden"
          />
          <article
            id="help-article"
            className="box-border rounded-[24px] border border-[var(--tv-rule)] bg-white p-6 sm:p-9 lg:p-12"
          >
            {topic.sections.map((section, index) => (
              <section
                id={section.id}
                key={section.id}
                className={cn("scroll-mt-24", index > 0 && "mt-10 lg:mt-12")}
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
                      <p
                        key={i}
                        className={cn(BODY, "[overflow-wrap:anywhere]")}
                      >
                        {paragraph}
                      </p>
                    ) : (
                      <div
                        key={i}
                        className={cn(BODY, "[overflow-wrap:anywhere]")}
                      >
                        {paragraph}
                      </div>
                    )
                  )}
                </div>
              </section>
            ))}
          </article>

          {axis === "feature" ? <RelatedSituations topic={topic} /> : null}

          <nav
            aria-label="이전·다음 주제"
            className="mt-6 grid gap-3 sm:grid-cols-2"
          >
            {prev ? <StepLink topic={prev} direction="prev" /> : <span />}
            {next ? <StepLink topic={next} direction="next" /> : <span />}
          </nav>
        </div>

        <aside className="sticky top-24 hidden xl:block">
          <HelpPageToc sections={outline} />
        </aside>
      </div>
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
        "group flex flex-col gap-1 rounded-[16px] border border-[var(--tv-rule)] px-5 py-4 help-lift hover:border-[var(--tv-brand)] hover:bg-[var(--tv-lav-soft)]",
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
 * 기능 페이지 끝의 「이런 상황에서 보세요」. 상황별 페이지가 이 페이지를 `related` 로 가리키면 자동으로 선다 — 글을 복제하지 않고
 * 링크만 둔다(탐색과 내부 링크망).
 */
function RelatedSituations({ topic }: { topic: HelpTopic }) {
  const situations = helpTopics.filter((t) => t.related?.includes(topic.slug));
  if (situations.length === 0) return null;
  return (
    <section
      aria-labelledby="related-situations"
      className="mt-6 rounded-[20px] bg-[var(--tv-lav-soft)] p-6"
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
                "flex min-h-9 items-center rounded-[8px] px-2 text-[15px] break-keep text-[var(--tv-body)] help-fade hover:bg-white hover:text-[var(--tv-brand-deep)]",
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
