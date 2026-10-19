import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({ __loaded: true, capture: vi.fn() }));
vi.mock("posthog-js", () => ({ default: posthog }));

let analytics: typeof import("./track");
beforeEach(async () => {
  vi.resetModules();
  analytics = await import("./track");
  posthog.capture.mockClear();
});

afterEach(() => {
  analytics.setAnalyticsOptOut(false);
  delete (window as { gtag?: unknown }).gtag;
  delete (window as { dataLayer?: unknown }).dataLayer;
  localStorage.clear();
});

describe("GA 광고 전환", () => {
  it("초기화 전 전환을 구성 뒤에 보내고 재초기화로 중복 전송하지 않습니다", () => {
    analytics.trackConversion("sign_up");
    analytics.trackConversion("first_recording", { workspace_id: "W1" });
    analytics.initGoogleAnalytics("G-TEST");
    analytics.initGoogleAnalytics("G-TEST");
    const commands = (window as { dataLayer?: IArguments[] }).dataLayer!;
    expect(
      commands.every(
        (command) =>
          Object.prototype.toString.call(command) === "[object Arguments]"
      )
    ).toBe(true);
    expect(
      commands.map((command) => [
        command[0],
        command[1] instanceof Date ? "date" : command[1],
      ])
    ).toEqual([
      ["js", "date"],
      ["config", "G-TEST"],
      ["event", "sign_up"],
      ["event", "first_recording"],
    ]);
    expect(Array.from(commands[2])).toEqual([
      "event",
      "sign_up",
      { method: "google" },
    ]);
    expect(Array.from(commands[3])).toEqual([
      "event",
      "first_recording",
      undefined,
    ]);
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("수집을 거부하면 대기 전환도 삭제합니다", () => {
    analytics.trackConversion("sign_up");
    analytics.setAnalyticsOptOut(true);
    analytics.trackConversion("first_recording");
    analytics.setAnalyticsOptOut(false);
    const gtag = vi.fn();
    (window as { gtag?: unknown }).gtag = gtag;
    analytics.initGoogleAnalytics("G-TEST");
    expect(gtag.mock.calls.filter(([command]) => command === "event")).toEqual(
      []
    );
    gtag.mockClear();
    analytics.track("desktop_download_clicked");
    expect(gtag).toHaveBeenCalledExactlyOnceWith(
      "event",
      "desktop_download_clicked",
      undefined
    );
  });

  it("테스트 워크스페이스는 GA 전환과 PostHog 행동에서 제외합니다", () => {
    const gtag = vi.fn();
    (window as { gtag?: unknown }).gtag = gtag;
    posthog.capture.mockClear();
    analytics.trackConversion("first_recording", {
      workspace_id: "0RSQB39CHT4ZV",
    });
    analytics.track("recording_started", { workspace_id: "0R1Q3TMN6P4QY" });
    expect(gtag).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });
});
