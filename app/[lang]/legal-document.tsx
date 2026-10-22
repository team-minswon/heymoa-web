import type { Metadata } from "next";
import { ChevronDown, FileText } from "lucide-react";
import { notFound } from "next/navigation";

import {
  BODY,
  CARD_TITLE,
  CONTAINER,
  FOCUS,
  H2,
  LEAD,
  RADIUS,
  TV_VARS,
} from "@/components/heymoa/landing/tokens";
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

/** 문서 안 링크는 보라 진한 색이다(흰 면 8.8:1 · 연보라 면 7.9:1). */
export const LINK = cn(
  "rounded-[4px] font-bold text-[var(--tv-brand-deep)] underline underline-offset-4 transition-colors hover:text-[var(--tv-brand)]",
  FOCUS
);

/** 처리방침 7조의 사업자 한 곳. */
function ProcessorCard({ vendor, role, rows }: LegalProcessor) {
  return (
    <section className="rounded-[16px] border border-[var(--tv-rule)] px-4 py-3.5 sm:px-5">
      <h3 className="m-0 text-[15px] leading-[1.5] font-extrabold text-[var(--tv-ink)]">
        {vendor}
        <span className="block text-[13px] font-semibold text-[var(--tv-muted)] sm:ml-2 sm:inline">{role}</span>
      </h3>
      <dl className="m-0 mt-2 grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-[88px_minmax(0,1fr)] sm:gap-y-1.5 text-[14px] leading-[1.6] [overflow-wrap:anywhere]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-[var(--tv-muted)]">{label}</dt>
            <dd className="m-0 mb-1.5 text-[var(--tv-body)] sm:mb-0">{withContact(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** 보관 기간·항목 같은 표. 좁은 화면에서는 표만 가로로 밀린다(페이지는 밀리지 않는다). */
function TableBlock({ columns, rows }: LegalTable) {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-[var(--tv-rule)]">
      <table className="w-full min-w-[520px] border-collapse text-left text-[14px] leading-[1.6] [overflow-wrap:anywhere]">
        <thead className="bg-[var(--tv-lav-soft)]">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="px-4 py-2.5 font-extrabold text-[var(--tv-ink)]">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-[var(--tv-rule)] align-top">
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={index} scope="row" className="min-w-[8em] px-4 py-2.5 font-bold text-[var(--tv-ink)]">
                    {cell}
                  </th>
                ) : (
                  <td key={index} className="px-4 py-2.5 text-[var(--tv-body)]">
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
    return <p className={cn(BODY, "[overflow-wrap:anywhere]")}>{withContact(block)}</p>;
  }
  // `<p>` 안에 표·`<dl>` 을 못 넣어 문단과 따로 그린다.
  return "vendor" in block ? <ProcessorCard {...block} /> : <TableBlock {...block} />;
}

type VersionPeriod = { version: string; from: string; to: string | null };

/**
 * 약관 · 개인정보의 공통 틀. **랜딩과 같은 면이다** — 상단 바 · 푸터도 랜딩 것이다(`isLandingChromeRoute`).
 * 그래서 랜딩의 `--tv-*`(`TV_VARS`)를 루트에 걸고 흰 바탕 위 라벤더 머리 판, 흰 본문 판, 연보라 목차로 짠다.
 * 예전 크림 · `--lp-*` 판은 랜딩이 흰 바탕 · 보라로 바뀐 뒤 같은 사이트의 다른 페이지처럼 읽혔다.
 * 머리 판은 목차 · 본문과 같은 기둥(`CONTAINER`)에 선다 — 히어로 무대 폭(`STAGE_WRAP`)으로 두면 바로 아래 붙은
 * 목차 카드와 가장자리가 390 에서 8px, 1024~1279 에서 24px 어긋나 실수처럼 보였다.
 *
 * lg 미만에서는 목차를 닫힌 `<details>` 로 둔다 — 펼친 목차(9~10줄)가 본문보다 앞서 390 첫 화면에 본문이 한
 * 줄도 안 보였다. lg 부터는 본문 옆에 펼친 sticky 카드다. 본문 문단은 `[overflow-wrap:anywhere]` 를 같이 건다 — 끊을 자리
 * 없는 URL(개인정보 5조 `tools.google.com/…`)이 320 에서 판 밖으로 넘쳤다. 전역 `keep-all`(`globals.css` body)과 같이 써도
 * 한글 낱말은 그대로 두고 넘치는 토큰만 끊는다.
 *
 * **문서에는 스크롤 리빌 · 장식(쪽지 · 테이프 · 말풍선)을 안 둔다.** 랜딩은 훑어보는 자리지만 여기는 처음부터
 * 끝까지 읽는 글이다 — 읽는 동안 문단이 나타나거나 장식이 끼면 방해만 된다.
 *
 * 상단 바가 흐름 안의 sticky 64px 라 위 여백은 작다(옛 떠 있는 알약 때는 그 아래로 밀어야 해서 컸다). 대신 바가
 * 목차 → 조항 이동의 도착점을 가리지 않게 조항마다 `scroll-mt-20`(80px, 랜딩 구간과 같은 값)을 준다.
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
  // 좁은 화면의 접는 목차와 넓은 화면의 sticky 카드가 같은 목록을 쓴다(한쪽은 늘 display:none).
  const toc = (
    <nav aria-label={ui.tocLabel.replace("{title}", title)}>
      <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
        {sections.map((section, index) => (
          <li key={section.title}>
            <a
              href={`#${anchorOf(section, index)}`}
              className={cn(
                "flex min-h-6 items-center rounded-[8px] px-2 py-1.5 text-[14px] leading-[1.5] text-[var(--tv-body)] underline-offset-4 transition-colors hover:bg-white hover:text-[var(--tv-brand-deep)] hover:underline",
                FOCUS
              )}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );

  return (
    <div style={TV_VARS} className="w-full flex-1 bg-white pb-6 text-[var(--tv-ink)] lg:pb-8">
      <div className={cn(CONTAINER, "pt-3 lg:pt-6")}>
        <header className={cn(RADIUS.face, "bg-[var(--tv-lav)] px-6 py-10 lg:px-12 lg:py-16")}>
          <p className="m-0 inline-flex h-7 items-center rounded-full bg-white px-3 text-[13px] font-extrabold leading-none tracking-[0.02em] text-[var(--tv-brand-deep)]">
            {ui.label}
          </p>
          {/* 랜딩 섹션 제목(H2)과 같은 급이다. 히어로 급을 쓰면 문서 하나가 첫 화면처럼 군다. */}
          <h1 className={cn(H2, "mt-4 max-w-[820px]")}>{title}</h1>
          <p className={cn(LEAD, "mt-4 max-w-[640px]")}>{description}</p>
          <p className="m-0 mt-6 flex flex-wrap gap-x-5 gap-y-1 text-[14px] leading-[1.6] text-[var(--tv-muted)]">
            {announced !== undefined ? (
              <span>
                {ui.announcedDate}{" "}
                <b className="font-bold text-[var(--tv-ink)]">{dateOrPending(announced)}</b>
              </span>
            ) : null}
            <span>
              {ui.effectiveDate}{" "}
              <b className="font-bold text-[var(--tv-ink)]">{dateOrPending(effective)}</b>
            </span>
            {versions.length ? (
              <a href="#versions" className={LINK}>
                {ui.versions}
              </a>
            ) : null}
          </p>
          {archivePeriod ? (
            <p className="m-0 mt-4 max-w-[640px] rounded-[16px] bg-white px-4 py-3 text-[14px] leading-[1.6] text-[var(--tv-body)]">
              {ui.archiveNotice.replace("{period}", archivePeriod)}{" "}
              <a href={path} className={LINK}>
                {ui.currentVersion}
              </a>
            </p>
          ) : null}
          {/* 번역본의 법적 지위(PRO-66 결정): 참고용이고 한국어본이 우선한다. 한국어본 자신에는 두지 않는다. */}
          {locale !== DEFAULT_LOCALE ? (
            <p className="m-0 mt-4 max-w-[640px] rounded-[16px] bg-white px-4 py-3 text-[14px] leading-[1.6] text-[var(--tv-body)]">
              {ui.translationNotice}{" "}
              <a href={path} hrefLang="ko" className={LINK}>
                {ui.koreanVersion}
              </a>
            </p>
          ) : null}
        </header>
      </div>

      <div
        className={cn(
          CONTAINER,
          "mt-8 grid items-start gap-6 lg:mt-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10"
        )}
      >
        {/* 목차는 연보라 카드, 본문은 흰 판 — 「옮겨 다니는 곳」과 「읽는 곳」이 갈린다. */}
        <details className="details-motion group rounded-[20px] bg-[var(--tv-lav-soft)] lg:hidden">
          <summary
            className={cn(
              "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[20px] px-5 py-3 text-[14px] font-extrabold text-[var(--tv-ink)] [&::-webkit-details-marker]:hidden",
              FOCUS
            )}
          >
            <FileText aria-hidden className="size-4 text-[var(--tv-muted)]" />
            {ui.toc}
            <ChevronDown
              aria-hidden
              className="ml-auto size-4 text-[var(--tv-muted)] transition-transform duration-200 ease-out group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="px-5 pb-5">{toc}</div>
        </details>
        <aside className="box-border hidden rounded-[20px] bg-[var(--tv-lav-soft)] p-5 lg:sticky lg:top-24 lg:block">
          <p className="m-0 flex items-center gap-2 text-[13px] font-extrabold tracking-[0.02em] text-[var(--tv-muted)]">
            <FileText aria-hidden className="size-4" />
            {ui.toc}
          </p>
          <div className="mt-3">{toc}</div>
        </aside>

        {/* 줄 길이를 지키려고 본문 판은 760 까지만 넓힌다(lg 안쪽 글줄 약 660px). */}
        <div className="min-w-0 max-w-[760px]">
          <article className="box-border rounded-[24px] border border-[var(--tv-rule)] bg-white p-6 sm:p-9 lg:p-12">
            {sections.map((section, index) => (
              <section
                id={anchorOf(section, index)}
                key={section.title}
                className={cn(
                  "scroll-mt-20",
                  index > 0 &&
                    "mt-9 border-t border-[var(--tv-rule)] pt-9 lg:mt-10 lg:pt-10"
                )}
              >
                <h2 className={CARD_TITLE}>{section.title}</h2>
                <div className="mt-3 flex flex-col gap-3 lg:mt-4">
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
              className="mt-6 scroll-mt-20 rounded-[20px] bg-[var(--tv-lav-soft)] p-6 sm:p-8"
            >
              <h2 className={CARD_TITLE}>{ui.versions}</h2>
              <p className={cn(BODY, "mt-2")}>{ui.versionsLead}</p>
              <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
                {versions.map(({ version, from, to }) => (
                  <li key={version} className="flex flex-wrap items-baseline gap-x-3 text-[14px] leading-[1.6]">
                    <a href={`${path}/${version}`} hrefLang="ko" className={LINK}>
                      {longDate(locale, version)}
                    </a>
                    <span className="text-[var(--tv-muted)]">{periodText(locale, from, to)}</span>
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
