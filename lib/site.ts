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
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || PRODUCTION_URL;

export const siteConfig = {
  name: "HeyMoa",
  // 랜딩 히어로 · 기능 구간이 하는 말까지만 한다. 「참여형 AI 회의 운영 에이전트」는 지금 제품(받아 적고 정리하고
  // 묻는)과 맞지 않아 내렸다(APP-934). `app/opengraph-image.tsx` 의 한 줄도 이 설명의 앞 문장이다.
  // 두 표기(HeyMoa · 헤이모아)가 모두 검색어다 — 제목·설명·본문에 실제로 쓰고, 숨긴 글자로 도배하지 않는다(APP-1236).
  brandLabel: "HeyMoa(헤이모아)",
  alternateNames: ["헤이모아", "HeyMoa", "Hey Moa"],
  title: "HeyMoa(헤이모아) | AI 회의록 · 회의 요약 · 할 일 자동 정리",
  description:
    "헤이모아(HeyMoa)는 회의를 받아 적고 화자를 나눠 결정과 할 일을 근거와 함께 정리하는 AI 회의 에이전트입니다. 검토를 완료해 확정한 항목만 프로젝트에 쌓입니다.",
  // 랩(`env-001.realillust.com` 등)에서 열면 canonical·OG·sitemap 이 전부 운영 주소를
  // 가리켜서, 크롤러에게 랩이 운영의 거울이라고 말하게 됩니다. 기본값은 운영 그대로입니다.
  url: siteUrl,
  contactEmail: "team.minswon@gmail.com",
  // 사람이 치는 검색어라 「AI Agent」 「업무 자동화」는 둔다. 「참여형 AI」 「회의 운영」은 우리만 쓰던
  // 옛 소개 문구라 뺐다(APP-934).
  keywords: [
    "HeyMoa",
    "heymoa",
    "Hey Moa",
    "hey moa",
    "헤이모아",
    "헤이 모아",
    "AI 회의",
    "AI 회의록",
    "회의록 자동 작성",
    "회의 요약",
    "AI Agent",
    "회의 기록",
    "액션 아이템",
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
export const noindexDirective: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

/**
 * 로그인해야 보이는 면(`/w/**`)과 토큰이 쿼리에 실리는 입구(`/oauth/**` · `/invite`)는 운영에서도 색인하지
 * 않는다. 위와 같은 이유로 robots.txt 가 아니라 이 메타데이터로 막는다 — 각 라우트가 `metadata.robots`로 건다.
 * 개인 회의 내용이라 `e2e/noindex.spec.ts`가 지킨다(APP-1036).
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
