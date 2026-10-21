import { cleanup, render as rtlRender, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { helpGroups, situationClusters } from "@/app/[lang]/help/_content/groups";
import { HELP_PAGES } from "@/app/[lang]/help/_content/ids";
import { LEGACY_HELP_ANCHORS } from "@/app/[lang]/help/_content/legacy-anchors";
import {
  helpPathOf,
  helpTopicByPath,
} from "@/app/[lang]/help/_content/paths";
import { helpTopics } from "@/app/[lang]/help/_content/topics";
import HelpGroupPage, {
  generateStaticParams as groupParams,
} from "@/app/[lang]/help/[group]/page";
import HelpTopicPage, {
  generateMetadata,
  generateStaticParams,
} from "@/app/[lang]/help/[group]/[page]/page";
import HelpHubPage from "@/app/[lang]/help/page";
import { buildHelpIndex, searchHelp } from "@/lib/help/search-index";
import { intlWrapper } from "@/components/help/test-intl";

/** 가이드 컴포넌트는 언어 파일을 읽는다 — 실제 마케팅 루트처럼 한국어 언어 파일을 내려 준다. */
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: intlWrapper() });

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/help",
  notFound: () => {
    throw new Error("not-found");
  },
}));

describe("도움말 페이지", () => {
  afterEach(cleanup);

  // 앱 안 링크(`HelpLink`)와 옛 앵커가 쓰는 id → 그룹 표가 실제 페이지 목록과 같아야 한다
  it("id · 그룹 표가 페이지 목록과 일치한다", () => {
    expect(
      Object.fromEntries(helpTopics.map((t) => [t.slug, t.group]))
    ).toEqual(HELP_PAGES);
    expect(generateStaticParams().map((p) => `${p.group}/${p.page}`)).toEqual(
      helpTopics.map((t) => `${t.group}/${t.slug}`)
    );
    for (const topic of helpTopics) {
      expect(
        helpGroups.some((g) => g.slug === topic.group),
        topic.slug
      ).toBe(true);
    }
    expect(groupParams().map((p) => p.group)).toEqual(
      helpGroups.map((g) => g.slug)
    );
  });

  // 상황별 사이드바는 짧은 이름(navTitle)을 묶음 제목 아래에 낸다 — 한 줄에 들어가게, 모든 상황이 정확히 한 묶음에.
  it("상황별 페이지는 모두 한 묶음에 들고 짧고 겹치지 않는 navTitle 이 있다", () => {
    const situations = helpTopics.filter((t) => t.group === "situations");
    const clustered = situationClusters.flatMap((c) => c.pages);
    expect([...clustered].sort()).toEqual(situations.map((t) => t.slug).sort());
    const names = situations.map((t) => t.navTitle);
    for (const topic of situations) {
      expect(topic.navTitle, topic.slug).toBeTruthy();
      expect(topic.navTitle!.length, topic.slug).toBeLessThanOrEqual(14);
      expect(topic.navTitle).not.toBe(topic.title);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  // 데스크톱 앱 전용 페이지만 알약을 붙이고, 붙인 페이지의 라벨에는 「데스크톱」이 또 나오지 않는다.
  it("badge 는 데스크톱 앱 전용 페이지에만 있고 라벨과 겹치지 않는다", () => {
    const badged = helpTopics.filter((t) => t.badge);
    expect(badged.map((t) => t.slug).sort()).toEqual(["desktop", "desktop-no-audio"]);
    for (const topic of badged) {
      expect(topic.badge).toBe("desktop");
      expect(topic.navTitle ?? topic.title, topic.slug).not.toContain("데스크톱");
    }
  });

  it("페이지 id 는 사이트 안에서 겹치지 않고 그룹 slug 와도 겹치지 않는다", () => {
    const ids = helpTopics.map((t) => t.slug);
    expect(new Set(ids).size).toBe(ids.length);
    for (const group of helpGroups) expect(ids).not.toContain(group.slug);
  });

  it("페이지 안 섹션 id 는 겹치지 않는다", () => {
    for (const topic of helpTopics) {
      const ids = topic.sections.map((s) => s.id);
      expect(new Set(ids).size, topic.slug).toBe(ids.length);
    }
  });

  // 한 장짜리 시절 `/help#id` 링크가 새 주소로 간다(APP-1024 앵커). 키를 지우면 이미 퍼진 링크가 깨진다.
  it("옛 앵커가 모두 실제 페이지로 간다", () => {
    expect(Object.keys(LEGACY_HELP_ANCHORS).sort()).toEqual(
      [
        "agents",
        "context",
        "desktop",
        "feedback",
        "integrations",
        "recording",
        "speakers",
        "start",
        "summary",
        "tasks",
        "trouble",
      ].sort()
    );
    const paths = new Set(helpTopics.map(helpPathOf));
    for (const target of Object.values(LEGACY_HELP_ANCHORS)) {
      expect(paths.has(target), target).toBe(true);
    }
  });

  it("페이지마다 h1 은 하나, 제목은 페이지 이름이고 메타가 고유하다", async () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const topic of helpTopics) {
      const params = Promise.resolve({ group: topic.group, page: topic.slug });
      const { container } = render(await HelpTopicPage({ params }));
      expect(container.querySelectorAll("h1"), topic.slug).toHaveLength(1);
      expect(container.querySelector("h1")?.textContent).toBe(topic.title);
      cleanup();
      const meta = await generateMetadata({ params });
      expect(meta.alternates?.canonical).toBe(helpPathOf(topic));
      const title = (meta.title as { absolute: string }).absolute;
      expect(title).toMatch(/ · HeyMoa\(헤이모아\) 사용법$/);
      titles.add(title);
      descriptions.add(String(meta.description));
    }
    expect(titles.size).toBe(helpTopics.length);
    expect(descriptions.size).toBe(helpTopics.length);
  });

  // 검색 결과에 잘리지 않도록: 제목은 60자 안팎, 설명은 한 문장~두 문장(120자 안팎)
  it("제목과 설명의 길이가 검색 결과에 맞다", () => {
    for (const topic of helpTopics) {
      const title = `${topic.title} · HeyMoa(헤이모아) 사용법`;
      expect(
        title.length,
        `${topic.slug} 제목 ${title.length}`
      ).toBeLessThanOrEqual(60);
      expect(
        topic.summary.length,
        `${topic.slug} 설명 ${topic.summary.length}`
      ).toBeLessThanOrEqual(120);
      expect(topic.summary.length, topic.slug).toBeGreaterThanOrEqual(40);
    }
  });

  it("문제 해결 페이지는 본문에 있는 질문과 답만 FAQ 로 낸다", async () => {
    const topic = helpTopicByPath("fix", "troubleshooting")!;
    const params = Promise.resolve({ group: topic.group, page: topic.slug });
    const { container } = render(await HelpTopicPage({ params }));
    const faq = [
      ...container.querySelectorAll('script[type="application/ld+json"]'),
    ]
      .map((el) => JSON.parse(el.textContent!))
      .find((d) => d["@type"] === "FAQPage");
    expect(faq.mainEntity.length).toBeGreaterThan(2);
    for (const q of faq.mainEntity)
      expect(container.textContent).toContain(q.acceptedAnswer.text);
  });

  it("단계가 있는 페이지는 HowTo 만 내고 FAQ 를 겹쳐 내지 않는다", async () => {
    for (const topic of helpTopics.filter((t) => t.howTo)) {
      const params = Promise.resolve({ group: topic.group, page: topic.slug });
      const { container } = render(await HelpTopicPage({ params }));
      const types = [
        ...container.querySelectorAll('script[type="application/ld+json"]'),
      ].map((el) => JSON.parse(el.textContent!)["@type"]);
      expect(types, topic.slug).toContain("HowTo");
      expect(types, topic.slug).not.toContain("FAQPage");
      cleanup();
    }
  });

  it("그룹 소개는 그 그룹의 페이지 카드를 낸다", async () => {
    for (const group of helpGroups) {
      const { container } = render(
        await HelpGroupPage({ params: Promise.resolve({ group: group.slug }) })
      );
      expect(container.querySelectorAll("h1")).toHaveLength(1);
      for (const topic of helpTopics.filter((t) => t.group === group.slug)) {
        expect(
          container.querySelector(`a[href="${helpPathOf(topic)}"]`),
          topic.slug
        ).not.toBeNull();
      }
      cleanup();
    }
  });

  it("허브는 모든 페이지로 가는 링크와 검색칸을 낸다", async () => {
    render(await HelpHubPage());
    expect(
      screen.getByRole("heading", { name: "HeyMoa(헤이모아) 사용법", level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "사용 가이드 전체에서 찾기" })
    ).toBeInTheDocument();
    for (const topic of helpTopics) {
      expect(
        document.querySelector(`a[href="${helpPathOf(topic)}"]`),
        topic.slug
      ).not.toBeNull();
    }
  });
});

describe("도움말 검색 색인", () => {
  const entries = buildHelpIndex(helpTopics, (t) =>
    t.group === "situations" ? "situation" : "feature"
  );

  it("공백·대소문자를 무시하고 섹션마다 한 건으로 묶는다", () => {
    const hits = searchHelp(entries, "용어 사전");
    expect(
      hits.some(
        (h) => h.path.endsWith("/terms-context") && h.sectionId === "dictionary"
      )
    ).toBe(true);
    expect(new Set(hits.map((h) => `${h.path}#${h.sectionId}`)).size).toBe(
      hits.length
    );
    const hit = hits[0];
    expect(hit.excerpt.slice(hit.from, hit.to).replace(/\s/g, "")).toBe(
      "용어사전"
    );
  });

  it("페이지 제목으로도 그 페이지가 찾아진다", () => {
    const hits = searchHelp(entries, "이름이 잘못 나온 화자를 고치고 싶어요");
    expect(hits.some((h) => h.path.endsWith("/fix-speakers"))).toBe(true);
  });

  it("링크 속 글자도 색인에 든다", () => {
    expect(searchHelp(entries, "다운로드 페이지").length).toBeGreaterThan(0);
  });

  it("일치가 없거나 검색어가 비면 빈 목록이다", () => {
    expect(searchHelp(entries, "없는낱말zzz")).toEqual([]);
    expect(searchHelp(entries, "  ")).toEqual([]);
  });
});
