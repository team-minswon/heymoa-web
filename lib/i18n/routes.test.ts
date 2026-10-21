import { describe, expect, it } from "vitest";

import { LOCALES, localePath, splitLocale } from "@/lib/i18n/locales";
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

describe("언어판 metadata — 설정 없이 모든 언어판이 검색에 공개된다", () => {
  it("영어판도 noindex 를 걸지 않고 자기 주소가 canonical 이다", () => {
    const en = localizedMetadata("en", "/help");

    expect(en.alternates?.canonical).toBe("/en/help");
    // robots 를 아예 내지 않는다 — 비운영 배포의 noindex 는 루트 레이아웃이 그대로 건다.
    expect(en).not.toHaveProperty("robots");
  });

  it("모든 언어판이 같은 hreflang 묶음을 달고 x-default 는 한국어다", () => {
    const languages = { ko: "/", en: "/en", "x-default": "/" };

    expect(localizedMetadata("en", "/")).toEqual({
      alternates: { canonical: "/en", languages },
    });
    expect(localizedMetadata("ko", "/")).toEqual({
      alternates: { canonical: "/", languages },
    });
  });

  it.each(["/help", "/help/start/desktop", "/download", "/terms"])(
    "%s: hreflang 에 LOCALES 전부가 한 번씩 오른다",
    (path) => {
      for (const locale of LOCALES) {
        const { alternates } = localizedMetadata(locale, path);

        expect(alternates?.canonical).toBe(localePath(locale, path));
        expect(Object.keys(alternates?.languages ?? {}).sort()).toEqual(
          [...LOCALES, "x-default"].sort()
        );
        for (const each of LOCALES) {
          expect(alternates?.languages).toHaveProperty(
            each,
            localePath(each, path)
          );
        }
        expect(alternates?.languages).toHaveProperty(
          "x-default",
          localePath("ko", path)
        );
      }
    }
  );
});
