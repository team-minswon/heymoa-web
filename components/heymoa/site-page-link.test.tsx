import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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

  // 데스크톱 앱은 같은 사이트 주소의 새 창을 막고 외부 브라우저로도 넘기지 않는다 — 새 탭이면 아무 일도 없다
  it("데스크톱 앱에서는 앱 안에서 이동한다", () => {
    (window as { heymoaDesktop?: unknown }).heymoaDesktop = {};

    render(<SitePageLink href="/help#trouble">도움말</SitePageLink>);

    expect(screen.getByRole("link", { name: "도움말" })).not.toHaveAttribute("target");
  });

  // 사이트 페이지는 다른 루트 레이아웃이라 전체 로드다 — 녹음이 이탈을 거부하면 앱은 말없이 취소한다
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
