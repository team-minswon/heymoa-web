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

// 공개 정적 페이지가 사이트맵에 빠지면 Search Console 이 늦게 찾는다(APP-1036)
describe("사이트맵", () => {
  it("공개 페이지를 운영 주소로 싣는다", async () => {
    vi.resetModules();
    const sitemap = (await import("@/app/sitemap")).default;

    expect(sitemap().map((entry) => entry.url)).toEqual([
      "https://heymoa.app",
      "https://heymoa.app/download",
      "https://heymoa.app/help",
      "https://heymoa.app/help/start",
      "https://heymoa.app/help/record",
      "https://heymoa.app/help/summary",
      "https://heymoa.app/help/team",
      "https://heymoa.app/help/connect",
      "https://heymoa.app/help/fix",
      "https://heymoa.app/help/situations",
      "https://heymoa.app/help/start/getting-started",
      "https://heymoa.app/help/start/workspace-basics",
      "https://heymoa.app/help/start/account",
      "https://heymoa.app/help/start/desktop",
      "https://heymoa.app/help/record/recording",
      "https://heymoa.app/help/record/speakers",
      "https://heymoa.app/help/record/terms-context",
      "https://heymoa.app/help/record/live-timeline",
      "https://heymoa.app/help/summary/meeting-end",
      "https://heymoa.app/help/summary/review",
      "https://heymoa.app/help/summary/export",
      "https://heymoa.app/help/team/tasks",
      "https://heymoa.app/help/team/agent",
      "https://heymoa.app/help/team/members",
      "https://heymoa.app/help/team/feedback",
      "https://heymoa.app/help/connect/integrations",
      "https://heymoa.app/help/connect/agent-mcp",
      "https://heymoa.app/help/fix/troubleshooting",
      "https://heymoa.app/help/fix/limits",
      "https://heymoa.app/help/situations/first-meeting",
      "https://heymoa.app/help/situations/summary-missing",
      "https://heymoa.app/help/situations/confirm-summary",
      "https://heymoa.app/help/situations/fix-speakers",
      "https://heymoa.app/help/situations/invite-team",
      "https://heymoa.app/help/situations/fix-terms",
      "https://heymoa.app/help/situations/assign-tasks",
      "https://heymoa.app/help/situations/find-decisions",
      "https://heymoa.app/help/situations/record-call-audio",
      "https://heymoa.app/help/situations/desktop-no-audio",
      "https://heymoa.app/help/situations/use-mcp",
      "https://heymoa.app/help/situations/data-privacy",
      "https://heymoa.app/terms",
      "https://heymoa.app/privacy",
    ]);
  });
});
