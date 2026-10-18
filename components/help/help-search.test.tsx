import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import { HelpSearch } from "@/components/help/help-search";

function setup() {
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

const input = () =>
  screen.getByRole("searchbox", { name: "사용 가이드에서 찾기" });
const settle = () => act(() => void vi.advanceTimersByTime(700));

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
  });

  it("검색어가 없으면 본문을 건드리지 않고 안내만 보인다", () => {
    const { container } = setup();
    expect(container.querySelector("article")?.innerHTML).toContain(
      "녹음을 시작합니다"
    );
    expect(screen.getByText("를 눌러 찾기")).toBeInTheDocument();
  });

  it("입력하면 개수를 보이고 Enter / Shift+Enter 로 순환한다", () => {
    setup();
    fireEvent.change(input(), { target: { value: "녹음" } });
    settle();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.keyDown(input(), { key: "Enter", shiftKey: true });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    // 개수는 타이핑이 멎은 뒤 한 번만 알린다
    settle();
    expect(screen.getByRole("status")).toHaveTextContent("일치하는 내용 2개");
  });

  it("한글 조합 중의 Enter 는 이동하지 않는다", () => {
    setup();
    fireEvent.change(input(), { target: { value: "녹음" } });
    settle();
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("일치가 없으면 안내하고 목차는 그대로 둔다", () => {
    setup();
    fireEvent.change(input(), { target: { value: "없는낱말" } });
    settle();
    expect(screen.getByText(/다른 낱말로 찾아보세요/)).toBeInTheDocument();
    expect(document.querySelector("[data-miss]")).toBeNull();
  });

  it("일치가 없는 조항의 목차 항목을 흐리게 표시한다", () => {
    setup();
    fireEvent.change(input(), { target: { value: "요약" } });
    settle();
    expect(document.querySelector('a[href="#a"]')).toHaveAttribute("data-miss");
    expect(document.querySelector('a[href="#b"]')).not.toHaveAttribute(
      "data-miss"
    );
  });

  it("Esc 는 검색어를 지우고, 비었으면 입력을 벗어난다", () => {
    setup();
    fireEvent.change(input(), { target: { value: "녹음" } });
    settle();
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input()).toHaveValue("");
    settle();
    expect(screen.getByText("를 눌러 찾기")).toBeInTheDocument();
  });

  it("/ 는 입력 중이 아닐 때만 검색에 포커스를 준다", () => {
    setup();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(input()).toHaveFocus();
    input().blur();
    const other = document.createElement("input");
    document.body.append(other);
    other.focus();
    fireEvent.keyDown(other, { key: "/" });
    expect(input()).not.toHaveFocus();
    other.remove();
  });
});
