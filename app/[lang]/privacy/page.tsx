import type { Metadata } from "next";
import type { ReactNode } from "react";

import {
  LegalDocument,
  withContact,
} from "@/app/[lang]/legal-document";
import { WebPageJsonLd } from "@/components/help/json-ld";
import { messagesFor } from "@/i18n/messages";
import { marketingLocale } from "@/lib/i18n/current";
import { localePath, type Locale } from "@/lib/i18n/locales";
import { localizedMetadata } from "@/lib/i18n/metadata";
import { PRIVACY_EFFECTIVE } from "@/lib/page-dates";

export const dynamic = "force-static";

/**
 * 본문은 언어 파일 `legal.privacy`(`messages/<ko|en>/legal.json`)에 있다. 한국어가 정본이고 영어는 참고용 번역이다
 * — 한국어 조항을 고치면 영어도 같은 커밋에서 고친다. JSON 에는 주석을 못 달아 문단별 주의를 여기 둔다.
 *
 * - 조 번호가 곧 앵커(`#section-N`)다. 계정 설정이 `/privacy#section-5`(쿠키와 접속 분석)를 가리키므로 조를 넣거나
 *   빼지 않는다. 새 조항은 맨 뒤에 붙인다(APP-1196).
 * - 5조 둘째 문단(브라우저에 저장하는 값): 키 목록의 원본은 `lib/storage/user-flags.ts` 머리 주석이다. 새 키를
 *   만들면 이 문단도 고친다.
 * - 5조 「이용 통계 보내기」 문단: 거부 방법은 `components/settings/account-settings-form.tsx` 의 그 스위치다.
 *   이 스위치는 Vercel Analytics·Speed Insights 를 끄지 않는다(`site-analytics.tsx`). 그걸 바꾸면 이 문장도 고친다.
 * - 5조 서버 사건 문단: 서버가 보내는 제품 사건(heymoa-server APP-1071)은 브라우저의 거부를 모른다. 사건을 더하거나
 *   빼면 이 문장을 같이 고친다.
 * - 7조 OpenRouter 카드: 게이트웨이는 OpenRouter 다(heymoa-ai `llm/web_search.py` 의 `openrouter:web_search`).
 *   모델 사업자는 `infrastructure/policies/heymoa.yml` 의 `allowed_providers` 와 같아야 한다.
 * - 7조 PostHog 카드: 「IP는 저장하지 않음」은 PostHog 프로젝트 설정의 Discard client IP data 가 켜져 있어야
 *   사실이다(APP-1068에서 켬). 보관 1년은 무료 요금제 기준이다. 요금제를 바꾸면 여기와 시행일을 같이 고친다.
 * - 7조 카드에는 국가·보유 기간을 따로 정한 사업자만 그 줄을 적는다. 같은 「해당 사업자의 …」가 사업자마다 되풀이되면
 *   정작 다른 값(PostHog 미국·1년, AWS 서울)이 묻혔다. 대신 7조 머리 문단에 한 번만 적는다.
 * - 8조는 법 제30조의 필수 공개 항목이다. 조항을 다시 쓰더라도 지우지 않는다.
 */
const documentFor = (locale: Locale) => {
  const messages = messagesFor(locale);
  const doc = messages.legal.privacy;
  return {
    ...doc,
    metaDescription: doc.metaDescription.replace(
      "{brand}",
      messages.landing.meta.brandLabel
    ),
  };
};

type Processor = {
  vendor: string;
  role: string;
  rows: readonly (readonly string[])[];
};

/** 7조의 사업자 한 곳. 문단(`<p>`) 안에 들어가므로 줄바꿈만 쓴다 — 표·목록 요소는 `<p>` 안에 둘 수 없다. */
function processor({ vendor, role, rows }: Processor): ReactNode {
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
            <dd className="m-0 mb-1.5 text-[var(--tv-body)] sm:mb-0">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await marketingLocale();
  const doc = documentFor(locale);
  return {
    title: doc.title,
    description: doc.metaDescription,
    ...localizedMetadata(locale, "/privacy", {
      title: doc.title,
      description: doc.metaDescription,
    }),
  };
}

export default async function PrivacyPage() {
  const locale = await marketingLocale();
  const doc = documentFor(locale);
  return (
    <>
      <WebPageJsonLd
        name={doc.title}
        description={doc.metaDescription}
        path={localePath(locale, "/privacy")}
        inLanguage={locale}
        dateModified={PRIVACY_EFFECTIVE}
      />
      <LegalDocument
        locale={locale}
        path="/privacy"
        title={doc.title}
        description={doc.description}
        effectiveDate={PRIVACY_EFFECTIVE}
        sections={doc.sections.map((section) => ({
          title: section.title,
          body: section.body.map((paragraph) =>
            typeof paragraph === "string"
              ? withContact(paragraph)
              : processor(paragraph)
          ),
        }))}
      />
    </>
  );
}
