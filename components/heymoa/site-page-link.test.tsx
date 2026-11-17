import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SitePageLink } from "@/components/heymoa/site-page-link";

afterEach(() => {
  cleanup();
  delete (window as { heymoaDesktop?: unknown }).heymoaDesktop;
});

describe("SitePageLink", () => {
  it("브라우저에서는 새 탭으로 연다", () => {
    render(<SitePageLink href="/help#trouble">도움말</SitePageLink>);

    expect(screen.getByRole("link", { name: "도움말" })).toHaveAttribute("target", "_blank");
  });

  it("데스크톱 앱에서는 앱 안에서 이동한다", () => {
    (window as { heymoaDesktop?: unknown }).heymoaDesktop = {};

    render(<SitePageLink href="/help#trouble">도움말</SitePageLink>);

    expect(screen.getByRole("link", { name: "도움말" })).not.toHaveAttribute("target");
  });

  it("데스크톱 앱에서 녹음 중이면 누름을 막는다", () => {
    (window as { heymoaDesktop?: unknown }).heymoaDesktop = {};
    const hold = (event: Event) => event.preventDefault();
    window.addEventListener("beforeunload", hold);
    render(<SitePageLink href="/help">도움말</SitePageLink>);

    try {
      const allowed = fireEvent.click(screen.getByRole("link", { name: "도움말" }));
      expect(allowed).toBe(false);
    } finally {
      window.removeEventListener("beforeunload", hold);
    }
  });
});


it("새 앱의 본문 가이드 링크도 녹음 화면을 떠나지 않고 외부로 연다", () => {
  const open = vi.fn().mockResolvedValue(undefined);
  (window as { heymoaDesktop?: unknown }).heymoaDesktop = { openSitePage: open };
  render(<SitePageLink href="/en/help/start/desktop">Guide</SitePageLink>);
  expect(fireEvent.click(screen.getByRole("link", { name: "Guide" }))).toBe(false);
  expect(open).toHaveBeenCalledWith("/en/help/start/desktop");
});
