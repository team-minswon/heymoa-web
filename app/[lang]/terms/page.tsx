import type { Metadata } from "next";

import {
  LegalDocument,
  withContact,
} from "@/app/[lang]/legal-document";
import { WebPageJsonLd } from "@/components/help/json-ld";
import { messagesFor } from "@/i18n/messages";
import { marketingLocale } from "@/lib/i18n/current";
import { localePath, type Locale } from "@/lib/i18n/locales";
import { localizedMetadata } from "@/lib/i18n/metadata";

export const dynamic = "force-static";

// 시행일이 곧 최종 수정일이다. 조항을 고치면 같이 고친다.
const EFFECTIVE_ISO = "2026-10-18";

/**
 * 본문은 언어 파일 `legal.terms`(`messages/<ko|en>/legal.json`)에 있다. 한국어가 정본이고 영어는 참고용 번역이다
 * — 한국어 조항을 고치면 영어도 같은 커밋에서 고친다.
 *
 * 조 번호가 곧 앵커(`#section-N`)다. 조를 넣거나 빼면 뒤 번호가 밀리므로 새 조항은 맨 뒤에 붙인다(APP-1196).
 */
const documentFor = (locale: Locale) => {
  const messages = messagesFor(locale);
  const doc = messages.legal.terms;
  return {
    ...doc,
    metaDescription: doc.metaDescription.replace(
      "{brand}",
      messages.landing.meta.brandLabel
    ),
  };
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await marketingLocale();
  const doc = documentFor(locale);
  return {
    title: doc.title,
    description: doc.metaDescription,
    ...localizedMetadata(locale, "/terms"),
  };
}

export default async function TermsPage() {
  const locale = await marketingLocale();
  const doc = documentFor(locale);
  return (
    <>
      <WebPageJsonLd
        name={doc.title}
        description={doc.metaDescription}
        path={localePath(locale, "/terms")}
        inLanguage={locale}
        dateModified={EFFECTIVE_ISO}
      />
      <LegalDocument
        locale={locale}
        path="/terms"
        title={doc.title}
        description={doc.description}
        effectiveDate={EFFECTIVE_ISO}
        sections={doc.sections.map((section) => ({
          title: section.title,
          body: section.body.map(withContact),
        }))}
      />
    </>
  );
}
