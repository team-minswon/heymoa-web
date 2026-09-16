import type { Metadata } from "next";

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
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || PRODUCTION_URL;

export const siteConfig = {
  name: "HeyMoa",
  title: "HeyMoa | 참여형 AI 회의 운영 에이전트",
  description:
    "HeyMoa는 회의 대화를 기록하고 맥락과 결정사항을 요약하며, 담당자별 액션 아이템을 정리해 후속 업무로 연결하는 AI 회의 운영 서비스입니다.",
  // 랩(`env-001.realillust.com` 등)에서 열면 canonical·OG·sitemap 이 전부 운영 주소를
  // 가리켜서, 크롤러에게 랩이 운영의 거울이라고 말하게 됩니다. 기본값은 운영 그대로입니다.
  url: siteUrl,
  contactEmail: "team.minswon@gmail.com",
  keywords: [
    "HeyMoa",
    "heymoa",
    "Hey Moa",
    "hey moa",
    "헤이모아",
    "헤이 모아",
    "AI 회의",
    "AI Agent",
    "회의 기록",
    "참여형 AI",
    "액션 아이템",
    "회의 운영",
    "회의 에이전트",
    "업무 자동화",
  ],
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
  : { index: false, follow: false, googleBot: { index: false, follow: false } };
