import { siteConfig } from "@/lib/site";

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
