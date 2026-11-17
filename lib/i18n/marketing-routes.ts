import { ACCEPT_LANGUAGE_EN_ONLY } from "./accept-language";
import {
  DEFAULT_LOCALE,
  LANG_COOKIE,
  LOCALES,
  localePath,
  splitLocale,
} from "./locales";

// next.config.ts 가 읽으므로 Next 서버 API 를 들이지 않습니다.
export const MARKETING_PAGES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/download", changeFrequency: "monthly", priority: 0.7 },
  { path: "/help", changeFrequency: "monthly", priority: 0.6 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
] as const;

export function isMarketingPath(path: string) {
  return MARKETING_PAGES.some(
    (page) =>
      path === page.path ||
      (page.path !== "/" && path.startsWith(`${page.path}/`))
  );
}

export const isMarketingPathname = (pathname: string) =>
  isMarketingPath(splitLocale(pathname).path);

// afterFiles 로 겁니다. beforeFiles 면 `public/help/**` 파일이 `[lang]` 페이지로 넘어가 404 HTML 이 됩니다.
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

export function marketingRedirects() {
  return [
    {
      source: `/:path((?:(?:${LOCALES.join("|")})/)?(?:help|download)(?:/.*)?/opengraph-image.*)`,
      destination: "/opengraph-image.png",
      statusCode: 301 as const,
    },
    {
      source: "/opengraph-image",
      destination: "/opengraph-image.png",
      statusCode: 301 as const,
    },
    { source: `/${DEFAULT_LOCALE}`, destination: "/", permanent: true },
    // opengraph-image 는 빼고 옮깁니다. Next 가 og:image 를 rewrite 뒤 주소로 내서 옮기면 이동을 한 번 더 탑니다.
    {
      source: `/${DEFAULT_LOCALE}/:rest((?!.*opengraph-image).*)`,
      destination: "/:rest",
      permanent: true,
    },
    ...LOCALES.map((locale) => {
      const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
      return {
        source: `${prefix}/help/desktop`,
        destination: `${prefix}/help/start/desktop`,
        permanent: true,
      };
    }),
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
