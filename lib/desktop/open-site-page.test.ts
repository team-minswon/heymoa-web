import { afterEach, describe, expect, it, vi } from "vitest";

import { openSitePage } from "@/lib/desktop/open-site-page";

const asDesktop = () => {
  (window as { heymoaDesktop?: unknown }).heymoaDesktop = {};
};

afterEach(() => {
  delete (window as { heymoaDesktop?: unknown }).heymoaDesktop;
  vi.restoreAllMocks();
});

describe("openSitePage", () => {
  it("브라우저에서는 새 탭으로 연다", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const navigate = vi.fn();

    openSitePage("/help#trouble", navigate);

    expect(open).toHaveBeenCalledWith("/help#trouble", "_blank", "noopener,noreferrer");
    expect(navigate).not.toHaveBeenCalled();
  });

  // 데스크톱 앱은 같은 사이트 주소의 새 창을 막고 외부 브라우저로도 넘기지 않는다
  it("데스크톱 앱에서는 앱 안에서 이동한다", () => {
    asDesktop();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const navigate = vi.fn();

    openSitePage("/help", navigate);

    expect(open).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/help");
  });
});
