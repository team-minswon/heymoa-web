import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useStickToBottom } from "@/lib/chat/use-stick-to-bottom";

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
