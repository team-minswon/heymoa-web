import { ACCEPT_LANGUAGE_EN_ONLY } from "./accept-language";
import {
  DEFAULT_LOCALE,
  LANG_COOKIE,
  LOCALES,
  localePath,
  splitLocale,
} from "./locales";

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
 * 한국어 무접두 주소를 `app/[lang]` 의 `/ko/...` 로 잇는다(`afterFiles`). `public/` 파일 다음, 동적 라우트
 * 앞에서 돈다 — `public/help/**` 의 가이드 이미지·영상(`/help/getting-started/new-meeting.webp`)은 파일로
 * 나가고, 마케팅 페이지는 모두 `app/[lang]` 아래 동적 라우트라 `[lang]` 이 `help` 를 언어로 잡기 전에 이어진다.
 * `beforeFiles` 였을 때는 가이드 파일 45개가 페이지로 넘어가 404 HTML 이 됐다.
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
    // 가이드·다운로드가 페이지마다 내던 공유 이미지(`/ko/help/<그룹>/<페이지>/opengraph-image-<해시>`)는 APP-1400 에서
    // 지웠지만, 미리보기를 캐시한 Meta·Slack 등이 계속 다시 묻는다. 사이트 공통 그림으로 보내 미리보기가 깨지지 않고,
    // 404 를 그리러 함수가 돌지 않는다(APP-1419). 301 은 크롤러가 가장 널리 따르는 영구 이동이다.
    {
      source: `/:path((?:(?:${LOCALES.join("|")})/)?(?:help|download)(?:/.*)?/opengraph-image.*)`,
      destination: "/opengraph-image.png",
      statusCode: 301 as const,
    },
    // Search Console에 남은 옛 홈 동적 이미지도 같은 그림으로 보낸다(APP-1468).
    {
      source: "/opengraph-image",
      destination: "/opengraph-image.png",
      statusCode: 301 as const,
    },
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
    // 처음 온 사람의 초기 기본값(APP-1285). 언어를 고른 적이 없고(쿠키 없음) 브라우저 언어 판정이 en 이면 홈만
    // 영어 홈으로 보낸다. 홈은 정적 페이지라 헤더를 읽을 수 없어 여기서 건다. 공유·검색으로 받은 다른 주소는 그
    // 언어판 그대로 둔다. 임시 이동(307)이라 캐시에 남지 않고, 쿠키를 쓰지 않으므로 고른 것으로 치지 않는다.
    {
      source: "/",
      has: [
        {
          type: "header" as const,
          key: "accept-language",
          value: ACCEPT_LANGUAGE_EN_ONLY,
        },
      ],
      missing: [{ type: "cookie" as const, key: LANG_COOKIE }],
      destination: localePath("en", "/"),
      permanent: false,
    },
  ];
}
