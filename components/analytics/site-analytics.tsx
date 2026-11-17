import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";

import { PostHogAnalytics } from "@/components/analytics/posthog-analytics";
import { shouldCollectAnalytics } from "@/lib/analytics/should-collect";

const GA_MEASUREMENT_ID = "G-YL06KCCE4N";

/**
 * PostHog 프로젝트 키(`phc_…`). GA 측정 ID처럼 공개값이라 소스에 둔다. 비우면 PostHog만 꺼진다.
 *
 * 🔴 **개인정보 처리방침 5·7절이 이 프로젝트를 전제로 적혀 있다**: US Cloud · 이벤트 보관 1년·리플레이 30일 ·
 * 「Discard client IP data」 켬. 리전·요금제·IP 설정을 바꾸면 7절과 시행일을 같은 커밋에서 고친다.
 * EU로 옮기면 `lib/analytics/track.ts`의 `api_host`와 7절의 이전 국가도 바뀐다.
 */
const POSTHOG_PROJECT_KEY: string =
  "phc_qDMePviF8ySaSsxZvXCPqdnEMBdtNgZZqRaCpRqiDYfj";

export function SiteAnalytics() {
  if (!shouldCollectAnalytics()) return null;

  return (
    <>
      <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} />
      {POSTHOG_PROJECT_KEY && <PostHogAnalytics apiKey={POSTHOG_PROJECT_KEY} />}
      <Analytics />
      <SpeedInsights />
    </>
  );
}
