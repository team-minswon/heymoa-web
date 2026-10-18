import Link from "next/link";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HelpAnalytics } from "@/components/help/help-analytics";
import { HelpClip } from "@/components/help/help-clip";
import { track } from "@/lib/analytics/track";

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/help/record/recording",
}));

describe("가이드 이벤트", () => {
  beforeEach(() => {
    vi.mocked(track).mockClear();
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
    });
    fireEvent.click(screen.getByRole("link", { name: "목차" }));
    expect(track).toHaveBeenLastCalledWith("help_nav_clicked", {
      from_slug: "recording",
      to_slug: "start",
      surface: "toc",
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
    });
  });

  it("영상은 확대할 때 클립 이름과 slug 만 보낸다", () => {
    render(<HelpClip name="desktop-menubar" alt="설명" />);
    fireEvent.click(screen.getByRole("button", { name: "설명 — 크게 보기" }));
    expect(track).toHaveBeenCalledWith("help_clip_zoomed", {
      clip: "desktop-menubar",
      slug: "recording",
    });
  });
});
