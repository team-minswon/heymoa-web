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
  async function load(published?: string) {
    vi.resetModules();
    if (published !== undefined) vi.stubEnv("PUBLISHED_LOCALES", published);
    return {
      sitemap: (await import("@/app/sitemap")).default,
      pages: (await import("@/lib/i18n/marketing-routes")).MARKETING_PAGES,
      groups: (await import("@/app/[lang]/help/_content/groups")).helpGroups,
      topics: (await import("@/app/[lang]/help/_content/topics")).helpTopics,
      pathOf: (await import("@/app/[lang]/help/_content/paths")).helpPathOf,
    };
  }

  const absolute = (path: string) =>
    path === "/" ? "https://heymoa.app" : `https://heymoa.app${path}`;

  it("마케팅 경로 목록과 가이드 주제 목록의 주소를 빠짐없이 한 번씩 싣는다", async () => {
    const { sitemap, pages, groups, topics, pathOf } = await load();
    const expected = [
      ...pages.map(({ path }) => path),
      ...groups.map(({ slug }) => `/help/${slug}`),
      ...topics.map(pathOf),
    ].map(absolute);
    const urls = sitemap().map((entry) => entry.url);

    expect(new Set(urls).size).toBe(urls.length);
    expect([...urls].sort()).toEqual([...expected].sort());
  });

  it("기본값에서는 영어 주소가 없고 한국어끼리만 대응한다", async () => {
    const { sitemap } = await load();
    const entries = sitemap();

    expect(entries.some((entry) => entry.url.includes("/en"))).toBe(false);
    expect(entries[0].alternates).toEqual({
      languages: { ko: "https://heymoa.app" },
    });
  });

  it("PUBLISHED_LOCALES=ko,en 이면 영어판을 싣고 서로를 대응으로 단다", async () => {
    const { sitemap } = await load("ko,en");
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
        },
      });
    }
  });
});
