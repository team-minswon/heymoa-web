import { describe, expect, it } from "vitest";

import { localePath, publishedLocales, splitLocale } from "@/lib/i18n/locales";
import {
  isMarketingPathname,
  marketingRedirects,
  marketingRewrites,
} from "@/lib/i18n/marketing-routes";
import { localizedMetadata } from "@/lib/i18n/metadata";
import {
  isHelpRoute,
  isLandingChromeRoute,
  isLandingHome,
} from "@/lib/routes/app-route";

describe("언어 경로", () => {
  it("한국어는 무접두, 영어는 /en 아래다", () => {
    expect(localePath("ko", "/help")).toBe("/help");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/help/start")).toBe("/en/help/start");
    expect(splitLocale("/en/help")).toEqual({ locale: "en", path: "/help" });
    expect(splitLocale("/en")).toEqual({ locale: "en", path: "/" });
    expect(splitLocale("/help")).toEqual({ locale: "ko", path: "/help" });
    // 한국어 페이지를 서버에서 그릴 때 usePathname 이 주는 rewrite 뒤 주소.
    expect(splitLocale("/ko/terms")).toEqual({ locale: "ko", path: "/terms" });
    expect(splitLocale("/ko")).toEqual({ locale: "ko", path: "/" });
    // `/english` 같은 첫 세그먼트는 언어가 아니다.
    expect(splitLocale("/english")).toEqual({ locale: "ko", path: "/english" });
  });

  it("공개 언어는 기본 한국어만이고 PUBLISHED_LOCALES 로 더한다", () => {
    expect(publishedLocales(undefined)).toEqual(["ko"]);
    expect(publishedLocales("")).toEqual(["ko"]);
    expect(publishedLocales("ko, en")).toEqual(["ko", "en"]);
    expect(publishedLocales("en")).toEqual(["ko", "en"]);
    expect(publishedLocales("ja")).toEqual(["ko"]);
  });
});

describe("마케팅 경로 목록 하나가 rewrite·크롬 판정을 정한다", () => {
  it("한국어 무접두 주소를 /ko 로 잇는다", () => {
    expect(marketingRewrites()).toEqual(
      expect.arrayContaining([
        { source: "/", destination: "/ko" },
        { source: "/help", destination: "/ko/help" },
        { source: "/help/:rest*", destination: "/ko/help/:rest*" },
        { source: "/download/:rest*", destination: "/ko/download/:rest*" },
        { source: "/terms", destination: "/ko/terms" },
        { source: "/privacy", destination: "/ko/privacy" },
      ])
    );
    // 제품 면은 잇지 않는다.
    expect(
      marketingRewrites().some(({ source }) =>
        /^\/(w|settings|invite|oauth|auth)\b/.test(source)
      )
    ).toBe(false);
  });

  it("/ko 접두와 옛 가이드 주소를 영구 이동한다", () => {
    expect(marketingRedirects()).toEqual(
      expect.arrayContaining([
        {
          source: "/ko/:rest((?!.*opengraph-image).*)",
          destination: "/:rest",
          permanent: true,
        },
        {
          source: "/help/desktop",
          destination: "/help/start/desktop",
          permanent: true,
        },
        {
          source: "/en/help/desktop",
          destination: "/en/help/start/desktop",
          permanent: true,
        },
      ])
    );
  });

  it.each([
    ["/", true],
    ["/en", true],
    ["/terms", true],
    ["/en/privacy", true],
    ["/download", true],
    ["/help/start/desktop", true],
    ["/en/help", true],
    ["/w/01K0000000000", false],
    ["/invite", false],
    ["/en/w/x", false],
    ["/ko/terms", true],
    ["/ko", true],
    ["/helpdesk", false],
  ])("%s 랜딩 크롬=%s", (pathname, expected) => {
    expect(isLandingChromeRoute(pathname)).toBe(expected);
    expect(isMarketingPathname(pathname)).toBe(expected);
  });

  it("영어판 가이드와 랜딩 첫 화면도 같은 판정을 받는다", () => {
    expect(isHelpRoute("/en/help/start")).toBe(true);
    expect(isHelpRoute("/helpdesk")).toBe(false);
    expect(isLandingHome("/")).toBe(true);
    expect(isLandingHome("/en")).toBe(true);
    expect(isLandingHome("/en/help")).toBe(false);
  });
});

describe("검색 공개 플래그(PUBLISHED_LOCALES)", () => {
  it("기본값: 영어판은 noindex·자기 canonical·hreflang 없음, 한국어판 hreflang 에 영어가 없다", () => {
    const published = publishedLocales(undefined);

    expect(localizedMetadata("en", "/help", published)).toEqual({
      alternates: { canonical: "/en/help" },
      robots: expect.objectContaining({ index: false }),
    });
    expect(localizedMetadata("ko", "/help", published)).toEqual({
      alternates: {
        canonical: "/help",
        languages: { ko: "/help", "x-default": "/help" },
      },
    });
  });

  it("ko,en: 영어판 noindex 해제·self-canonical·상호 hreflang, x-default 는 한국어", () => {
    const published = publishedLocales("ko,en");
    const languages = { ko: "/", en: "/en", "x-default": "/" };

    expect(localizedMetadata("en", "/", published)).toEqual({
      alternates: { canonical: "/en", languages },
    });
    expect(localizedMetadata("ko", "/", published)).toEqual({
      alternates: { canonical: "/", languages },
    });
  });
});
