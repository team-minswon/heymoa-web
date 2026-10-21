import { afterEach, describe, expect, it, vi } from "vitest";

async function load(siteUrl?: string) {
  vi.resetModules();

  if (siteUrl !== undefined) {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  }

  return {
    robots: (await import("@/app/robots")).default,
    site: await import("@/lib/site"),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("색인 지시", () => {
  it("운영은 색인되고 사이트맵이 운영 주소를 가리킨다", async () => {
    const { robots, site } = await load();

    expect(site.robotsDirective).toMatchObject({ index: true, follow: true });
    expect(robots().sitemap).toBe("https://heymoa.app/sitemap.xml");
  });

  // 랩 환경 셋이 인터넷에 열려 있습니다. 같은 제품이 여러 주소로 색인되면 운영 쪽
  // 순위를 갉아먹고, sitemap 도 운영 주소를 가리켜 거울처럼 보입니다 (APP-642).
  it("운영이 아닌 배포는 noindex 이고 사이트맵이 자기 주소를 가리킨다", async () => {
    const { robots, site } = await load("https://env-001.realillust.com");

    expect(site.robotsDirective).toMatchObject({ index: false, follow: false });
    expect(robots().sitemap).toBe("https://env-001.realillust.com/sitemap.xml");
  });

  // `https://heymoa.app/` 는 같은 주소다. 문자열로만 비교하면 운영이 통째로 색인에서
  // 빠진다 — 랩이 색인되는 것보다 훨씬 비싼 실패다.
  it("끝 슬래시가 붙은 운영 주소도 운영으로 본다", async () => {
    const { site } = await load("https://heymoa.app/");

    expect(site.robotsDirective).toMatchObject({ index: true, follow: true });
  });

  // 🔴 크롤링을 막으면 크롤러가 noindex 를 못 읽는다. 이미 알려진 URL 이 색인에 남는다.
  it("운영이 아니어도 크롤링 자체는 막지 않는다", async () => {
    const { robots } = await load("https://env-001.realillust.com");

    expect(robots().rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/auth/callback", "/settings"],
    });
  });
});

// 공개 정적 페이지가 사이트맵에 빠지면 Search Console 이 늦게 찾는다(APP-1036).
// 고정 목록이 아니라 **원본 목록과 대조**한다 — 마케팅 경로나 가이드 주제를 더했는데 sitemap 에 없으면 실패한다(PRO-66).
describe("사이트맵", () => {
  async function load() {
    vi.resetModules(); // 앞 테스트가 바꾼 NEXT_PUBLIC_SITE_URL 이 캐시된 siteConfig 에 남지 않게
    return {
      sitemap: (await import("@/app/sitemap")).default,
      locales: (await import("@/lib/i18n/locales")).LOCALES,
      localePath: (await import("@/lib/i18n/locales")).localePath,
      pages: (await import("@/lib/i18n/marketing-routes")).MARKETING_PAGES,
      groups: (await import("@/app/[lang]/help/_content/groups")).helpGroups,
      topics: (await import("@/app/[lang]/help/_content/topics")).helpTopics,
      topicsFor: (await import("@/app/[lang]/help/_content/topics"))
        .helpTopicsFor,
      pathOf: (await import("@/app/[lang]/help/_content/paths")).helpPathOf,
      dates: await import("@/lib/page-dates"),
    };
  }

  const absolute = (path: string) =>
    path === "/" ? "https://heymoa.app" : `https://heymoa.app${path}`;

  it("마케팅 경로 목록과 가이드 주제 목록의 주소를 언어판마다 빠짐없이 한 번씩 싣는다", async () => {
    const { sitemap, locales, localePath, pages, groups, topics, pathOf } =
      await load();
    const paths = [
      ...pages.map(({ path }) => path),
      ...groups.map(({ slug }) => `/help/${slug}`),
      ...topics.map(pathOf),
    ];
    const expected = locales
      .flatMap((locale) => paths.map((path) => localePath(locale, path)))
      .map(absolute);
    const urls = sitemap().map((entry) => entry.url);

    expect(new Set(urls).size).toBe(urls.length);
    expect([...urls].sort()).toEqual([...expected].sort());
  });

  it("영어판도 설정 없이 실리고, 한국어판과 서로를 대응으로 단다", async () => {
    const { sitemap } = await load();
    const entries = sitemap();
    const help = entries.filter((entry) => entry.url.endsWith("/help"));

    expect(help.map((entry) => entry.url)).toEqual([
      "https://heymoa.app/help",
      "https://heymoa.app/en/help",
    ]);
    for (const entry of help) {
      expect(entry.alternates).toEqual({
        languages: {
          ko: "https://heymoa.app/help",
          en: "https://heymoa.app/en/help",
          "x-default": "https://heymoa.app/help",
        },
      });
    }
  });

  it("랜딩은 끝 슬래시 없이 두 언어판을 서로 대응한다", async () => {
    const { sitemap } = await load();
    const home = sitemap().filter((entry) =>
      ["https://heymoa.app", "https://heymoa.app/en"].includes(entry.url)
    );

    expect(home).toHaveLength(2);
    for (const entry of home) {
      expect(entry.alternates).toEqual({
        languages: {
          ko: "https://heymoa.app",
          en: "https://heymoa.app/en",
          "x-default": "https://heymoa.app",
        },
      });
    }
  });

  // 구글은 lastmod 가 실제 수정과 맞을 때만 쓴다. 배포 시각(`new Date()`)이 들어오면 배포마다 바뀐다(APP-1293).
  it("lastmod 는 날짜뿐이고 시계에 따라 바뀌지 않는다", async () => {
    const { sitemap } = await load();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-21T00:00:00Z"));
      const before = sitemap();
      vi.setSystemTime(new Date("2026-12-31T12:34:56Z"));
      const after = sitemap();
      expect(after).toEqual(before);
    } finally {
      vi.useRealTimers();
    }
    for (const entry of sitemap()) {
      expect(entry.lastModified, entry.url).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("lastmod 가 미래 날짜가 아니다", async () => {
    const { sitemap } = await load();
    // 한국 날짜가 UTC 보다 하루 앞설 수 있어 하루를 더 허용한다.
    const limit = Date.now() + 24 * 60 * 60 * 1000;
    for (const entry of sitemap()) {
      expect(Date.parse(String(entry.lastModified)), entry.url).toBeLessThanOrEqual(limit);
    }
  });

  it("약관·개인정보 lastmod 는 시행일이고, 가이드는 페이지의 modified 를 따른다", async () => {
    const { sitemap, dates, topicsFor, pathOf, locales, localePath } =
      await load();
    const byUrl = new Map(sitemap().map((entry) => [entry.url, entry]));
    const at = (locale: "ko" | "en", path: string) =>
      byUrl.get(absolute(localePath(locale, path)))?.lastModified;

    for (const locale of locales) {
      expect(at(locale, "/terms")).toBe(dates.TERMS_EFFECTIVE);
      expect(at(locale, "/privacy")).toBe(dates.PRIVACY_EFFECTIVE);
      const topics = topicsFor(locale);
      for (const topic of topics) {
        expect(at(locale, pathOf(topic)), pathOf(topic)).toBe(topic.modified);
      }
      // 허브는 아래 페이지 중 가장 최근에 고친 날이다.
      expect(at(locale, "/help")).toBe(
        topics.map((topic) => topic.modified).sort().at(-1)
      );
    }
  });
});
