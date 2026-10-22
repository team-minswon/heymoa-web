import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { notFound } from "next/navigation";

import { LEGAL_FOCUS, LegalToc } from "@/app/[lang]/legal-toc";
import { CONTAINER } from "@/components/heymoa/landing/tokens";
import { WebPageJsonLd } from "@/components/help/json-ld";
import { messagesFor } from "@/i18n/messages";
import { marketingLocale } from "@/lib/i18n/current";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n/locales";
import { localizedMetadata } from "@/lib/i18n/metadata";
import {
  archivedDocument,
  archivedVersions,
  versionPeriods,
  type LegalBlock,
  type LegalDoc,
  type LegalProcessor,
  type LegalTable,
} from "@/lib/legal-archive";
import { LEGAL_CURRENT, PRIVACY_EFFECTIVE, TERMS_EFFECTIVE } from "@/lib/page-dates";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export type LegalSection = {
  /** 바깥에서 링크로 가리킬 조항만 준다(도움말의 `#recording` 등). 없으면 `section-N`. */
  id?: string;
  title: string;
  body: readonly LegalBlock[];
};

const anchorOf = (section: LegalSection, index: number) =>
  section.id ?? `section-${index + 1}`;

/** 언어 파일의 문서 문장 속 `{email}` 을 문의 주소로 채운다. 법률 문장이라 ICU 해석(`t()`)을 거치지 않고 글자 그대로 둔다. */
export const withContact = (text: string) =>
  text.replaceAll("{email}", siteConfig.contactEmail);

/** 날짜(`2026-10-18`)를 그 언어의 긴 날짜로. ko 「2026년 10월 18일」, en 「October 18, 2026」. */
export const longDate = (locale: Locale, iso: string) =>
  new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(iso));

/** 문서 안 링크. 색을 따로 두지 않고 밑줄로만 가른다 — 법률 문서에 브랜드 색이 끼면 광고처럼 읽혔다. */
export const LINK = cn(
  "rounded-[2px] font-medium text-foreground underline decoration-[var(--el-hairline-strong)] underline-offset-4 transition-colors hover:decoration-foreground",
  LEGAL_FOCUS
);

/** 본문 문단. 글줄 약 680px 에 16px · 1.8 — 정책 페이지들(Stripe·Notion)과 같은 읽기 폭이다. */
const PROSE = "m-0 text-[15.5px] leading-[1.8] text-[var(--el-body-strong)] [overflow-wrap:anywhere] lg:text-[16px]";

/** 처리방침 7조의 사업자 한 곳. 카드 대신 얇은 선 상자 — 표와 같은 무게로 읽힌다. */
function ProcessorCard({ vendor, role, rows }: LegalProcessor) {
  return (
    <section className="rounded-[6px] border border-border px-4 py-3 sm:px-5 print:break-inside-avoid">
      <h3 className="m-0 text-[14.5px] leading-[1.5] font-semibold text-foreground">
        {vendor}
        <span className="block text-[13px] font-normal text-muted-foreground sm:ml-2 sm:inline">{role}</span>
      </h3>
      <dl className="m-0 mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[13.5px] leading-[1.65] [overflow-wrap:anywhere] sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="m-0 mb-1.5 text-[var(--el-body-strong)] sm:mb-0">{withContact(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** 보관 기간·항목 같은 표. 좁은 화면에서는 표만 가로로 밀린다(페이지는 밀리지 않는다). */
function TableBlock({ columns, rows }: LegalTable) {
  return (
    <div className="overflow-x-auto border-y border-[var(--el-hairline-strong)] print:overflow-visible">
      <table className="w-full min-w-[520px] border-collapse text-left text-[13.5px] leading-[1.65] [overflow-wrap:anywhere]">
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-3 py-2 text-[12.5px] font-medium text-muted-foreground first:pl-0 last:pr-0"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-border align-top first:border-t-0">
              {row.map((cell, index) =>
                index === 0 ? (
                  <th
                    key={index}
                    scope="row"
                    className="min-w-[8em] py-2.5 pr-3 pl-0 font-medium text-foreground"
                  >
                    {cell}
                  </th>
                ) : (
                  <td key={index} className="px-3 py-2.5 text-[var(--el-body-strong)] last:pr-0">
                    {withContact(cell)}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return <p className={PROSE}>{withContact(block)}</p>;
  }
  // `<p>` 안에 표·`<dl>` 을 못 넣어 문단과 따로 그린다.
  return "vendor" in block ? <ProcessorCard {...block} /> : <TableBlock {...block} />;
}

/** 머리의 안내 한 줄(이전 판 · 번역본). 색 면 대신 왼쪽 선 — 경고가 아니라 참고다. */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 mt-5 border-l-2 border-[var(--el-hairline-strong)] py-0.5 pl-3.5 text-[14px] leading-[1.65] text-[var(--el-body-strong)]">
      {children}
    </p>
  );
}

type VersionPeriod = { version: string; from: string; to: string | null };

/**
 * 약관 · 개인정보의 공통 틀. 상단 바 · 푸터는 랜딩 것이다(`isLandingChromeRoute`).
 *
 * **차분한 문서로 짠다(APP-1385 디자인 개편).** 예전 라벤더 머리 판 · 연보라 목차 · 보라 링크는 「장난스럽다」는
 * 말을 들었다 — 이제 서비스 전체의 무채색 토큰(`--foreground` · `--border` · `--el-*`)만 쓰고 색 면 · 둥근 카드 ·
 * 아이콘 장식을 뺐다. 머리는 제목 · 설명 · 메타 줄(공고일 · 시행일 · 이전 버전)과 아래 선 하나다.
 *
 * lg 부터 왼쪽 220px 목차(sticky, 읽는 중인 조를 짚는다 — `LegalToc`)와 최대 720px 본문 두 칸이다. lg 미만은
 * 목차를 닫힌 `<details>` 로 둔다 — 펼친 목차가 390 첫 화면에서 본문을 다 밀어냈었다. 본문 문단의
 * `[overflow-wrap:anywhere]` 는 끊을 자리 없는 URL(개인정보 5조)이 320 에서 넘치지 않게 한다.
 *
 * 스크롤 리빌 · 장식은 두지 않는다 — 처음부터 끝까지 읽는 글이다. 조항마다 `scroll-mt-20` 은 sticky 상단 바(64px)가
 * 목차 → 조항 이동의 도착점을 가리지 않게 한다. 인쇄할 때는 목차를 빼고 본문만 한 단으로 낸다.
 */
export function LegalDocument({
  locale,
  path,
  title,
  description,
  announced,
  effective,
  sections,
  versions,
  archivePeriod,
}: {
  locale: Locale;
  /** 무접두 경로(`/terms`). 영어판 고지의 한국어본 링크와 이전 판 주소(`/terms/<판>`)가 쓴다. */
  path: string;
  title: string;
  description: string;
  /** 공고일·시행일(ISO 날짜, null 은 「미정」). 공고일을 주지 않으면(이전 판) 그 줄을 안 그린다. */
  announced?: string | null;
  effective: string | null;
  sections: readonly LegalSection[];
  /** 이전 판 목록(최근 판 먼저). 본문 아래에 고정 주소 링크로 선다. */
  versions: readonly VersionPeriod[];
  /** 이전 판 페이지일 때 그 판의 적용 기간 문구. 머리에 안내와 지금 판 링크가 선다. */
  archivePeriod?: string;
}) {
  const ui = messagesFor(locale).legal.ui;
  const dateOrPending = (iso: string | null) => (iso ? longDate(locale, iso) : ui.pendingDate);
  const tocLabel = ui.tocLabel.replace("{title}", title);
  const tocItems = sections.map((section, index) => ({
    id: anchorOf(section, index),
    title: section.title,
  }));

  return (
    <div className="w-full flex-1 bg-white pb-16 text-foreground lg:pb-24 dark:bg-background">
      <div
        className={cn(
          CONTAINER,
          "grid items-start gap-x-16 pt-8 lg:justify-center lg:grid-cols-[220px_minmax(0,720px)] lg:pt-16 print:block print:max-w-none print:px-0 print:pt-0"
        )}
      >
        {/* 머리는 본문 칸에 선다 — 목차 칸 위는 비우고 목차는 첫 조 높이에서 시작한다. */}
        <header className="border-b border-border pb-7 lg:col-start-2 lg:row-start-1 lg:pb-9">
          <p className="m-0 text-[13px] font-medium text-muted-foreground">{ui.label}</p>
          <h1 className="m-0 mt-2 text-[28px] leading-[1.25] font-semibold tracking-[-0.02em] text-foreground lg:text-[34px]">
            {title}
          </h1>
          <p className="m-0 mt-3 max-w-[640px] text-[15.5px] leading-[1.7] text-muted-foreground lg:text-[16px]">
            {description}
          </p>
          <p className="m-0 mt-5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[13.5px] leading-[1.6] text-muted-foreground">
            {announced !== undefined ? (
              <>
                <span>
                  {ui.announcedDate}{" "}
                  <span className="text-foreground tabular-nums">{dateOrPending(announced)}</span>
                </span>
                <span aria-hidden className="text-[var(--el-hairline-strong)]">
                  ·
                </span>
              </>
            ) : null}
            <span>
              {ui.effectiveDate}{" "}
              <span className="text-foreground tabular-nums">{dateOrPending(effective)}</span>
            </span>
            {versions.length ? (
              <>
                <span aria-hidden className="text-[var(--el-hairline-strong)] print:hidden">
                  ·
                </span>
                <a href="#versions" className={cn(LINK, "font-normal print:hidden")}>
                  {ui.versions}
                </a>
              </>
            ) : null}
          </p>
          {archivePeriod ? (
            <Notice>
              {ui.archiveNotice.replace("{period}", archivePeriod)}{" "}
              <a href={path} className={LINK}>
                {ui.currentVersion}
              </a>
            </Notice>
          ) : null}
          {/* 번역본의 법적 지위(PRO-66 결정): 참고용이고 한국어본이 우선한다. 한국어본 자신에는 두지 않는다. */}
          {locale !== DEFAULT_LOCALE ? (
            <Notice>
              {ui.translationNotice}{" "}
              <a href={path} hrefLang="ko" className={LINK}>
                {ui.koreanVersion}
              </a>
            </Notice>
          ) : null}
        </header>

        {/* 좁은 화면의 접는 목차와 넓은 화면의 sticky 목차가 같은 목록을 쓴다(한쪽은 늘 display:none). */}
        <details className="details-motion group border-b border-border lg:hidden print:hidden">
          <summary
            className={cn(
              "flex min-h-11 cursor-pointer list-none items-center gap-2 py-3 text-[14px] font-medium text-foreground [&::-webkit-details-marker]:hidden",
              LEGAL_FOCUS
            )}
          >
            {ui.toc}
            <ChevronDown
              aria-hidden
              className="ml-auto size-4 text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="pb-4">
            <LegalToc label={tocLabel} items={tocItems} />
          </div>
        </details>
        <aside className="hidden lg:sticky lg:top-24 lg:col-start-1 lg:row-start-2 lg:mt-10 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto print:hidden">
          <p className="m-0 mb-3 text-[12.5px] font-medium text-muted-foreground">{ui.toc}</p>
          <LegalToc label={tocLabel} items={tocItems} />
        </aside>

        <div className="min-w-0 lg:col-start-2 lg:row-start-2">
          <article>
            {sections.map((section, index) => (
              <section
                id={anchorOf(section, index)}
                key={section.title}
                className="mt-10 scroll-mt-20 first:mt-8 lg:mt-12 lg:first:mt-10"
              >
                <h2 className="m-0 text-[18px] leading-[1.4] font-semibold tracking-[-0.01em] text-foreground lg:text-[19px] print:break-after-avoid">
                  {section.title}
                </h2>
                <div className="mt-3 flex flex-col gap-3.5">
                  {section.body.map((block, blockIndex) => (
                    <Block key={blockIndex} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </article>
          {/* 이전 판은 한국어만 있다 — 영어판에서도 한국어 고정 주소로 연다. 조항(`article > section`)이 아니라 번호 밖이다. */}
          {versions.length ? (
            <nav
              id="versions"
              aria-label={ui.versions}
              className="mt-14 scroll-mt-20 border-t border-border pt-8 print:hidden"
            >
              <h2 className="m-0 text-[15px] leading-[1.4] font-semibold text-foreground">{ui.versions}</h2>
              <p className="m-0 mt-1.5 text-[14px] leading-[1.65] text-muted-foreground">{ui.versionsLead}</p>
              <ul className="m-0 mt-4 flex list-none flex-col p-0">
                {versions.map(({ version, from, to }) => (
                  <li
                    key={version}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-border py-2.5 text-[14px] leading-[1.6] first:border-t-0 first:pt-0"
                  >
                    <a href={`${path}/${version}`} hrefLang="ko" className={cn(LINK, "tabular-nums")}>
                      {longDate(locale, version)}
                    </a>
                    <span className="text-[13px] text-muted-foreground tabular-nums">{periodText(locale, from, to)}</span>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function periodText(locale: Locale, from: string, to: string | null) {
  const ui = messagesFor(locale).legal.ui;
  return to
    ? ui.versionPeriod.replace("{from}", longDate(locale, from)).replace("{to}", longDate(locale, to))
    : ui.versionPeriodOpen.replace("{from}", longDate(locale, from));
}

const PATH = { privacy: "/privacy", terms: "/terms" } as const satisfies Record<LegalDoc, string>;
const MODIFIED = { privacy: PRIVACY_EFFECTIVE, terms: TERMS_EFFECTIVE } as const;

const currentText = (doc: LegalDoc, locale: Locale) => {
  const messages = messagesFor(locale);
  const text = messages.legal[doc];
  return {
    ...text,
    metaDescription: text.metaDescription.replace("{brand}", messages.landing.meta.brandLabel),
  };
};

/** `/privacy`·`/terms` 의 head. */
export async function currentLegalMetadata(doc: LegalDoc): Promise<Metadata> {
  const locale = await marketingLocale();
  const text = currentText(doc, locale);
  return {
    title: text.title,
    description: text.metaDescription,
    ...localizedMetadata(locale, PATH[doc], { title: text.title, description: text.metaDescription }),
  };
}

/** `/privacy`·`/terms`: 지금 판 본문과 이전 판 목록. */
export async function CurrentLegalPage({ doc }: { doc: LegalDoc }) {
  const locale = await marketingLocale();
  const text = currentText(doc, locale);
  const dates = LEGAL_CURRENT[doc];
  return (
    <>
      <WebPageJsonLd
        name={text.title}
        description={text.metaDescription}
        path={localePath(locale, PATH[doc])}
        inLanguage={locale}
        dateModified={MODIFIED[doc]}
      />
      <LegalDocument
        locale={locale}
        path={PATH[doc]}
        title={text.title}
        description={text.description}
        announced={dates.announced}
        effective={dates.effective}
        sections={text.sections}
        versions={versionPeriods(doc, dates.effective)}
      />
    </>
  );
}

/**
 * 이전 판 고정 주소의 판 목록. 언어(root param)는 자식 `generateStaticParams` 에 넘어오지 않아 두 언어 모두 미리
 * 그리고, 영어 주소(`/en/privacy/<판>`)는 페이지가 404 로 돌린다(`ArchivedLegalPage`). 없는 판도 404 다.
 */
export const archivedParams = (doc: LegalDoc) =>
  archivedVersions(doc).map((version) => ({ version }));

const archivedPeriod = (doc: LegalDoc, version: string) => {
  const found = versionPeriods(doc, LEGAL_CURRENT[doc].effective).find((each) => each.version === version);
  if (!found) notFound();
  return periodText(DEFAULT_LOCALE, found.from, found.to);
};

/** 이전 판은 검색에 내지 않는다 — 같은 문서의 옛 문장이 지금 판과 겨루지 않게. */
export function archivedLegalMetadata(doc: LegalDoc, version: string): Metadata {
  const text = archivedDocument(doc, version);
  if (!text) notFound();
  const title = `${text.title} (${longDate(DEFAULT_LOCALE, version)})`;
  return { title, robots: { index: false, follow: true }, alternates: { canonical: `${PATH[doc]}/${version}` } };
}

export async function ArchivedLegalPage({ doc, version }: { doc: LegalDoc; version: string }) {
  const text = archivedDocument(doc, version);
  // 이전 판은 한국어 원문만 있다 — 영어 주소에 한국어를 내면 영어판에 한글이 섞인다.
  if (!text || (await marketingLocale()) !== DEFAULT_LOCALE) notFound();
  return (
    <LegalDocument
      locale={DEFAULT_LOCALE}
      path={PATH[doc]}
      title={text.title}
      description={text.description}
      effective={version}
      sections={text.sections}
      versions={versionPeriods(doc, LEGAL_CURRENT[doc].effective)}
      archivePeriod={archivedPeriod(doc, version)}
    />
  );
}
