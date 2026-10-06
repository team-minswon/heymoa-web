import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroStage } from "@/components/heymoa/landing/hero-stage";

/**
 * 히어로 시연. **혼자 한 바퀴 돌고, 멈출 수 있다.** 대본(`use-demo.ts`)은 그대로이고 여기서 지키는 것은
 * 이 무대가 대본을 끝까지 몰고 가는가, 그리고 멈춤 셋(일시정지 · 화면 밖 · 모션 줄이기)이 듣는가다.
 */
const matchMedia = (reduced: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

/** `IntersectionObserver` 를 곧바로 「보인다」로 대답하는 대역 — jsdom 에는 없어서 대본이 아예 안 돈다. */
let observers: IntersectionObserverCallback[] = [];

function seeImmediately() {
  observers = [];
  class Immediate {
    constructor(private cb: IntersectionObserverCallback) {
      observers.push(cb);
    }
    observe() {
      this.cb(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      );
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", Immediate);
}

function leaveView() {
  act(() => {
    for (const cb of observers) {
      cb(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        null as unknown as IntersectionObserver
      );
    }
  });
}

/** 타이머를 조금씩 당긴다 — 다음 타이머는 효과가 돈 뒤에 걸려서 한 번에 당기면 안 따라온다. */
const STEP_MS = 60;

function play(steps: number) {
  for (let i = 0; i < steps; i += 1) {
    act(() => {
      vi.advanceTimersByTime(STEP_MS);
    });
  }
}

/** 조건이 참이 될 때까지만 당긴다. 상한(약 90초)에 닿으면 거짓이다 — 무한 대기가 없다. */
function playUntil(hit: () => boolean, steps = 1500) {
  for (let i = 0; i < steps; i += 1) {
    if (hit()) return true;
    act(() => {
      vi.advanceTimersByTime(STEP_MS);
    });
  }
  return hit();
}

/** 한 바퀴의 끝 — 검토 막대의 「검토 완료」. 넘겨 당기면 대본이 처음으로 돌아가니 거기서 멈춘다. */
const playToEnd = () => playUntil(() => screen.queryAllByText("검토 완료").length > 0);

const stage = () => document.querySelector("figure") as HTMLElement;

/** 가짜 시계로 대본 한 바퀴를 `act` 수백 번으로 돌린다 — 부하가 걸린 머신에서 기본 5초를 넘긴 적이 있다. */
vi.setConfig({ testTimeout: 20_000 });

describe("HeroStage", () => {
  beforeEach(() => {
    window.matchMedia = matchMedia(false);
    seeImmediately();
    // 노트 창은 장면마다 제 안에서 줄을 옮긴다. jsdom 의 요소에는 scrollTo 가 없다.
    Element.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("기록 중에서 시작해 회의 종료 · 검토 막대까지 간다", () => {
    vi.useFakeTimers();
    render(<HeroStage />);

    expect(screen.getAllByText("기록 중").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("검토 완료")).toHaveLength(0);

    expect(playToEnd()).toBe(true);
    expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("기록 중")).toHaveLength(0);
  });

  /** WCAG 2.2.2 — 화면에 있는 한 스스로 계속 도는 움직임이라 멈출 수 있어야 한다. */
  it("일시정지를 누르면 그 자리에 서고, 재생하면 이어서 끝까지 간다", () => {
    vi.useFakeTimers();
    render(<HeroStage />);
    play(150);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    });
    const before = stage().innerHTML;
    play(400);
    expect(stage().innerHTML).toBe(before);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "재생" }));
    });
    expect(playToEnd()).toBe(true);
  });

  it("화면 밖으로 나가면 대본이 멈춘다", () => {
    vi.useFakeTimers();
    render(<HeroStage />);
    play(150);

    leaveView();
    const before = stage().innerHTML;
    play(400);
    expect(stage().innerHTML).toBe(before);
    expect(screen.getAllByText("기록 중").length).toBeGreaterThan(0);
  });

  it("모션을 줄였으면 대본을 안 돌리고 끝 화면 한 장으로 선다", () => {
    window.matchMedia = matchMedia(true);
    render(<HeroStage />);

    expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
    expect(screen.getAllByText("검토 완료").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("기록 중")).toHaveLength(0);
  });
});
