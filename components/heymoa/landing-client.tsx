import { useLocale } from "next-intl";

import { useFaqQA } from "@/components/heymoa/landing/faq";
import { textOf } from "@/lib/help/text";
import { JsonLd } from "@/components/help/json-ld";
import { Landing } from "@/components/heymoa/landing/landing";
import { messagesFor } from "@/i18n/messages";
import { siteConfig } from "@/lib/site";

/**
 * 구조화 데이터. 설명 · 기능 목록 · 언어는 페이지 언어로 낸다(`landing.meta`).
 *
 * 기능 목록(`features`)은 화면의 구간 순서 그대로다(`landing/landing.tsx`) — 구간을 더하거나 빼면 언어 파일도
 * 같이 고친다. 페이지가 말하지 않는 기능을 구조화 데이터만 말하면 검색 결과가 화면과 갈린다.
 */
function useStructuredData() {
  const locale = useLocale();
  const meta = messagesFor(locale).landing.meta;
  const inLanguage = locale === "en" ? "en-US" : "ko-KR";
  const qa = useFaqQA();

  const softwareLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    alternateName: [...siteConfig.alternateNames, "heymoa", "헤이 모아"],
    applicationCategory: "BusinessApplication",
    // 데스크톱 앱(`app/[lang]/download/page.tsx` — macOS DMG · Windows EXE)도 받을 수 있다(FAQ 01).
    operatingSystem: "Web, macOS, Windows",
    url: siteConfig.url,
    description: meta.description,
    featureList: meta.features,
    inLanguage,
  };

  /** 사이트와 운영 주체. 이름은 두 표기(HeyMoa · 헤이모아)를 모두 싣는다. */
  const siteLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteConfig.url}/#organization`,
        name: siteConfig.name,
        alternateName: [...siteConfig.alternateNames],
        url: siteConfig.url,
        logo: `${siteConfig.url}/android-chrome-192x192.png`,
        email: siteConfig.contactEmail,
      },
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}/#website`,
        name: siteConfig.name,
        alternateName: [...siteConfig.alternateNames],
        url: siteConfig.url,
        inLanguage,
        publisher: { "@id": `${siteConfig.url}/#organization` },
      },
    ],
  };

  /** 화면의 「자주 묻는 질문」과 같은 질문·답이다(`landing/faq.tsx` 의 `useFaqQA`). 본문에 없는 말은 싣지 않는다. */
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: textOf(a) },
    })),
  };

  return { softwareLd, siteLd, faqLd };
}

/**
 * 랜딩. 서버 컴포넌트로 두고, 움직이는 조각(히어로 시연 · 리빌 · 흐르는 띠 · 시작 버튼)만 클라이언트다.
 */
export function LandingClient() {
  const { softwareLd, siteLd, faqLd } = useStructuredData();
  return (
    <>
      <JsonLd data={softwareLd} />
      <JsonLd data={siteLd} />
      <JsonLd data={faqLd} />
      <Landing />
    </>
  );
}
