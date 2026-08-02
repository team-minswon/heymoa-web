/**
 * 분석을 집계할 환경인가.
 *
 * **`VERCEL_ENV`를 본다.** Vercel이 빌드·런타임 모두에 `production`·`preview`·`development`
 * 셋 중 하나로 채우고, 로컬과 e2e에는 값이 없어 자동으로 꺼진다.
 *
 * `NODE_ENV`로는 못 가른다 — **preview 배포도 `NODE_ENV=production`으로 돌기 때문**이다.
 * `@vercel/analytics`와 `@vercel/speed-insights`가 자체적으로 `NODE_ENV`만 보기 때문에
 * 브랜치를 올릴 때마다 프로덕션 지표에 섞였다.
 *
 * `NEXT_PUBLIC_` 접두어를 안 붙인 이유는 판정을 Server Component에서 하기 때문이다. 프로젝트의
 * "시스템 환경변수 자동 노출" 설정에 의존하지 않고, 꺼진 환경에서는 스크립트가 HTML에 아예
 * 안 실린다.
 *
 * 명시 플래그(`NEXT_PUBLIC_ANALYTICS=enabled`)를 안 쓴 이유는 Vercel 프로덕션에 값을 넣는 것을
 * 잊으면 조용히 꺼지기 때문이다. `VERCEL_ENV`는 채워 넣을 것이 없다.
 */
export function shouldCollectAnalytics() {
  return process.env.VERCEL_ENV === "production";
}
