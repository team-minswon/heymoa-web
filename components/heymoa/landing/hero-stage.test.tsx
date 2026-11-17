import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroStage } from "@/components/heymoa/landing/hero-stage";
import { messagesFor } from "@/i18n/messages";
import type { Locale } from "@/lib/i18n/locales";

const renderStage = (locale: Locale = "ko") =>
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={messagesFor(locale)}
      onError={(error) => {
        throw error;
      }}
    >
      <HeroStage />
    </NextIntlClientProvider>
  );

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

const STEP_MS = 60;

function play(steps: number) {
  for (let i = 0; i < steps; i += 1) {
    act(() => {
      vi.advanceTimersByTime(STEP_MS);
    });
  }
}

function playUntil(hit: () => boolean, steps = 1500) {
  for (let i = 0; i < steps; i += 1) {
    if (hit()) return true;
    act(() => {
      vi.advanceTimersByTime(STEP_MS);
    });
  }
  return hit();
}

const playToEnd = () => playUntil(() => screen.queryAllByText("검토 완료").length > 0);

const stage = () => document.querySelector("figure") as HTMLElement;

vi.setConfig({ testTimeout: 20_000 });

describe("HeroStage", () => {
  beforeEach(() => {
    window.matchMedia = matchMedia(false);
    seeImmediately();
    Element.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("기록 중에서 시작해 회의 종료 · 검토 막대까지 간다", () => {
    vi.useFakeTimers();
    renderStage();

    expect(screen.getAllByText("기록 중").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("검토 완료")).toHaveLength(0);

    expect(playToEnd()).toBe(true);
    expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("기록 중")).toHaveLength(0);
  });

  it("일시정지를 누르면 그 자리에 서고, 재생하면 이어서 끝까지 간다", () => {
    vi.useFakeTimers();
    renderStage();
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
    renderStage();
    play(150);

    leaveView();
    const before = stage().innerHTML;
    play(400);
    expect(stage().innerHTML).toBe(before);
    expect(screen.getAllByText("기록 중").length).toBeGreaterThan(0);
  });

  it("모션을 줄였으면 대본을 안 돌리고 끝 화면 한 장으로 선다", () => {
    window.matchMedia = matchMedia(true);
    renderStage();

    expect(screen.getAllByText("종료됨").length).toBeGreaterThan(0);
    expect(screen.getAllByText("검토 완료").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("기록 중")).toHaveLength(0);
  });

  it("영어판도 같은 한 바퀴를 영어로 돈다", () => {
    vi.useFakeTimers();
    renderStage("en");

    expect(screen.getAllByText("Recording").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(
      playUntil(() => screen.queryAllByText("Finish review").length > 0)
    ).toBe(true);
    expect(screen.getAllByText("Ended").length).toBeGreaterThan(0);
    expect(stage().textContent).not.toMatch(/[가-힣]/);
  });
});
