import { cleanup, render as rtlRender, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { helpGroups } from "@/app/[lang]/help/_content/groups";
import { helpPathOf } from "@/app/[lang]/help/_content/paths";
import {
  helpGroupsFor,
  helpTopics,
  helpTopicsFor,
  situationClustersFor,
} from "@/app/[lang]/help/_content/topics";
import HelpGroupPage from "@/app/[lang]/help/[group]/page";
import HelpTopicPage, {
  generateMetadata,
} from "@/app/[lang]/help/[group]/[page]/page";
import HelpHubPage from "@/app/[lang]/help/page";
import { GET } from "@/app/[lang]/help/search-index.json/route";
import { intlWrapper } from "@/components/help/test-intl";
import { textOf } from "@/lib/help/text";
import { buildHelpIndex, searchHelp } from "@/lib/help/search-index";

// 영어판(`/en/help/...`)을 그린다. 루트 레이아웃의 root param 이 `en` 이다.
vi.mock("next/root-params", () => ({ lang: async () => "en" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/help",
  notFound: () => {
    throw new Error("not-found");
  },
}));

const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: intlWrapper("en") });

const HANGUL = /[가-힣ㄱ-ㆎ]/;
const en = helpTopicsFor("en");

/** 화면에 보이는 글과 접근성 이름(aria-label · alt · title)에 한글이 있는 곳. */
function hangulIn(container: HTMLElement) {
  const found: string[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest("script")) continue;
    if (HANGUL.test(node.textContent ?? ""))
      found.push(node.textContent!.trim());
  }
  for (const el of container.querySelectorAll(
    "[aria-label], [alt], [title], [placeholder]"
  )) {
    for (const name of ["aria-label", "alt", "title", "placeholder"]) {
      const value = el.getAttribute(name);
      if (value && HANGUL.test(value)) found.push(`${name}=${value}`);
    }
  }
  return found;
}

describe("사용 가이드 영어판", () => {
  afterEach(cleanup);

  // 주소 · 섹션 id 가 언어판끼리 같아야 언어 전환과 바깥 `#id` 링크가 같은 곳으로 간다.
  it("한국어판과 같은 주제 · 순서 · 섹션 id 를 갖는다", () => {
    expect(en.map(helpPathOf)).toEqual(helpTopics.map(helpPathOf));
    for (const [i, topic] of en.entries()) {
      const ko = helpTopics[i];
      expect(
        topic.sections.map((s) => s.id),
        topic.slug
      ).toEqual(ko.sections.map((s) => s.id));
      expect(topic.badge, topic.slug).toBe(ko.badge);
      expect(Boolean(topic.howTo), topic.slug).toBe(Boolean(ko.howTo));
      expect(topic.related, topic.slug).toEqual(ko.related);
      expect(Boolean(topic.navTitle), topic.slug).toBe(Boolean(ko.navTitle));
    }
  });

  it("제목 · 설명 · 그룹 · 묶음 이름에 한글이 없고 길이가 검색 결과에 맞다", () => {
    for (const topic of en) {
      const title = `${topic.title} · HeyMoa Guide`;
      expect(title.length, topic.slug).toBeLessThanOrEqual(60);
      expect(topic.summary.length, topic.slug).toBeGreaterThanOrEqual(50);
      expect(topic.summary.length, topic.slug).toBeLessThanOrEqual(170);
      for (const text of [topic.title, topic.summary, topic.navTitle ?? ""])
        expect(text, topic.slug).not.toMatch(HANGUL);
      if (topic.badge)
        expect(topic.navTitle ?? topic.title, topic.slug).not.toMatch(
          /desktop/i
        );
    }
    for (const group of helpGroupsFor("en"))
      expect(`${group.title} ${group.summary}`).not.toMatch(HANGUL);
    for (const cluster of situationClustersFor("en"))
      expect(cluster.title).not.toMatch(HANGUL);
  });

  it("모든 주제가 영어 본문으로 열리고 한글이 남지 않는다", async () => {
    for (const topic of en) {
      const params = Promise.resolve({ group: topic.group, page: topic.slug });
      const { container } = render(await HelpTopicPage({ params }));
      expect(container.querySelector("h1")?.textContent, topic.slug).toBe(
        topic.title
      );
      expect(hangulIn(container), topic.slug).toEqual([]);
      // 가이드 안 링크는 영어판 주소로 풀린다
      for (const a of container.querySelectorAll<HTMLAnchorElement>(
        "a[href^='/help']"
      ))
        throw new Error(
          `${topic.slug}: 한국어판 링크 ${a.getAttribute("href")}`
        );
      cleanup();
    }
  });

  it("허브와 그룹 소개가 영어로 열리고 링크가 /en 아래다", async () => {
    const hub = render(await HelpHubPage());
    expect(
      screen.getByRole("heading", { name: "HeyMoa Guide", level: 1 })
    ).toBeInTheDocument();
    // 대시보드가 아직 한국어라는 안내가 첫 화면에 한 줄 선다
    expect(hub.container.querySelector("[data-help-ui-note]")).not.toBeNull();
    expect(hangulIn(hub.container)).toEqual([]);
    for (const topic of en)
      expect(
        hub.container.querySelector(`a[href="/en${helpPathOf(topic)}"]`),
        topic.slug
      ).not.toBeNull();
    cleanup();
    for (const group of helpGroups) {
      const { container } = render(
        await HelpGroupPage({ params: Promise.resolve({ group: group.slug }) })
      );
      expect(hangulIn(container), group.slug).toEqual([]);
      cleanup();
    }
  });

  it("영어판 metadata 는 자기 주소가 canonical 이고 noindex 없이 ko·en hreflang 을 단다", async () => {
    const topic = en[0];
    const meta = await generateMetadata({
      params: Promise.resolve({ group: topic.group, page: topic.slug }),
    });
    expect(meta.alternates?.canonical).toBe(`/en${helpPathOf(topic)}`);
    expect(meta.title).toEqual({ absolute: `${topic.title} · HeyMoa Guide` });
    // 페이지가 robots 를 내지 않는다 — 영어판이 색인 대상이다(비운영 배포의 noindex 는 루트 레이아웃이 건다).
    expect(meta.robots).toBeUndefined();
    expect(meta.alternates?.languages).toEqual({
      ko: helpPathOf(topic),
      en: `/en${helpPathOf(topic)}`,
      "x-default": helpPathOf(topic),
    });
    expect(meta.openGraph).toMatchObject({ locale: "en_US" });
  });

  it("문제 해결 영어판도 증상과 해결 방법으로 FAQ 를 낸다", () => {
    const fix = en.find((t) => t.slug === "troubleshooting")!;
    expect(fix.faq?.length).toBe(
      helpTopics.find((t) => t.slug === "troubleshooting")!.faq?.length
    );
    for (const q of fix.faq!) expect(q.question + q.answer).not.toMatch(HANGUL);
  });
});

describe("영어판 검색 색인", () => {
  it("색인 라우트가 언어별로 따로 나오고 결과 주소가 그 언어판이다", async () => {
    const get = async (lang: string) =>
      (await (
        await GET(new Request("http://x"), {
          params: Promise.resolve({ lang }),
        })
      ).json()) as { path: string; text: string }[];
    const [ko, enIndex] = [await get("ko"), await get("en")];
    expect(enIndex.every((e) => e.path.startsWith("/en/help/"))).toBe(true);
    expect(ko.every((e) => e.path.startsWith("/help/"))).toBe(true);
    // 한국어 결과가 섞이지 않는다
    expect(enIndex.filter((e) => HANGUL.test(e.text))).toEqual([]);
  });

  it("영어 낱말로 영어 결과와 /en 링크를 낸다", () => {
    const entries = buildHelpIndex(
      en,
      (t) => (t.group === "situations" ? "situation" : "feature"),
      "en"
    );
    const hits = searchHelp(entries, "glossary");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.path.startsWith("/en/help/"))).toBe(true);
    expect(searchHelp(entries, "용어 사전")).toEqual([]);
  });

  it("본문 글이 색인에 든다", () => {
    const text = en.flatMap((t) =>
      t.sections.flatMap((s) => s.body.map(textOf))
    );
    expect(text.join(" ").length).toBeGreaterThan(20000);
  });
});
