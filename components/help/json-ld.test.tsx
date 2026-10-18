import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WebPageJsonLd } from "@/components/help/json-ld";

const parse = (html: string) =>
  [
    ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g),
  ].map((m) => JSON.parse(m[1]));

describe("WebPageJsonLd", () => {
  it("WebPage 와 BreadcrumbList 를 내고 dateModified 는 줄 때만 넣는다", () => {
    const [page, crumbs] = parse(
      renderToStaticMarkup(
        <WebPageJsonLd
          name="이용약관"
          description="d"
          path="/terms"
          dateModified="2026-10-18"
        />
      )
    );
    expect(page).toMatchObject({
      "@type": "WebPage",
      dateModified: "2026-10-18",
      url: expect.stringContaining("/terms"),
    });
    expect(crumbs.itemListElement).toHaveLength(2);
    const [bare] = parse(
      renderToStaticMarkup(<WebPageJsonLd name="x" description="d" path="/x" />)
    );
    expect(bare).not.toHaveProperty("dateModified");
  });

  it("extra 를 세 번째 JSON-LD 로 더한다", () => {
    const all = parse(
      renderToStaticMarkup(
        <WebPageJsonLd
          name="x"
          description="d"
          path="/x"
          extra={{ "@type": "SoftwareApplication" }}
        />
      )
    );
    expect(all.map((d) => d["@type"])).toEqual([
      "WebPage",
      "BreadcrumbList",
      "SoftwareApplication",
    ]);
  });
});
