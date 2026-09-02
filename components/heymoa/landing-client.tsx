import { ClosingCta } from "@/components/heymoa/landing/closing-cta";
import { Faq } from "@/components/heymoa/landing/faq";
import { Features } from "@/components/heymoa/landing/features";
import { Flow } from "@/components/heymoa/landing/flow";
import { Hero } from "@/components/heymoa/landing/hero";
import { Principle } from "@/components/heymoa/landing/principle";
import { Problem } from "@/components/heymoa/landing/problem";
import { ProductShot } from "@/components/heymoa/landing/product-shot";
import { Steps } from "@/components/heymoa/landing/steps";
import { siteConfig } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  alternateName: ["heymoa", "Hey Moa", "hey moa", "헤이모아", "헤이 모아"],
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteConfig.url,
  description: siteConfig.description,
  // 「기능 소개」가 세는 여섯과 같게 둔다 — 페이지가 여섯을 말하는데 구조화 데이터가 셋만
  // 말하면 검색 결과에 뜨는 목록이 화면과 갈린다.
  featureList: [
    "실시간 전사",
    "실시간 정리",
    "회의 중 질의",
    "자동 정리",
    "Linear · GitHub 로 내보내기",
    "멤버 초대",
  ],
  inLanguage: "ko-KR",
};

/**
 * 랜딩. Claude Design 아트보드「HeyMoa 랜딩 · 사실 대조판」을 옮긴 판이다.
 *
 * **`landing-surface`가 이 면의 색을 판다.** 앱 전역 토큰(`--el-*`)은 제품 면의 off-white
 * 체계라 여기서 쓰면 크림이 안 나온다. 반대로 크림을 전역에 두면 워크스페이스까지 물든다 —
 * 그래서 클래스 하나로 범위를 자르고 그 안에서 `--lp-*`를 쓴다(globals.css).
 *
 * 서버 컴포넌트로 둔다. 움직이는 것은 `LandingCta`(로그인 상태) 하나뿐이고 그것만 클라이언트다.
 * 예전 판은 파일 전체가 `"use client"`였는데 스크롤 리빌 때문이었고, 이 판에는 그 연출이 없다.
 */
export function LandingClient() {
  return (
    <div className="landing-surface">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <ProductShot />
      <Steps />
      <Flow />
      <Problem />
      <Features />
      <Principle />
      <Faq />
      <ClosingCta />
    </div>
  );
}
