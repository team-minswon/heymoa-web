import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  SMOOTH_GUARD_MS,
  useStickToBottom,
} from "@/lib/chat/use-stick-to-bottom";

function makeViewport({
  scrollHeight = 1000,
  clientHeight = 400,
  scrollTop = 600,
} = {}) {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    scrollHeight: { value: scrollHeight, writable: true },
    clientHeight: { value: clientHeight, writable: true },
  });
  element.scrollTop = scrollTop;
  return element as HTMLDivElement;
}

function mount(viewport: HTMLDivElement, tail = "0") {
  return renderHook(
    ({ tail: current }) => {
      const api = useStickToBottom(current);
      api.viewportRef.current = viewport;
      return api;
    },
    { initialProps: { tail } }
  );
}

let resizers: ResizeObserverCallback[] = [];

function installResizeObserver() {
  resizers = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resizers.push(callback);
      }
      observe() {}
      disconnect() {}
    }
  );
}

function resize() {
  act(() =>
    resizers.forEach((run) =>
      run([] as unknown as ResizeObserverEntry[], {} as ResizeObserver)
    )
  );
}

function scroll(viewport: HTMLDivElement, top: number) {
  act(() => {
    viewport.scrollTop = top;
    viewport.dispatchEvent(new Event("scroll"));
  });
}

describe("미끄러지는 동안 자란 만큼을 나중에 한 번에 안 뛴다", () => {
  it("★ 창이 열린 사이에 바닥이 자라면 목표를 다시 겨눈다", () => {
    const viewport = makeViewport({ scrollHeight: 3000 });
    const moves: { top?: number; behavior?: ScrollBehavior }[] = [];
    viewport.scrollTo = ((options: ScrollToOptions) =>
      moves.push(options)) as typeof viewport.scrollTo;
    const hook = mount(viewport);

    act(() => hook.result.current.scrollToSent());
    hook.rerender({ tail: "1" });
    expect(moves).toHaveLength(1);

    Object.defineProperty(viewport, "scrollHeight", { value: 3600 });
    hook.rerender({ tail: "2" });

    expect(moves).toHaveLength(2);
    expect(moves[1]).toMatchObject({ top: 3600, behavior: "smooth" });
  });

  it("안 자랐으면 다시 안 건다 — 매 토큰 다시 걸면 애니메이션이 계속 처음부터다", () => {
    const viewport = makeViewport({ scrollHeight: 3000 });
    const moves: unknown[] = [];
    viewport.scrollTo = ((options: ScrollToOptions) =>
      moves.push(options)) as typeof viewport.scrollTo;
    const hook = mount(viewport);

    act(() => hook.result.current.scrollToSent());
    hook.rerender({ tail: "1" });
    hook.rerender({ tail: "2" });
    hook.rerender({ tail: "3" });

    expect(moves).toHaveLength(1);
  });
});

describe("높이가 변한 것을 직접 본다", () => {
  it("★ `tail` 이 안 바뀌어도 내용이 자라면 따라간다", () => {
    installResizeObserver();
    const viewport = makeViewport({ scrollHeight: 1000, scrollTop: 600 });
    const hook = mount(viewport);
    scroll(viewport, 600);
    expect(hook.result.current.atBottom).toBe(true);

    Object.defineProperty(viewport, "scrollHeight", { value: 1400 });
    resize();

    expect(viewport.scrollTop).toBe(1000);
    vi.unstubAllGlobals();
  });

  it("★ 스크롤 이벤트가 늦게 와도 사람이 옮긴 것을 안 되돌린다", () => {
    installResizeObserver();
    const viewport = makeViewport({ scrollHeight: 1000, scrollTop: 600 });
    const hook = mount(viewport);
    scroll(viewport, 600);
    expect(hook.result.current.atBottom).toBe(true);

    viewport.scrollTop = 570;
    Object.defineProperty(viewport, "scrollHeight", { value: 1400 });
    resize();

    expect(viewport.scrollTop).toBe(570);
    expect(hook.result.current.atBottom).toBe(false);
    vi.unstubAllGlobals();
  });

  it("자란 것만으로는 안 놓는다", () => {
    installResizeObserver();
    const viewport = makeViewport({ scrollHeight: 1000, scrollTop: 600 });
    const hook = mount(viewport);
    scroll(viewport, 600);

    Object.defineProperty(viewport, "scrollHeight", { value: 1400 });
    resize();

    expect(viewport.scrollTop).toBe(1000);
    expect(hook.result.current.atBottom).toBe(true);
    vi.unstubAllGlobals();
  });

  it("떠나 있으면 자라도 안 따라간다", () => {
    installResizeObserver();
    const viewport = makeViewport({ scrollHeight: 1000, scrollTop: 600 });
    mount(viewport);
    scroll(viewport, 100);

    Object.defineProperty(viewport, "scrollHeight", { value: 1400 });
    resize();

    expect(viewport.scrollTop).toBe(100);
    vi.unstubAllGlobals();
  });
});

describe("떠난 뒤에는 사람이 끝까지 내려야 다시 붙는다", () => {
  it("★ 문턱 안쪽으로 조금만 올려도 되살아나지 않는다", () => {
    const viewport = makeViewport({ scrollTop: 600 });
    const hook = mount(viewport, "0");

    act(() => {
      viewport.scrollTop = 570;
      viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -40 }));
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(hook.result.current.atBottom).toBe(false);

    hook.rerender({ tail: "1" });
    expect(hook.result.current.atBottom).toBe(false);
    expect(viewport.scrollTop).toBe(570);
  });

  it("스크롤바를 끌어 올려도 — 손짓 이벤트가 없어도 — 추적이 끊긴다", () => {
    const viewport = makeViewport({ scrollTop: 600 });
    const hook = mount(viewport, "0");

    scroll(viewport, 600);
    scroll(viewport, 575);

    expect(hook.result.current.atBottom).toBe(false);
  });

  it("끝까지 내리면 다시 붙는다", () => {
    const viewport = makeViewport({ scrollTop: 600 });
    const hook = mount(viewport, "0");

    scroll(viewport, 300);
    expect(hook.result.current.atBottom).toBe(false);

    scroll(viewport, 600);
    expect(hook.result.current.atBottom).toBe(true);
  });
});

describe("useStickToBottom", () => {
  it("바닥에 있으면 버튼을 띄우지 않는다", () => {
    const viewport = makeViewport();
    const hook = mount(viewport);

    scroll(viewport, 600);

    expect(hook.result.current.atBottom).toBe(true);
  });

  it("위로 올라가 있으면 내용이 자라도 따라가지 않고 버튼을 띄운다", () => {
    const viewport = makeViewport();
    const hook = mount(viewport);

    scroll(viewport, 100);
    expect(hook.result.current.atBottom).toBe(false);

    act(() => hook.rerender({ tail: "1" }));

    expect(viewport.scrollTop).toBe(100);
    expect(hook.result.current.atBottom).toBe(false);
  });

  it("바닥 근처면 내용이 자랄 때 따라간다", () => {
    const viewport = makeViewport();
    const hook = mount(viewport);

    scroll(viewport, 596);
    expect(hook.result.current.atBottom).toBe(true);

    act(() => hook.rerender({ tail: "1" }));

    expect(viewport.scrollTop).toBe(600);
  });

  it("이동이 안 먹으면 버튼을 감추지 않는다", () => {
    const viewport = makeViewport();
    Object.defineProperty(viewport, "scrollTop", {
      get: () => 100,
      set: () => undefined,
    });
    const hook = mount(viewport);

    scroll(viewport, 100);
    expect(hook.result.current.atBottom).toBe(false);

    act(() => hook.result.current.scrollToBottom());

    expect(hook.result.current.atBottom).toBe(false);
  });

  it("scrollToBottom은 바닥으로 보내고 다시 따라가기 시작한다", () => {
    const viewport = makeViewport();
    const hook = mount(viewport);

    scroll(viewport, 100);
    expect(hook.result.current.atBottom).toBe(false);

    act(() => hook.result.current.scrollToBottom());

    expect(hook.result.current.atBottom).toBe(true);
    expect(viewport.scrollTop).toBe(600);

    viewport.scrollTop = 900;
    act(() => hook.rerender({ tail: "1" }));
    expect(viewport.scrollTop).toBe(600);
  });
});

describe("보낸 질문으로 옮기기", () => {
  it("★ 위로 올라가 있어도 보내면 옮기고, 추적을 다시 켠다", () => {
    const viewport = makeViewport();
    const hook = mount(viewport);

    scroll(viewport, 100);
    expect(hook.result.current.atBottom).toBe(false);

    act(() => hook.result.current.scrollToSent());
    hook.rerender({ tail: "1" });

    expect(viewport.scrollTop).toBe(600);
    expect(hook.result.current.atBottom).toBe(true);

    Object.defineProperty(viewport, "scrollHeight", { value: 1400 });
    hook.rerender({ tail: "2" });
    expect(viewport.scrollTop).toBe(1000);
  });

  it("★ 흐르는 중에 휠로 올리면 다음 토큰이 도로 안 감는다", () => {
    const viewport = makeViewport();
    const hook = mount(viewport);

    scroll(viewport, 600);
    expect(hook.result.current.atBottom).toBe(true);

    act(() => {
      viewport.scrollTop = 100;
      viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -120 }));
    });

    act(() => {
      hook.rerender({ tail: "1" });
    });

    expect(viewport.scrollTop).toBe(100);
    expect(hook.result.current.atBottom).toBe(false);
  });

  it("아래로 굴리는 손짓은 추적을 안 끊는다", () => {
    const viewport = makeViewport();
    const hook = mount(viewport);

    scroll(viewport, 600);
    act(() => {
      viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 120 }));
    });

    act(() => {
      hook.rerender({ tail: "1" });
    });

    expect(hook.result.current.atBottom).toBe(true);
    expect(viewport.scrollTop).toBe(600);
  });

  it("PageUp 도 같은 자리에서 추적을 끊는다", () => {
    const viewport = makeViewport();
    const hook = mount(viewport);

    scroll(viewport, 600);
    act(() => {
      viewport.scrollTop = 100;
      viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp" }));
    });

    act(() => {
      hook.rerender({ tail: "1" });
    });

    expect(viewport.scrollTop).toBe(100);
    expect(hook.result.current.atBottom).toBe(false);
  });
});

describe("보내는 순간의 이동은 매번 같아야 한다", () => {
  function withScrollTo(viewport: HTMLDivElement) {
    const calls: ScrollToOptions[] = [];
    Object.defineProperty(viewport, "scrollTo", {
      value: (options: ScrollToOptions) => {
        calls.push(options);
        viewport.scrollTop = options.top ?? viewport.scrollTop;
      },
      writable: true,
    });
    return calls;
  }

  it("★ 「맨 아래로」도 미끄러진다 — 한 프레임에 안 뛴다", () => {
    const viewport = makeViewport({ scrollHeight: 3000, scrollTop: 100 });
    const calls = withScrollTo(viewport);
    const hook = mount(viewport);

    scroll(viewport, 100);
    expect(hook.result.current.atBottom).toBe(false);

    act(() => hook.result.current.scrollToBottom());

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ behavior: "smooth", top: 3000 });
    expect(hook.result.current.atBottom).toBe(true);
  });

  it("첫 번째도 두 번째도 부드럽게 옮긴다", () => {
    const viewport = makeViewport({ scrollHeight: 1000, scrollTop: 600 });
    const calls = withScrollTo(viewport);
    const hook = mount(viewport);

    act(() => hook.result.current.scrollToSent());
    hook.rerender({ tail: "1" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ behavior: "smooth" });

    Object.defineProperty(viewport, "scrollHeight", { value: 1400 });
    hook.rerender({ tail: "12" });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ behavior: "smooth", top: 1400 });

    act(() => {
      vi.useFakeTimers();
      vi.advanceTimersByTime(SMOOTH_GUARD_MS + 1);
      vi.useRealTimers();
    });

    Object.defineProperty(viewport, "scrollHeight", { value: 2000 });
    act(() => hook.result.current.scrollToSent());
    hook.rerender({ tail: "" });
    expect(calls).toHaveLength(3);
    expect(calls[2]).toMatchObject({ behavior: "smooth", top: 2000 });
  });
});

describe("보호 창이 끝날 때 아직 도착 전이어도", () => {
  it("추적이 안 꺼지고 가던 자리로 마무리한다", () => {
    vi.useFakeTimers();
    try {
      const viewport = makeViewport({ scrollHeight: 3000 });
      Object.defineProperty(viewport, "scrollTo", {
        value: () => {},
        writable: true,
      });
      const hook = mount(viewport);

      act(() => hook.result.current.scrollToSent());
      Object.defineProperty(viewport, "scrollHeight", { value: 3600 });
      hook.rerender({ tail: "1" });
      expect(hook.result.current.atBottom).toBe(true);

      act(() => {
        vi.advanceTimersByTime(SMOOTH_GUARD_MS + 1);
      });

      expect(hook.result.current.atBottom).toBe(true);
      expect(viewport.scrollTop).toBe(3200);

      Object.defineProperty(viewport, "scrollHeight", { value: 4000 });
      hook.rerender({ tail: "12" });
      expect(viewport.scrollTop).toBe(3600);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("보호 창 중에 손이 닿으면", () => {
  it("그 자리에서 추적이 끊기고 창이 닫혀도 안 되살아난다", () => {
    vi.useFakeTimers();
    try {
      const viewport = makeViewport({ scrollHeight: 3000 });
      Object.defineProperty(viewport, "scrollTo", {
        value: () => {},
        writable: true,
      });
      const hook = mount(viewport);

      act(() => hook.result.current.scrollToSent());
      Object.defineProperty(viewport, "scrollHeight", { value: 3600 });
      hook.rerender({ tail: "1" });

      act(() => {
        viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }));
      });
      expect(hook.result.current.atBottom).toBe(false);

      act(() => {
        vi.advanceTimersByTime(SMOOTH_GUARD_MS + 1);
      });
      expect(hook.result.current.atBottom).toBe(false);
      expect(viewport.scrollTop).toBe(2600);
    } finally {
      vi.useRealTimers();
    }
  });
});
