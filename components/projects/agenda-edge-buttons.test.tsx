import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EdgeButtons } from "@/components/projects/agenda-edge-buttons";

function Board({ reduced = false }: { reduced?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <EdgeButtons scroller={ref} reduced={reduced} />
      <div ref={ref} data-testid="scroller">
        <div />
      </div>
    </div>
  );
}

/** jsdom 은 레이아웃이 없다 — 가로 스크롤 상자처럼 보이게 크기와 위치를 심는다 */
const setup = (scroller: HTMLElement, { width, view, left }: { width: number; view: number; left: number }) => {
  Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: width });
  Object.defineProperty(scroller, "clientWidth", { configurable: true, value: view });
  Object.defineProperty(scroller, "scrollLeft", { configurable: true, writable: true, value: left });
  scroller.scrollBy = vi.fn();
};
const frames = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 30))));

describe("EdgeButtons", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      }
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows nothing when the board does not overflow", async () => {
    const view = render(<Board />);
    setup(screen.getByTestId("scroller"), { width: 600, view: 600, left: 0 });
    view.rerender(<Board />);
    await frames();
    expect(screen.queryByLabelText("왼쪽으로")).toBeNull();
    expect(screen.queryByLabelText("오른쪽으로")).toBeNull();
  });

  it("keeps the direction it can still move always visible, fades the other, and moves 80% of the width per press", async () => {
    render(<Board />);
    const scroller = screen.getByTestId("scroller");
    setup(scroller, { width: 2000, view: 500, left: 0 });
    fireEvent.scroll(scroller);
    await frames();
    // 더 갈 수 있는 쪽은 포인터와 상관없이 늘 보이고, 더 갈 수 없는 쪽은 투명 + 눌리지도 포커스되지도 않는다(inert)
    const [left, right] = [screen.getByLabelText("왼쪽으로"), screen.getByLabelText("오른쪽으로")];
    expect(right.className).toContain("opacity-100");
    expect(left.className).toContain("opacity-0");
    expect(left.parentElement?.hasAttribute("inert")).toBe(true);
    expect(right.parentElement?.hasAttribute("inert")).toBe(false);
    fireEvent.click(right);
    expect(scroller.scrollBy).toHaveBeenCalledWith({ left: 400, behavior: "smooth" });

    // 가운데로 가면 둘 다, 끝에 닿으면 오른쪽이 사라진다
    scroller.scrollLeft = 700;
    fireEvent.scroll(scroller);
    await frames();
    expect(left.className).toContain("opacity-100");
    expect(right.className).toContain("opacity-100");
    scroller.scrollLeft = 1500;
    fireEvent.scroll(scroller);
    await frames();
    expect(right.className).toContain("opacity-0");
    expect(right.parentElement?.hasAttribute("inert")).toBe(true);
    fireEvent.click(left);
    expect(scroller.scrollBy).toHaveBeenLastCalledWith({ left: -400, behavior: "smooth" });
  });

  it("follows vertical scroll with CSS sticky only and takes no layout space", async () => {
    const view = render(<Board />);
    const scroller = screen.getByTestId("scroller");
    setup(scroller, { width: 2000, view: 500, left: 700 });
    fireEvent.scroll(scroller);
    await frames();
    const rail = view.container.querySelector("[data-edge-buttons]") as HTMLElement;
    expect(rail.className).toContain("sticky");
    // 높이가 없는 줄이라 레이아웃 공간을 쓰지 않는다
    expect(rail.style.marginBottom).toBe("-32px");
    // 스크롤마다 위치를 옮기는 인라인 변환이 없다
    expect(rail.style.transform).toBe("");
  });

  it("moves at once when motion is reduced", async () => {
    render(<Board reduced />);
    const scroller = screen.getByTestId("scroller");
    setup(scroller, { width: 2000, view: 500, left: 0 });
    fireEvent.scroll(scroller);
    await frames();
    fireEvent.click(screen.getByLabelText("오른쪽으로"));
    expect(scroller.scrollBy).toHaveBeenCalledWith({ left: 400, behavior: "auto" });
  });
});
