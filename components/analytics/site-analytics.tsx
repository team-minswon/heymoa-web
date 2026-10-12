import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";

import { PostHogAnalytics } from "@/components/analytics/posthog-analytics";
import { shouldCollectAnalytics } from "@/lib/analytics/should-collect";

/** GA4 측정 ID. 공개값이라 소스에 둔다 — env로 빼면 관리할 것만 는다. */
const GA_MEASUREMENT_ID = "G-YL06KCCE4N";

/**
 * PostHog 프로젝트 키(`phc_…`). GA 측정 ID처럼 공개값이라 소스에 둔다. 비우면 PostHog만 꺼진다.
 *
 * 🔴 **개인정보 처리방침 5·7절이 이 프로젝트를 전제로 적혀 있다**(APP-1068): US Cloud · 무료 요금제(보관 1년) ·
 * 「Discard client IP data」 켬. 리전·요금제·IP 설정을 바꾸면 7절과 시행일을 같은 커밋에서 고친다.
 * EU로 옮기면 `lib/analytics/track.ts`의 `api_host`와 7절의 이전 국가도 바뀐다.
 */
const POSTHOG_PROJECT_KEY: string = "phc_qDMePviF8ySaSsxZvXCPqdnEMBdtNgZZqRaCpRqiDYfj";

/**
 * 분석 넷을 한자리에 모은다 — GA·PostHog·Vercel Analytics·Speed Insights.
 *
 * **프로덕션이 아니면 아무것도 그리지 않는다.** Server Component라 판정이 서버에서 끝나고,
 * 꺼진 환경에서는 스크립트가 HTML에 실리지도 않는다.
 *
 * 셋을 한 컴포넌트로 합친 이유는 게이트를 한 곳에만 두기 위해서다. layout에 흩어 두면
 * 하나를 빠뜨렸을 때 아무도 못 잡는다. GA 스크립트는 `afterInteractive`라 body 안 어디에
 * 있든 동작이 같으므로 위치를 옮겨도 무방하다.
 */
export function SiteAnalytics() {
  if (!shouldCollectAnalytics()) return null;

  return (
    <>
      {/* Google tag (gtag.js) */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
      </Script>
      {POSTHOG_PROJECT_KEY && <PostHogAnalytics apiKey={POSTHOG_PROJECT_KEY} />}
      <Analytics />
      <SpeedInsights />
    </>
  );
}
