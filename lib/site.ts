import type { Metadata } from "next";

import { messagesFor } from "@/i18n/messages";
import type { Locale } from "@/lib/i18n/locales";

/** 사이트 제목 · 설명 · 키워드 · 공유 이미지 alt 는 언어 파일(`landing.meta`)에 있다(PRO-66). */
const koMeta = messagesFor("ko").landing.meta;

/**
 * 운영 도메인. 여기와 다른 곳에 떠 있으면 그 배포는 운영이 아닙니다 (APP-642).
 */
const PRODUCTION_URL = "https://heymoa.app";

/**
 * 끝 슬래시를 떼고 비교합니다. `https://heymoa.app/` 는 같은 주소인데 문자열로는 다르고,
 * 그대로 두면 **운영이 `Disallow: /` 를 내서 통째로 색인에서 빠집니다** — 실패 방향이
 * 랩 쪽(색인됨)보다 훨씬 비쌉니다.
 *
 * `??` 가 아니라 `||` 입니다. 빈 문자열은 「host-only」 같은 뜻이 없고 그냥 안 준 것이라,
 * 운영 기본값으로 돌려보내야 합니다.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || PRODUCTION_URL;

export const siteConfig = {
  name: "HeyMoa",
  // 랜딩 히어로 · 기능 구간이 하는 말까지만 한다. 「참여형 AI 회의 운영 에이전트」는 지금 제품(받아 적고 정리하고
  // 묻는)과 맞지 않아 내렸다(APP-934). 공유 카드는 `app/opengraph-image.png` 그림 한 장이다.
  // 두 표기(HeyMoa · 헤이모아)가 모두 검색어다 — 제목·설명·본문에 실제로 쓰고, 숨긴 글자로 도배하지 않는다(APP-1236).
  brandLabel: koMeta.brandLabel,
  alternateNames: ["헤이모아", "HeyMoa", "Hey Moa"],
  title: koMeta.title,
  // 공유 카드(og:title)는 제목 줄이 짧아서 구분 기호만 다르다. 「AI 실시간 회의록」이 어디서나 앞에 온다(APP-1245).
  ogTitle: koMeta.ogTitle,
  // 메신저 카드는 약 90자에서 잘린다 — 핵심(맥락을 잇는 AI Agent · AI 실시간 회의록)이 그 안에 든다.
  description: koMeta.description,
  // 랩(`env-001.realillust.com` 등)에서 열면 canonical·OG·sitemap 이 전부 운영 주소를
  // 가리켜서, 크롤러에게 랩이 운영의 거울이라고 말하게 됩니다. 기본값은 운영 그대로입니다.
  url: siteUrl,
  contactEmail: "team.minswon@gmail.com",
  // 사람이 치는 검색어라 「AI Agent」 「업무 자동화」는 둔다. 「참여형 AI」 「회의 운영」은 우리만 쓰던
  // 옛 소개 문구라 뺐다(APP-934).
  keywords: koMeta.keywords,
} as const;

/** 운영 도메인이 아닌 배포는 색인되면 안 됩니다. `app/robots.ts` 가 씁니다. */
export const isProductionSite = siteUrl === PRODUCTION_URL;

/**
 * 운영이 아닌 배포(랩)는 색인되면 안 됩니다 — 같은 제품이 여러 주소로 잡히면 운영 쪽
 * 순위를 갉아먹습니다.
 *
 * 🔴 **`robots.txt` 의 `Disallow` 로는 안 됩니다.** 그건 크롤링만 막아서 이미 알려진
 * URL 은 색인에 그대로 남고, 오히려 크롤러가 이 `noindex` 를 못 읽습니다. 그래서
 * `app/robots.ts` 는 비운영에서도 크롤링을 열어 둡니다 (APP-642).
 */
export const noindexDirective: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

/**
 * 로그인해야 보이는 면(`/w/**`)과 토큰이 쿼리에 실리는 입구(`/oauth/**` · `/invite`)는 운영에서도 색인하지
 * 않는다. 위와 같은 이유로 robots.txt 가 아니라 이 메타데이터로 막는다. 제품 루트 레이아웃(`app/(product)/layout.tsx`)이
 * 이미 기본으로 noindex 라 라우트마다 거는 것은 의도를 보이는 이중 안전이다. 개인 회의 내용이라
 * `e2e/noindex.spec.ts`가 지킨다(APP-1036, APP-1295).
 */
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

/**
 * 사이트 공통 공유 카드(`app/opengraph-image.png`). 루트 레이아웃이 `app/` 바로 아래가 아니라 두 루트로 나뉘어
 * 파일 규칙이 페이지에 자동으로 붙지 않으므로 직접 단다. 한국어 alt 는 그림 속 글 그대로이고
 * `app/opengraph-image.alt.txt` 와 같다. 영어 alt 는 그 글을 옮긴 것이다.
 */
const siteOgImage = (alt: string) => ({
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt,
});

/**
 * 사이트 metadata. 제품 루트(`app/(product)`)는 한국어(`siteMetadata`), 마케팅 루트(`app/[lang]`)는 주소 언어로 낸다.
 * 마케팅 페이지는 canonical·hreflang 을 `lib/i18n/metadata.ts` 에서 따로 만든다.
 */
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
    // 검색엔진 소유 확인 메타 태그 자리. 값은 환경 변수로만 넣고, 없으면 태그를 그리지 않는다(등록은 운영자가 한다).
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

export const siteMetadata: Metadata = siteMetadataFor("ko");
