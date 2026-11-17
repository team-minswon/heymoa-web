import { useLocale } from "next-intl";
import { DesktopLaunchRedirect } from "@/components/auth/desktop-launch-redirect";

import { useFaqQA } from "@/components/heymoa/landing/faq";
import { textOf } from "@/lib/help/text";
import { JsonLd } from "@/components/help/json-ld";
import { Landing } from "@/components/heymoa/landing/landing";
import { messagesFor } from "@/i18n/messages";
import { siteConfig } from "@/lib/site";

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
    operatingSystem: "Web, macOS, Windows",
    url: siteConfig.url,
    description: meta.description,
    featureList: meta.features,
    inLanguage,
  };

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

export function LandingClient() {
  const { softwareLd, siteLd, faqLd } = useStructuredData();
  return (
    <>
      <DesktopLaunchRedirect />
      <JsonLd data={softwareLd} />
      <JsonLd data={siteLd} />
      <JsonLd data={faqLd} />
      <Landing />
    </>
  );
}
