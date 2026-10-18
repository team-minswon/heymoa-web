import { afterEach, describe, expect, it, vi } from "vitest";

import { goSamePage, scrollToSection } from "@/lib/help/scroll";

const setup = () => {
  document.body.innerHTML = `<section id="a"><div data-help-heading><h2>가</h2></div></section>`;
  const section = document.getElementById("a")!;
  section.scrollIntoView = vi.fn();
  return section;
};

describe("가이드 같은 페이지 이동", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
  });

  it("스크롤하고 주소만 바꾸며 제목에 포커스를 둔다", () => {
    const section = setup();
    scrollToSection("a");
    expect(section.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: "start" })
    );
    expect(window.location.hash).toBe("#a");
    expect(document.activeElement?.tagName).toBe("H2");
  });

  it("이미 도착한 자리면 아무것도 하지 않는다", () => {
    const section = setup();
    window.history.replaceState(null, "", "/#a");
    scrollToSection("a"); // jsdom 은 top 0, scroll-margin 0 이라 도착한 자리다
    expect(section.scrollIntoView).not.toHaveBeenCalled();
  });

  it("다른 경로면 처리하지 않는다", () => {
    setup();
    expect(goSamePage("/help/x#a")).toBe(false);
  });
});
