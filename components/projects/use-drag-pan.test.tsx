import { cleanup, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDragPan } from "@/components/projects/use-drag-pan";

function Board({ onClick, onStart }: { onClick: () => void; onStart?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDragPan(ref, { onStart });
  return (
    <div ref={ref} data-testid="board">
      <button type="button" onClick={onClick}>
        dot
      </button>
    </div>
  );
}

const mouse = (clientX: number, clientY: number) => ({ clientX, clientY, button: 0, pointerType: "mouse", pointerId: 1 });
/** jsdom 은 레이아웃이 없다 — 가로로 넘치는 판처럼 보이게 크기를 심는다 */
const overflowing = (board: HTMLElement) => {
  Object.defineProperty(board, "scrollWidth", { configurable: true, value: 1600 });
  Object.defineProperty(board, "clientWidth", { configurable: true, value: 600 });
  board.setPointerCapture = vi.fn();
  board.hasPointerCapture = () => false;
};

describe("useDragPan", () => {
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

  it("lets a press that barely moves through as a normal click", () => {
    const onClick = vi.fn();
    const { getByText, getByTestId } = render(<Board onClick={onClick} />);
    overflowing(getByTestId("board"));
    const dot = getByText("dot");
    fireEvent.pointerDown(dot, mouse(100, 100));
    fireEvent.pointerMove(window, mouse(103, 102));
    fireEvent.pointerUp(window, mouse(103, 102));
    fireEvent.click(dot);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("scrolls from where the threshold was crossed (no jump), swallows the click that follows once, then lets the next one through", async () => {
    const onClick = vi.fn();
    const onStart = vi.fn();
    const { getByText, getByTestId } = render(<Board onClick={onClick} onStart={onStart} />);
    const board = getByTestId("board");
    overflowing(board);
    const dot = getByText("dot");
    board.scrollLeft = 200;
    fireEvent.pointerDown(dot, mouse(300, 100));
    // 문턱(5px)을 막 넘은 첫 움직임: 내용이 튀지 않는다
    fireEvent.pointerMove(window, mouse(294, 100));
    expect(board.hasAttribute("data-panning")).toBe(true);
    expect(board.scrollLeft).toBe(200);
    fireEvent.pointerMove(window, mouse(254, 100));
    expect(board.scrollLeft).toBe(240);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-pan-cursor]")).not.toBeNull();
    fireEvent.pointerUp(window, mouse(254, 100));
    expect(board.hasAttribute("data-panning")).toBe(false);
    expect(document.querySelector("[data-pan-cursor]")).toBeNull();
    fireEvent.click(dot);
    expect(onClick).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 5));
    fireEvent.click(dot);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows a grab cursor only when it can move, and does not start otherwise", () => {
    const { getByText, getByTestId } = render(<Board onClick={() => {}} />);
    const board = getByTestId("board");
    // 넘치지 않는 판(가로 스크롤 없음, 세로 부모도 없음)
    expect(board.style.cursor).toBe("default");
    fireEvent.pointerDown(getByText("dot"), mouse(0, 0));
    fireEvent.pointerMove(window, mouse(80, 0));
    expect(board.hasAttribute("data-panning")).toBe(false);
    fireEvent.pointerUp(window, mouse(80, 0));
    // 가로로 넘치면 grab
    overflowing(board);
    fireEvent.pointerEnter(board);
    expect(board.style.cursor).toBe("grab");
  });

  it("keeps to the dominant axis: a mostly horizontal diagonal drag never changes the vertical scroll", () => {
    const { getByText, getByTestId } = render(<Board onClick={() => {}} />);
    const board = getByTestId("board");
    overflowing(board);
    board.scrollLeft = 500;
    fireEvent.pointerDown(getByText("dot"), mouse(100, 300));
    fireEvent.pointerMove(window, mouse(106, 296));
    fireEvent.pointerMove(window, mouse(340, 140));
    // 오른쪽 240 → scrollLeft 가 그만큼 줄고, 세로 부모(없음)는 건드리지 않는다
    expect(board.scrollLeft).toBe(500 - (340 - 106));
    fireEvent.pointerUp(window, mouse(340, 140));
  });

  it("ignores touch pointers and secondary buttons", () => {
    const { getByText, getByTestId } = render(<Board onClick={() => {}} />);
    const board = getByTestId("board");
    overflowing(board);
    const dot = getByText("dot");
    fireEvent.pointerDown(dot, { ...mouse(0, 0), pointerType: "touch" });
    fireEvent.pointerMove(window, { ...mouse(50, 0), pointerType: "touch" });
    expect(board.hasAttribute("data-panning")).toBe(false);
    fireEvent.pointerDown(dot, { ...mouse(0, 0), button: 2 });
    fireEvent.pointerMove(window, mouse(50, 0));
    expect(board.hasAttribute("data-panning")).toBe(false);
  });
});
