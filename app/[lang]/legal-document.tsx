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

type LegalSection = {
  id?: string;
  title: string;
  body: readonly LegalBlock[];
};

const anchorOf = (section: LegalSection, index: number) =>
  section.id ?? `section-${index + 1}`;

const withContact = (text: string) =>
  text.replaceAll("{email}", siteConfig.contactEmail);

const longDate = (locale: Locale, iso: string) =>
  new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(iso));

export const LINK = cn(
  "rounded-[2px] font-medium text-foreground underline decoration-[var(--el-hairline-strong)] underline-offset-4 transition-colors hover:decoration-foreground",
  LEGAL_FOCUS
);

const PROSE = "m-0 text-[15.5px] leading-[1.8] text-[var(--el-body-strong)] [overflow-wrap:anywhere] lg:text-[16px]";

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

function TableBlock({ columns, rows }: LegalTable) {
  return (
    <div className="overflow-x-auto border-y border-[var(--el-hairline-strong)] print:overflow-visible">
      <table className="w-full min-w-[520px] border-collapse text-left text-[13.5px] leading-[1.65] [overflow-wrap:break-word]">
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
  // `<p>` 안에 표·`<dl>` 을 넣을 수 없어 문단과 따로 그립니다.
  return "vendor" in block ? <ProcessorCard {...block} /> : <TableBlock {...block} />;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 mt-5 border-l-2 border-[var(--el-hairline-strong)] py-0.5 pl-3.5 text-[14px] leading-[1.65] text-[var(--el-body-strong)]">
      {children}
    </p>
  );
}

type VersionPeriod = { version: string; from: string; to: string | null };

function LegalDocument({
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
  path: string;
  title: string;
  description: string;
  announced?: string | null;
  effective: string | null;
  sections: readonly LegalSection[];
  versions: readonly VersionPeriod[];
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
          {locale !== DEFAULT_LOCALE ? (
            <Notice>
              {ui.translationNotice}{" "}
              <a href={path} hrefLang="ko" className={LINK}>
                {ui.koreanVersion}
              </a>
            </Notice>
          ) : null}
        </header>

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

export async function currentLegalMetadata(doc: LegalDoc): Promise<Metadata> {
  const locale = await marketingLocale();
  const text = currentText(doc, locale);
  return {
    title: text.title,
    description: text.metaDescription,
    ...localizedMetadata(locale, PATH[doc], { title: text.title, description: text.metaDescription }),
  };
}

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

/** 언어(root param)는 자식 `generateStaticParams` 에 넘어오지 않아 두 언어 모두 미리 그리고, 영어 주소는 페이지가 404 로 돌립니다. */
export const archivedParams = (doc: LegalDoc) =>
  archivedVersions(doc).map((version) => ({ version }));

const archivedPeriod = (doc: LegalDoc, version: string) => {
  const found = versionPeriods(doc, LEGAL_CURRENT[doc].effective).find((each) => each.version === version);
  if (!found) notFound();
  return periodText(DEFAULT_LOCALE, found.from, found.to);
};

export function archivedLegalMetadata(doc: LegalDoc, version: string): Metadata {
  const text = archivedDocument(doc, version);
  if (!text) notFound();
  const title = `${text.title} (${longDate(DEFAULT_LOCALE, version)})`;
  return { title, robots: { index: false, follow: true }, alternates: { canonical: `${PATH[doc]}/${version}` } };
}

export async function ArchivedLegalPage({ doc, version }: { doc: LegalDoc; version: string }) {
  const text = archivedDocument(doc, version);
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
