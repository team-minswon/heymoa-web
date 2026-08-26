import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  SMOOTH_GUARD_MS,
  useStickToBottom,
} from "@/lib/chat/use-stick-to-bottom";

/** 스크롤 가능한 뷰포트를 흉내낸다. jsdom은 레이아웃이 없어 세 값을 직접 준다. */
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

/**
 * ref를 **렌더 중에** 넣는다. React가 커밋에서 ref를 채운 뒤 effect를 돌리는 순서와 같다 —
 * 마운트 뒤에 넣으면 스크롤 리스너를 다는 effect가 이미 빈 ref로 돌고 끝난다.
 */
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

function scroll(viewport: HTMLDivElement, top: number) {
  act(() => {
    viewport.scrollTop = top;
    viewport.dispatchEvent(new Event("scroll"));
  });
}

describe("useStickToBottom", () => {
  it("바닥에 있으면 버튼을 띄우지 않는다", () => {
    const viewport = makeViewport();
    const hook = mount(viewport);

    scroll(viewport, 600);

    expect(hook.result.current.atBottom).toBe(true);
  });

  // 유저가 위를 읽는 중에 답변이 흐르면 화면이 끌려가면 안 된다. 이 판정이 깨지면
  // 대화를 되짚어 읽는 것이 불가능해진다.
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

    // 1000 - 590 - 400 = 10 < 48 이므로 바닥으로 본다.
    scroll(viewport, 590);
    expect(hook.result.current.atBottom).toBe(true);

    act(() => hook.rerender({ tail: "1" }));

    expect(viewport.scrollTop).toBe(1000);
  });

  // 먼저 atBottom을 true로 두면 이동이 실패했을 때 버튼만 사라지고 유저는 위에 남는다.
  // 실제로 밟았다 — 헤드리스 브라우저에서 smooth scrollTo가 아무 일도 안 했다.
  it("이동이 안 먹으면 버튼을 감추지 않는다", () => {
    const viewport = makeViewport();
    // scrollTop 대입이 안 먹는 뷰포트를 흉내낸다.
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
    expect(viewport.scrollTop).toBe(1000);

    // 다시 붙었으므로 이후 성장도 따라간다.
    viewport.scrollTop = 900;
    act(() => hook.rerender({ tail: "1" }));
    expect(viewport.scrollTop).toBe(1000);
  });
});

/**
 * ★ **보내는 순간의 이동은 「사용자가 떠났다」와 무관하다.**
 *
 * 답을 따라 내려가는 것과 방금 보낸 질문으로 옮기는 것은 **다른 일이다.** 앞엣것은 위를
 * 읽고 있으면 안 해야 맞지만, 보내기는 사용자가 지금 한 행동이라 그 결과를 보여 주는 이동을
 * 「아까 위로 올렸었다」는 이유로 막으면 안 된다.
 */
describe("보낸 질문으로 옮기기", () => {
  it("★ 위로 올라가 있어도 보내면 옮기고, 추적을 다시 켠다", () => {
    const viewport = makeViewport();
    const hook = mount(viewport);

    // 옛 대화를 읽으러 위로 올라갔다.
    scroll(viewport, 100);
    expect(hook.result.current.atBottom).toBe(false);

    act(() => hook.result.current.scrollToSent());
    // 보낸 것이 스레드에 붙는다 — `tail`이 바뀌는 그 순간이 옮기는 자리다.
    hook.rerender({ tail: "1" });

    expect(viewport.scrollTop).toBe(1000);
    expect(hook.result.current.atBottom).toBe(true);

    // 추적이 다시 켜져 있어야 답이 자라는 동안 따라 내려간다 — 안 그러면 질문만 위로
    // 가고 답은 화면 밖에서 흐른다.
    Object.defineProperty(viewport, "scrollHeight", { value: 1400 });
    hook.rerender({ tail: "2" });
    expect(viewport.scrollTop).toBe(1400);
  });

  /**
   * ★ **답이 흐르는 동안 스크롤이 잠기던 자리.**
   *
   * `scroll` 은 브라우저가 비동기로 보낸다. 손으로 올린 직후 그 이벤트가 처리되기 전에
   * 토큰이 도착하면, 예전 코드는 `stickRef` 가 아직 참이라 `scrollTop` 을 바닥으로
   * 되돌렸다 — 사용자가 아무리 올려도 매번 도로 감겼다. 그래서 여기서는 **`scroll` 을
   * 일부러 안 보낸다.** 그것이 실제로 나던 순서다.
   */
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

  // 아래로 굴리는 것은 바닥으로 돌아오는 길이다. 여기서 끊으면 다시 켜 줄 `scroll` 이
  // 안 올 수도 있어(이미 바닥이면 위치가 안 바뀐다) 추적을 영영 잃는다.
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
    expect(viewport.scrollTop).toBe(1000);
  });

  // 키보드로 읽는 사람도 같은 자리를 밟는다.
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

/**
 * ★ **「첫 채팅은 스르륵 올라가는데 다음부터는 확 이동한다」** 를 가르는 자리.
 *
 * 두 경로가 있다 — 부드러운 이동(`scrollTo({behavior:"smooth"})`)과 즉시 이동
 * (`scrollTop = scrollHeight`). 위 검사들은 jsdom 에 `scrollTo` 가 없어 늘 즉시 경로를
 * 지난다. 여기서는 **`scrollTo` 를 심어** 어느 경로가 실제로 도는지 본다.
 */
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

  it("첫 번째도 두 번째도 부드럽게 옮긴다", () => {
    const viewport = makeViewport({ scrollHeight: 1000, scrollTop: 600 });
    const calls = withScrollTo(viewport);
    const hook = mount(viewport);

    // 첫 번째 전송 — 질문이 붙고 답이 흐른다.
    act(() => hook.result.current.scrollToSent());
    hook.rerender({ tail: "1" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ behavior: "smooth" });

    // 답이 자란다. 보호 창 안이라 따라가기는 건너뛴다.
    Object.defineProperty(viewport, "scrollHeight", { value: 1400 });
    hook.rerender({ tail: "12" });
    expect(calls).toHaveLength(1);

    // 보호 창이 끝난다.
    act(() => {
      vi.useFakeTimers();
      vi.advanceTimersByTime(SMOOTH_GUARD_MS + 1);
      vi.useRealTimers();
    });

    // 두 번째 전송 — 여기서도 부드러워야 한다.
    Object.defineProperty(viewport, "scrollHeight", { value: 2000 });
    act(() => hook.result.current.scrollToSent());
    hook.rerender({ tail: "" });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({ behavior: "smooth", top: 2000 });
  });
});

/**
 * ★ **「첫 채팅은 스르륵, 다음부터는 확」의 원인이던 자리.**
 *
 * 700ms 는 잰 값이 아니다 — 브라우저의 smooth 스크롤 길이는 규격에 없어 밖에서 알 방법이
 * 없다. 예전에는 그 창이 닫힐 때 위치를 다시 읽어 「아직 바닥이 아니다 = 사용자가
 * 가로챘다」로 읽었는데, **스레드가 길어질수록 이동 거리가 커져 그때까지 도착 못 한다.**
 * 그래서 추적이 꺼지고 남은 답이 화면 밖에서 흘렀으며, 다음 질문은 바닥에서 멀어진
 * 자리에서 출발해 이동 거리가 또 커졌다.
 */
describe("보호 창이 끝날 때 아직 도착 전이어도", () => {
  it("추적이 안 꺼지고 가던 자리로 마무리한다", () => {
    vi.useFakeTimers();
    try {
      // 마운트 효과가 곧바로 바닥으로 보내므로 시작 scrollTop 은 3000 이 된다.
      const viewport = makeViewport({ scrollHeight: 3000 });
      // 애니메이션이 **안 끝난** 브라우저. `scrollTo`를 받되 위치를 안 옮긴다.
      Object.defineProperty(viewport, "scrollTo", {
        value: () => {},
        writable: true,
      });
      const hook = mount(viewport);

      act(() => hook.result.current.scrollToSent());
      // 질문이 붙어 내용이 자란다 — 바닥이 600px 아래로 내려갔다.
      Object.defineProperty(viewport, "scrollHeight", { value: 3600 });
      hook.rerender({ tail: "1" });
      expect(hook.result.current.atBottom).toBe(true);

      act(() => {
        vi.advanceTimersByTime(SMOOTH_GUARD_MS + 1);
      });

      // 손이 안 닿았으므로 추적이 살아 있고, 가던 자리로 마무리했다.
      expect(hook.result.current.atBottom).toBe(true);
      expect(viewport.scrollTop).toBe(3600);

      // 그래서 남은 답을 계속 따라간다.
      Object.defineProperty(viewport, "scrollHeight", { value: 4000 });
      hook.rerender({ tail: "12" });
      expect(viewport.scrollTop).toBe(4000);
    } finally {
      vi.useRealTimers();
    }
  });
});

/** 그래도 **손이 닿으면** 꺼져야 한다 — 추측을 걷었지 규칙을 걷은 것이 아니다. */
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

      // 애니메이션 도중 위로 굴린다.
      act(() => {
        viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }));
      });
      expect(hook.result.current.atBottom).toBe(false);

      act(() => {
        vi.advanceTimersByTime(SMOOTH_GUARD_MS + 1);
      });
      expect(hook.result.current.atBottom).toBe(false);
      expect(viewport.scrollTop).toBe(3000);
    } finally {
      vi.useRealTimers();
    }
  });
});
