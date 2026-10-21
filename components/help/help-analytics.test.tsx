import Link from "next/link";
import {
  cleanup,
  fireEvent,
  render as rtlRender,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HelpAnalytics } from "@/components/help/help-analytics";
import { HelpClip } from "@/components/help/help-clip";
import { track } from "@/lib/analytics/track";
import { helpLocation } from "@/lib/help/analytics";
import { intlWrapper } from "@/components/help/test-intl";

/** 가이드 컴포넌트는 언어 파일을 읽는다 — 실제 마케팅 루트처럼 한국어 언어 파일을 내려 준다. */
const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: intlWrapper() });

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));
const nav = vi.hoisted(() => ({ pathname: "/help/record/recording" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

describe("가이드 이벤트", () => {
  beforeEach(() => {
    vi.mocked(track).mockClear();
    nav.pathname = "/help/record/recording";
    window.history.replaceState(null, "", "/help/record/recording");
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as never;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        disconnect() {}
      }
    );
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("페이지를 열면 slug · 그룹 · 진입 경로만 한 번 보낸다", () => {
    render(<HelpAnalytics />);
    expect(track).toHaveBeenCalledWith("help_page_viewed", {
      slug: "recording",
      group: "record",
      level: "topic",
      axis: "feature",
      entry: expect.stringMatching(/^(search|hub|internal|external|back)$/),
      language: "ko",
    });
  });

  // 영어판도 같은 주제로 센다 — 언어 접두사를 slug·group 으로 읽지 않고 language 로만 남긴다(PRO-66).
  it("영어판 주소는 한국어판과 같은 group · slug 에 language=en 으로 보낸다", () => {
    nav.pathname = "/en/help/start/desktop";
    window.history.replaceState(null, "", "/en/help/start/desktop");
    render(<HelpAnalytics />);
    expect(track).toHaveBeenCalledWith(
      "help_page_viewed",
      expect.objectContaining({
        slug: "desktop",
        group: "start",
        level: "topic",
        axis: "feature",
        language: "en",
      })
    );
  });

  it("helpLocation 은 언어 접두사를 떼고 같은 주제를 낸다", () => {
    expect(helpLocation("/en/help/start/desktop")).toEqual({
      ...helpLocation("/help/start/desktop"),
      language: "en",
    });
    expect(helpLocation("/help/start/desktop").language).toBe("ko");
    expect(helpLocation("/en/help")).toMatchObject({
      slug: "hub",
      level: "hub",
      language: "en",
    });
    expect(helpLocation("/en/help/situations")).toMatchObject({
      slug: "situations",
      level: "group",
      axis: "situation",
    });
  });

  it("data-help-nav 링크를 누르면 어디서 어디로 가는지 slug 만 보낸다", () => {
    render(
      <>
        <HelpAnalytics />
        <Link href="/help/record/speakers" data-help-nav="sidebar">
          화자
        </Link>
        <a href="#start" data-help-nav="toc">
          목차
        </a>
      </>
    );
    vi.mocked(track).mockClear();
    fireEvent.click(screen.getByRole("link", { name: "화자" }));
    expect(track).toHaveBeenCalledWith("help_nav_clicked", {
      from_slug: "recording",
      to_slug: "speakers",
      surface: "sidebar",
      language: "ko",
    });
    fireEvent.click(screen.getByRole("link", { name: "목차" }));
    expect(track).toHaveBeenLastCalledWith("help_nav_clicked", {
      from_slug: "recording",
      to_slug: "start",
      surface: "toc",
      language: "ko",
    });
  });

  it("FAQ 는 열릴 때만 센다", () => {
    render(
      <>
        <HelpAnalytics />
        <details data-help-faq="">
          <summary>질문</summary>답
        </details>
      </>
    );
    vi.mocked(track).mockClear();
    fireEvent.click(screen.getByText("질문"));
    expect(track).toHaveBeenCalledWith("help_faq_opened", {
      slug: "recording",
      index: 0,
      language: "ko",
    });
  });

  it("영상은 확대할 때 클립 이름과 slug 만 보낸다", () => {
    render(<HelpClip name="desktop-menubar" alt="설명" />);
    fireEvent.click(screen.getByRole("button", { name: "설명 — 크게 보기" }));
    expect(track).toHaveBeenCalledWith("help_clip_zoomed", {
      clip: "desktop-menubar",
      slug: "recording",
      language: "ko",
    });
  });
});
