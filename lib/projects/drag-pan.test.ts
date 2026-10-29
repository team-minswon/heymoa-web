import { describe, expect, it } from "vitest";

import {
  GLIDE_MAX_MS,
  GLIDE_MAX_V,
  PAN_THRESHOLD,
  glideDone,
  glideStep,
  lockAxis,
  panGesture,
  releaseVelocity,
} from "@/lib/projects/drag-pan";

describe("panGesture", () => {
  it("stays a click until the pointer travels past the threshold", () => {
    const pan = panGesture();
    pan.down(100, 100, 40, 10);
    expect(pan.move(100 + PAN_THRESHOLD, 100)).toEqual({ dragging: false });
    expect(pan.move(103, 104)).toEqual({ dragging: false });
    expect(pan.up()).toBe(false);
  });

  it("measures the threshold as distance, not per axis", () => {
    const pan = panGesture();
    pan.down(0, 0, 0, 0);
    // 축마다 4px 면 대각선으로는 5.66px
    expect(pan.move(4, 4)).toMatchObject({ dragging: true });
  });

  it("starts from where the threshold was crossed, so the content does not jump", () => {
    const pan = panGesture();
    pan.down(200, 300, 500, 80);
    // 문턱을 막 넘은 첫 걸음은 누르기 전 스크롤 값 그대로다(옛 방식이면 문턱만큼 튄다)
    expect(pan.move(194, 300)).toEqual({ dragging: true, axis: "x", left: 500, top: 80 });
    // 이후는 그 자리부터의 움직임만 따라간다
    expect(pan.move(174, 300)).toEqual({ dragging: true, axis: "x", left: 520, top: 80 });
    expect(pan.move(204, 300)).toEqual({ dragging: true, axis: "x", left: 490, top: 80 });
  });

  it("locks to the dominant axis and never moves the other one", () => {
    const pan = panGesture();
    pan.down(0, 0, 100, 50);
    // 오른쪽 240·위 160 으로 비스듬히: 가로가 우세
    const crossing = pan.move(30, -20);
    expect(crossing).toMatchObject({ dragging: true, axis: "x" });
    const step = pan.move(240, -160);
    expect(step).toEqual({ dragging: true, axis: "x", left: 100 - (240 - 30), top: 50 });
    // 세로 우세로 시작하면 가로는 움직이지 않는다
    const tall = panGesture();
    tall.down(0, 0, 100, 50);
    tall.move(3, 20);
    expect(tall.move(80, 140)).toEqual({ dragging: true, axis: "y", left: 100, top: 50 - (140 - 20) });
  });

  it("uses the only axis that can move, whatever the direction", () => {
    const pan = panGesture();
    pan.down(0, 0, 0, 0, { x: false, y: true });
    expect(pan.move(60, 8)).toMatchObject({ dragging: true, axis: "y" });
  });

  it("lets Shift move both axes", () => {
    const pan = panGesture();
    pan.down(0, 0, 100, 50);
    pan.move(10, 8, true);
    expect(pan.move(40, 38, true)).toEqual({ dragging: true, axis: "xy", left: 70, top: 20 });
  });

  it("does not start when nothing can move", () => {
    const pan = panGesture();
    pan.down(0, 0, 0, 0, { x: false, y: false });
    expect(pan.move(80, 80)).toEqual({ dragging: false });
    expect(pan.up()).toBe(false);
  });

  it("asks the caller to swallow the click after a drag, and only that one", () => {
    const pan = panGesture();
    pan.down(0, 0, 0, 0);
    pan.move(30, 0);
    expect(pan.up()).toBe(true);
    pan.down(0, 0, 0, 0);
    expect(pan.up()).toBe(false);
    expect(pan.active).toBe(false);
  });

  it("ignores moves with no press", () => {
    expect(panGesture().move(10, 10)).toBeNull();
  });
});

describe("lockAxis", () => {
  it("prefers the larger movement when both axes can move, ties go to horizontal", () => {
    const both = { x: true, y: true };
    expect(lockAxis(30, -20, both)).toBe("x");
    expect(lockAxis(5, -20, both)).toBe("y");
    expect(lockAxis(10, 10, both)).toBe("x");
    expect(lockAxis(5, 5, { x: true, y: false }, true)).toBe("x");
    expect(lockAxis(5, 5, { x: false, y: false })).toBeNull();
  });
});

describe("glide", () => {
  it("measures the release speed from the last 80ms and caps it", () => {
    const samples = [
      { t: 0, x: 0, y: 0 },
      { t: 40, x: 4, y: 0 },
      { t: 60, x: 24, y: 0 },
      { t: 76, x: 56, y: 0 },
    ];
    // 80ms 안의 표본은 t=0 이후 모두 (now=80 → t>=0): 0 → 56px / 76ms
    expect(releaseVelocity(samples, 80).vx).toBeCloseTo(56 / 76, 5);
    expect(releaseVelocity([{ t: 0, x: 0, y: 0 }, { t: 10, x: 5000, y: 0 }], 12).vx).toBe(GLIDE_MAX_V);
  });

  it("has no glide when the pointer was held still or barely sampled before release", () => {
    expect(releaseVelocity([{ t: 0, x: 0, y: 0 }, { t: 30, x: 60, y: 0 }], 200)).toEqual({ vx: 0, vy: 0 });
    expect(releaseVelocity([{ t: 70, x: 0, y: 0 }], 80)).toEqual({ vx: 0, vy: 0 });
  });

  it("slows down with friction, stays short, and finishes within the time limit", () => {
    let v = 2;
    let distance = 0;
    let elapsed = 0;
    while (!glideDone(v, elapsed)) {
      const step = glideStep(v, 8);
      distance += step.delta;
      v = step.v;
      elapsed += 8;
    }
    expect(elapsed).toBeLessThanOrEqual(GLIDE_MAX_MS);
    // 총 이동은 v0·τ 를 넘지 않는다(2 × 120 = 240px)
    expect(distance).toBeGreaterThan(150);
    expect(distance).toBeLessThanOrEqual(240);
    // 걸음을 어떻게 쪼개도 같은 거리다
    const whole = glideStep(2, 64).delta;
    const parts = glideStep(2, 32).delta + glideStep(2 * Math.exp(-32 / 120), 32).delta;
    expect(parts).toBeCloseTo(whole, 6);
  });

  it("stops at once when the speed is below the floor", () => {
    expect(glideDone(0.01, 0)).toBe(true);
    expect(glideDone(1, GLIDE_MAX_MS)).toBe(true);
    expect(glideDone(1, 100)).toBe(false);
  });
});
