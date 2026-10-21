import { siteConfig } from "@/lib/site";

/** 검색엔진용 구조화 데이터. `<` 를 이스케이프해 본문 글자가 `</script>` 로 태그를 닫지 못하게 한다. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/**
 * 공개 단일 페이지(다운로드 · 약관 · 개인정보)의 `WebPage` + `BreadcrumbList`. `extra` 는 같은 페이지의 다른 JSON-LD 하나
 * (예: `SoftwareApplication`)를 더한다. `dateModified` 는 문서에 근거가 있을 때만 준다.
 */
export function WebPageJsonLd({
  name,
  description,
  path,
  dateModified,
  extra,
  inLanguage = "ko",
}: {
  name: string;
  description: string;
  path: string;
  dateModified?: string;
  /** 페이지 언어(`ko` · `en`). 영어판은 `path` 도 `/en/...` 로 준다. */
  inLanguage?: string;
  extra?: Record<string, unknown>;
}) {
  const url = `${siteConfig.url}${path}`;
  const context = { "@context": "https://schema.org" };
  return (
    <>
      <JsonLd
        data={{
          ...context,
          "@type": "WebPage",
          name,
          description,
          url,
          inLanguage,
          ...(dateModified ? { dateModified } : {}),
          isPartOf: {
            "@type": "WebSite",
            name: siteConfig.name,
            url: siteConfig.url,
          },
        }}
      />
      <JsonLd
        data={{
          ...context,
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: siteConfig.name,
              item: siteConfig.url,
            },
            { "@type": "ListItem", position: 2, name, item: url },
          ],
        }}
      />
      {extra ? <JsonLd data={{ ...context, ...extra }} /> : null}
    </>
  );
}
