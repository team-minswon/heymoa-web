import { expect, test } from "@playwright/test";

/**
 * 목 모드에서는 `proxy.ts` 가 곧바로 넘긴다 — 만료 토큰이어도 갱신·쿠키 변경이 없다. 일반 요청과 prefetch 가 같다.
 * 정상·만료·일시 실패·폐기 네 경우는 진짜 소켓의 가짜 API 로 `e2e/agent-oauth/proxy-refresh.spec.ts` 가 본다.
 */
const EXPIRED =
  "eyJhbGciOiJub25lIn0.eyJzdWIiOiIwMUswMDAwMDAwMDAwIiwiZXhwIjoxfQ.e2e";

test.describe.configure({ timeout: 120_000 });

for (const path of ["/help", "/en/help", "/w/01K0000000000"]) {
  test(`목 모드 ${path}: 일반 요청도 prefetch 도 쿠키를 바꾸지 않는다`, async ({
    request,
  }) => {
    for (const prefetch of [false, true]) {
      const response = await request.get(path, {
        headers: {
          cookie: `access_token=${EXPIRED}; refresh_token=r`,
          ...(prefetch ? { "next-router-prefetch": "1" } : {}),
        },
        maxRedirects: 0,
      });
      expect(response.status(), `${path} prefetch=${prefetch}`).toBe(200);
      expect(
        response.headersArray().filter(({ name }) => name.toLowerCase() === "set-cookie")
      ).toEqual([]);
    }
  });
}
