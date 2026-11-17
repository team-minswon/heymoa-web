/** `VERCEL_ENV` 를 봅니다. preview 배포도 `NODE_ENV=production` 으로 돌고, `@vercel/analytics`·`@vercel/speed-insights` 는 `NODE_ENV` 만 봅니다. */
export function shouldCollectAnalytics() {
  return process.env.VERCEL_ENV === "production";
}
