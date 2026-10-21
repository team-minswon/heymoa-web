import { DEFAULT_LOCALE, LOCALES, splitLocale } from "./locales";

/**
 * **마케팅 경로 목록 하나.** 한국어 무접두 rewrite(`next.config.ts`), 랜딩 크롬 판정
 * (`lib/routes/app-route.ts`), sitemap(`app/sitemap.ts`)이 모두 이것을 읽는다. 따로 들면 한쪽만
 * 고쳐져 주소는 열리는데 sitemap 에 없거나 크롬이 다른 면으로 뜬다.
 *
 * 경로 아래 하위 주소(`/help/...`, `/download/app`)도 같은 면이다. 파일은 `app/[lang]/` 아래에 있다.
 * `next.config.ts` 가 읽으므로 Next 서버 API 를 들이지 않는다.
 */
export const MARKETING_PAGES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/download", changeFrequency: "monthly", priority: 0.7 },
  { path: "/help", changeFrequency: "monthly", priority: 0.6 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
] as const;

/** 무접두 경로가 마케팅 면인가. 목록의 경로 자신과 그 아래 하위 주소다. */
export function isMarketingPath(path: string) {
  return MARKETING_PAGES.some(
    (page) =>
      path === page.path ||
      (page.path !== "/" && path.startsWith(`${page.path}/`))
  );
}

/** 브라우저 주소(`/en/help`, `/help`)가 마케팅 면인가. */
export const isMarketingPathname = (pathname: string) =>
  isMarketingPath(splitLocale(pathname).path);

/**
 * 한국어 무접두 주소를 `app/[lang]` 의 `/ko/...` 로 잇는다(`beforeFiles`). proxy 다음, 파일 시스템
 * 앞에서 돌고 클라이언트 라우터에도 적용되므로 prefetch 와 실제 이동이 같은 경로로 풀린다.
 */
export function marketingRewrites() {
  return MARKETING_PAGES.flatMap(({ path }) =>
    path === "/"
      ? [{ source: "/", destination: `/${DEFAULT_LOCALE}` }]
      : [
          { source: path, destination: `/${DEFAULT_LOCALE}${path}` },
          {
            source: `${path}/:rest*`,
            destination: `/${DEFAULT_LOCALE}${path}/:rest*`,
          },
        ]
  );
}

/**
 * `/ko`, `/ko/...` 로 직접 들어오면 무접두 주소로 영구 이동한다. 같은 문서가 두 주소를 갖지 않게.
 * 옛 가이드 주소(`/help/desktop`)의 이동은 언어마다 같은 대응을 둔다.
 */
export function marketingRedirects() {
  return [
    { source: `/${DEFAULT_LOCALE}`, destination: "/", permanent: true },
    // 공유 이미지(`opengraph-image`)는 빼고 옮긴다. Next 가 한국어 페이지의 og:image 를 rewrite 뒤 주소
    // (`/ko/download/opengraph-image`)로 내므로, 옮기면 크롤러가 이미지마다 이동을 한 번 더 탄다.
    {
      source: `/${DEFAULT_LOCALE}/:rest((?!.*opengraph-image).*)`,
      destination: "/:rest",
      permanent: true,
    },
    // 사용 가이드를 주제별 주소(`/help/<그룹>/<페이지>`)로 나누기 전에 있던 `/help/desktop` 이 검색엔진과
    // 외부 링크에 남아 있다. 영구 이동이라 순위가 새 주소로 옮겨 가고, `#first-run` 같은 해시는 브라우저가
    // 그대로 이어 준다(APP-1231).
    ...LOCALES.map((locale) => {
      const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
      return {
        source: `${prefix}/help/desktop`,
        destination: `${prefix}/help/start/desktop`,
        permanent: true,
      };
    }),
  ];
}
