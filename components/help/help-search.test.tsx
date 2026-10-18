import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import { HelpSearch } from "@/components/help/help-search";

function setup(q = "녹음") {
  window.history.replaceState(null, "", q ? `/?q=${encodeURIComponent(q)}` : "/");
  return render(
    <>
      <nav>
        <a href="#a" data-toc-link>
          가
        </a>
        <a href="#b" data-toc-link>
          나
        </a>
      </nav>
      <HelpSearch targetId="body" />
      <article id="body">
        <section id="a">
          <p>녹음을 시작합니다. 녹음을 멈춥니다.</p>
        </section>
        <section id="b">
          <p>요약을 봅니다.</p>
        </section>
      </article>
    </>
  );
}

const settle = () => act(() => void vi.advanceTimersByTime(700));
const bar = () => screen.queryByRole("search", { name: "본문에서 일치하는 곳" });

describe("HelpSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
    Range.prototype.getBoundingClientRect = () =>
      ({ top: 200, bottom: 220 }) as DOMRect;
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
    })) as never;
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.history.replaceState(null, "", "/");
  });

  it("검색어가 없으면 막대도 없고 본문을 건드리지 않는다", () => {
    const { container } = setup("");
    expect(bar()).toBeNull();
    expect(container.querySelector("article")?.innerHTML).toContain(
      "녹음을 시작합니다"
    );
  });

  it("?q= 로 들어오면 개수를 보이고 이전/다음으로 순환한다", () => {
    setup();
    settle();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음 일치" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음 일치" }));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "이전 일치" }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    // 개수는 한 번만 알린다
    settle();
    expect(screen.getByRole("status")).toHaveTextContent("일치하는 내용 2개");
  });

  it("일치가 없으면 안내하고 목차는 그대로 둔다", () => {
    setup("없는낱말");
    settle();
    expect(screen.getByText("일치하는 내용이 없어요")).toBeInTheDocument();
    expect(document.querySelector("[data-miss]")).toBeNull();
  });

  it("일치가 없는 조항의 목차 항목을 흐리게 표시한다", () => {
    setup("요약");
    settle();
    expect(document.querySelector('a[href="#a"]')).toHaveAttribute("data-miss");
    expect(document.querySelector('a[href="#b"]')).not.toHaveAttribute(
      "data-miss"
    );
  });

  it("닫기와 Esc 는 주소에서 검색어만 지운다", () => {
    setup();
    settle();
    fireEvent.click(screen.getByRole("button", { name: "검색 닫기" }));
    // 막대가 사라지는 것은 Next 가 주소 변화를 알릴 때(e2e)다 — 여기 목은 반응하지 않는다.
    expect(window.location.search).toBe("");
  });
});
