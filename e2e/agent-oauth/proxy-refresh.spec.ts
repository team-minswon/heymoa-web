import { expect, test, type APIRequestContext } from "@playwright/test";

const API = `http://localhost:${process.env.E2E_API_PORT ?? "3199"}`;
const PREFETCH = { "next-router-prefetch": "1" };
const PATHS = ["/help", "/en/help", "/invite"];
const USER_EMAIL = "user@example.com";

type Session = { access: string; refresh: string };

async function reset(request: APIRequestContext) {
  await request.post(`${API}/__test/reset`);
}

async function session(request: APIRequestContext, expired: boolean) {
  return (await (
    await request.post(`${API}/__test/session${expired ? "?expired=1" : ""}`)
  ).json()) as Session;
}

async function attempts(request: APIRequestContext) {
  return (
    (await (await request.get(`${API}/__test/state`)).json()) as {
      refreshAttempts: number;
    }
  ).refreshAttempts;
}

async function open(
  request: APIRequestContext,
  path: string,
  { access, refresh }: Session,
  prefetch: boolean
) {
  const response = await request.get(path, {
    headers: {
      cookie: `access_token=${access}; refresh_token=${refresh}`,
      ...(prefetch ? PREFETCH : {}),
    },
    maxRedirects: 0,
  });
  return {
    status: response.status(),
    setCookie: response
      .headersArray()
      .filter(({ name }) => name.toLowerCase() === "set-cookie")
      .map(({ value }) => value),
    body: await response.text(),
  };
}

test.beforeEach(async ({ request }) => {
  await reset(request);
});

for (const path of PATHS) {
  const product = path === "/invite";
  test.describe(path, () => {
    test("정상 토큰: 일반 요청도 prefetch 도 갱신하지 않는다", async ({
      request,
    }) => {
      const live = await session(request, false);
      for (const prefetch of [false, true]) {
        const result = await open(request, path, live, prefetch);
        expect(result.status).toBe(200);
        expect(result.setCookie).toEqual([]);
      }
      expect(await attempts(request)).toBe(0);
    });

    test(
      product
        ? "만료: 일반 요청은 갱신해 SSR 과 브라우저에 새 쿠키를 넘기고, prefetch 는 갱신하지 않는다"
        : "정적 가이드는 만료 토큰도 갱신하거나 쿠키를 바꾸지 않는다",
      async ({ request }) => {
        const expired = await session(request, true);

        const prefetched = await open(request, path, expired, true);
        expect(prefetched.setCookie).toEqual([]);
        expect(await attempts(request)).toBe(0);

        const result = await open(request, path, expired, false);
        expect(result.status).toBe(200);
        expect(await attempts(request)).toBe(product ? 1 : 0);
        if (product) {
          expect(
            result.setCookie.some((c) => c.startsWith("access_token="))
          ).toBe(true);
          expect(
            result.setCookie.some((c) => c.startsWith("refresh_token="))
          ).toBe(true);
          expect(result.body).toContain(USER_EMAIL);
        } else {
          expect(result.setCookie).toEqual([]);
        }
      }
    );

    test("일시 실패: 쿠키를 건드리지 않고, prefetch 는 시도조차 하지 않는다", async ({
      request,
    }) => {
      const expired = await session(request, true);
      await request.post(`${API}/__test/refresh-unavailable`);

      const prefetched = await open(request, path, expired, true);
      expect(prefetched.setCookie).toEqual([]);
      expect(await attempts(request)).toBe(0);

      const result = await open(request, path, expired, false);
      expect(result.status).toBe(200);
      expect(await attempts(request)).toBe(product ? 1 : 0);
      expect(result.setCookie).toEqual([]);
    });

    test(
      product
        ? "폐기 토큰: 일반 요청은 인증 쿠키를 지우고, prefetch 는 지우지 않는다"
        : "정적 가이드는 폐기 토큰도 갱신하거나 쿠키를 지우지 않는다",
      async ({ request }) => {
        const revoked = {
          ...(await session(request, true)),
          refresh: "revoked",
        };

        const prefetched = await open(request, path, revoked, true);
        expect(prefetched.setCookie).toEqual([]);
        expect(await attempts(request)).toBe(0);

        const result = await open(request, path, revoked, false);
        expect(result.status).toBe(200);
        expect(await attempts(request)).toBe(product ? 1 : 0);
        if (!product) expect(result.setCookie).toEqual([]);
        for (const name of product ? ["access_token", "refresh_token"] : []) {
          expect(
            result.setCookie.some(
              (c) =>
                c.startsWith(`${name}=;`) && /expires=Thu, 01 Jan 1970/i.test(c)
            ),
            name
          ).toBe(true);
        }
      }
    );
  });
}

for (const path of ["/w/01K0000000000", "/settings/notifications", "/inquiries/01K0000000000"]) {
test(`폐기 토큰으로 ${path} 진입 시 첫 SSR부터 선택 언어의 로그인 카드를 보여 준다`, async ({ request }) => {
  const revoked = { ...(await session(request, true)), refresh: "revoked" };
  const response = await request.get(path, {
    headers: {
      cookie: `access_token=${revoked.access}; refresh_token=${revoked.refresh}; heymoa-lang=en`,
    },
  });
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("You&#x27;ll return to this page after signing in");
  expect(body).toContain('lang="en"');
  expect(await attempts(request)).toBe(1);
});
}
