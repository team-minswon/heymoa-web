import { describe, expect, it, vi } from "vitest";

import { nextFollowing, watchUpwardInput } from "./follow-scroll";

describe("nextFollowing", () => {
  it("따라가는 중 위로 움직여 바닥에서 떨어지면 끈다", () => {
    expect(
      nextFollowing({
        following: true,
        top: 560,
        previousTop: 600,
        distance: 40,
      })
    ).toBe(false);
  });

  it("내용이 줄어 브라우저가 위치를 끌어내렸을 뿐이면 바닥에 붙어 있다", () => {
    expect(
      nextFollowing({
        following: true,
        top: 550,
        previousTop: 600,
        distance: 0,
      })
    ).toBe(true);
  });

  it("떠난 뒤에는 위로 올린 이벤트가 바닥 가까이여도 다시 켜지 않는다", () => {
    expect(
      nextFollowing({
        following: false,
        top: 590,
        previousTop: 600,
        distance: 10,
      })
    ).toBe(false);
  });

  it("떠난 뒤 스스로 바닥 24px 안으로 내려오면 다시 켠다", () => {
    expect(
      nextFollowing({
        following: false,
        top: 580,
        previousTop: 500,
        distance: 20,
      })
    ).toBe(true);
    expect(
      nextFollowing({
        following: false,
        top: 560,
        previousTop: 500,
        distance: 40,
      })
    ).toBe(false);
  });

  it("소수점 단위로 올라간 이동도 위로 간 것으로 읽는다", () => {
    expect(
      nextFollowing({
        following: false,
        top: 599.5,
        previousTop: 600,
        distance: 0.5,
      })
    ).toBe(false);
  });

  it("방향을 모르는 첫 판정은 거리로만 잰다", () => {
    expect(
      nextFollowing({
        following: true,
        top: 0,
        previousTop: null,
        distance: 600,
      })
    ).toBe(false);
  });
});

describe("watchUpwardInput", () => {
  it("위로 가는 휠과 키만 알리고 해제하면 더는 알리지 않는다", () => {
    const viewport = document.createElement("div");
    const onUp = vi.fn();
    const stop = watchUpwardInput(viewport, onUp);

    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 40 }));
    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(onUp).not.toHaveBeenCalled();

    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }));
    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "PageUp" }));
    expect(onUp).toHaveBeenCalledTimes(2);

    // 확대·축소(ctrl+휠)는 스크롤이 아니다.
    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -1, ctrlKey: true })
    );
    expect(onUp).toHaveBeenCalledTimes(2);

    stop();
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }));
    expect(onUp).toHaveBeenCalledTimes(2);
  });

  it("손가락이 되돌아와도 마지막 움직임의 방향으로 판단한다", () => {
    const viewport = document.createElement("div");
    const onUp = vi.fn();
    watchUpwardInput(viewport, onUp);
    const touch = (type: string, y: number) =>
      viewport.dispatchEvent(
        Object.assign(new Event(type), { touches: [{ clientY: y }] })
      );

    touch("touchstart", 100);
    touch("touchmove", 80);
    expect(onUp).not.toHaveBeenCalled();
    touch("touchmove", 90);
    expect(onUp).toHaveBeenCalledTimes(1);
  });
});
