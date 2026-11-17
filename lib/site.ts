import type { Metadata } from "next";

import { messagesFor } from "@/i18n/messages";
import type { Locale } from "@/lib/i18n/locales";

const koMeta = messagesFor("ko").landing.meta;

const PRODUCTION_URL = "https://heymoa.app";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || PRODUCTION_URL;

export const siteConfig = {
  name: "HeyMoa",
  brandLabel: koMeta.brandLabel,
  alternateNames: ["헤이모아", "HeyMoa", "Hey Moa"],
  title: koMeta.title,
  ogTitle: koMeta.ogTitle,
  description: koMeta.description,
  url: siteUrl,
  contactEmail: "team.minswon@gmail.com",
  keywords: koMeta.keywords,
} as const;

const isProductionSite = siteUrl === PRODUCTION_URL;

/** `robots.txt` 의 `Disallow` 는 크롤링만 막아 알려진 URL 이 색인에 남고 이 `noindex` 도 못 읽힙니다. 그래서 비운영도 크롤링은 엽니다. */
export const noindexDirective: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

export const privateRouteMetadata: Metadata = { robots: noindexDirective };

export const robotsDirective: Metadata["robots"] = isProductionSite
  ? {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    }
  : noindexDirective;

/** 루트 레이아웃이 둘로 나뉘어 `app/opengraph-image.png` 파일 규칙이 자동으로 붙지 않아 직접 답니다. */
const siteOgImage = (alt: string) => ({
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt,
});

export function siteMetadataFor(locale: Locale): Metadata {
  const meta = messagesFor(locale).landing.meta;
  const image = siteOgImage(meta.ogImageAlt);
  return {
    metadataBase: new URL(siteConfig.url),
    applicationName: siteConfig.name,
    title: {
      default: meta.title,
      template: `%s | ${meta.brandLabel}`,
    },
    description: meta.description,
    keywords: [...meta.keywords],
    authors: [{ name: siteConfig.name, url: siteConfig.url }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    icons: {
      icon: [
        { url: "/favicon.ico?v=3", sizes: "any" },
        { url: "/favicon-32x32.png?v=3", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png?v=3", sizes: "16x16", type: "image/png" },
        {
          url: "/android-chrome-192x192.png?v=2",
          sizes: "192x192",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: "/apple-touch-icon.png?v=2",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    manifest: "/site.webmanifest",
    alternates: {
      canonical: "/",
      languages: { ko: "/", "x-default": "/" },
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      other: process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION
        ? {
            "naver-site-verification":
              process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION,
          }
        : undefined,
    },
    openGraph: {
      type: "website",
      locale: locale === "en" ? "en_US" : "ko_KR",
      url: siteConfig.url,
      siteName: siteConfig.name,
      title: meta.ogTitle,
      description: meta.description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.ogTitle,
      description: meta.description,
      images: [image],
    },
    robots: robotsDirective,
  };
}

