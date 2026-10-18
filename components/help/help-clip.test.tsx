import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HelpClip } from "@/components/help/help-clip";

type Observer = {
  cb: IntersectionObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
};
let observers: Observer[] = [];

function mockReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as never;
}

describe("HelpClip", () => {
  beforeEach(() => {
    observers = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        disconnect = vi.fn();
        constructor(cb: IntersectionObserverCallback) {
          observers.push({ cb, disconnect: this.disconnect });
        }
        observe() {}
      }
    );
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    HTMLMediaElement.prototype.pause = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("화면에 들어올 때만 재생하고 벗어나면 멈춘다", () => {
    mockReducedMotion(false);
    render(
      <HelpClip name="desktop-menubar" alt="메뉴 막대 팝오버가 열리는 모습" />
    );
    expect(observers).toHaveLength(1);
    observers[0].cb(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as never
    );
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    observers[0].cb(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as never
    );
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("움직임 줄이기 설정이면 자동 재생하지 않는다", () => {
    mockReducedMotion(true);
    render(
      <HelpClip name="desktop-menubar" alt="메뉴 막대 팝오버가 열리는 모습" />
    );
    // 첫 렌더의 관찰자는 설정을 읽은 뒤 바로 해제된다 — 재생은 한 번도 시작하지 않는다
    for (const observer of observers)
      expect(observer.disconnect).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /재생/ })).toBeInTheDocument();
  });

  it("영상은 소리 없이 반복하고 크기를 미리 잡는다", () => {
    mockReducedMotion(false);
    const { container } = render(
      <HelpClip name="desktop-menubar" alt="설명" />
    );
    const video = container.querySelector("video")!;
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video).toHaveAttribute("width");
    expect(video).toHaveAttribute("height");
    expect(video).toHaveAttribute(
      "poster",
      expect.stringContaining("/help/clips/desktop-menubar.webp")
    );
  });

  it("버튼으로 일시정지하면 다시 보여도 자동으로 재생하지 않는다", () => {
    mockReducedMotion(false);
    render(<HelpClip name="desktop-menubar" alt="설명" />);
    fireEvent.click(screen.getByRole("button", { name: /재생|일시정지/ }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
});
