import { afterEach, describe, expect, it, vi } from "vitest";

// 핸드오프 ID 부착·도착을 보려고 SDK를 대역으로 바꾼다. 모듈 상태가 남으므로 파일을 따로 둔다.
const posthog = vi.hoisted(() => ({
  __loaded: false,
  init: vi.fn(),
  capture: vi.fn(),
  register: vi.fn(),
  get_distinct_id: vi.fn(() => DID),
  get_session_id: vi.fn(() => SID),
  _isIdentified: vi.fn(() => false),
}));
vi.mock("posthog-js", () => ({ default: posthog }));

import {
  initAnalytics,
  setAnalyticsOptOut,
  track,
  withAnalyticsHandoff,
} from "@/lib/analytics/track";
import { externalBrowserUrl } from "@/lib/auth/in-app-browser";

const DID = "0192f0a1-7c2b-7d3e-8f40-123456789abc";
const SID = "0192f0a1-7c2b-7d3e-8f40-cba987654321";
const NOW = () => Math.floor(Date.now() / 1000);
const TARGET = "https://heymoa.app/?handoff_app=instagram&handoff_os=ios";

afterEach(() => {
  posthog.__loaded = false;
  posthog._isIdentified.mockReturnValue(false);
  posthog.init.mockReset();
  posthog.capture.mockReset();
  setAnalyticsOptOut(false);
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("핸드오프 목적지에 익명 ID 붙이기", () => {
  it("켜져 있고 익명일 때만 붙이고, 앱 스킴·intent를 거쳐도 남는다", () => {
    posthog.__loaded = true;
    const target = withAnalyticsHandoff(TARGET);
    const params = new URL(target).searchParams;
    expect(params.get("ph_did")).toBe(DID);
    expect(params.get("ph_sid")).toBe(SID);
    expect(Number(params.get("ph_ts"))).toBeCloseTo(NOW(), -1);

    const ios = externalBrowserUrl(target, { app: "instagram", os: "ios" })!;
    expect(new URL(decodeURIComponent(ios.split("url=")[1])).href).toBe(target);
    const android = externalBrowserUrl(target, {
      app: "instagram",
      os: "android",
    })!;
    expect(android).toContain(`ph_did=${DID}&ph_sid=${SID}&ph_ts=`);
    expect(android).toContain("#Intent;");
  });

  it("켜기 전·거부·식별 뒤에는 붙이지 않는다", () => {
    expect(withAnalyticsHandoff(TARGET)).toBe(TARGET);
    posthog.__loaded = true;
    posthog._isIdentified.mockReturnValue(true);
    expect(withAnalyticsHandoff(TARGET)).toBe(TARGET);
    posthog._isIdentified.mockReturnValue(false);
    setAnalyticsOptOut(true);
    expect(withAnalyticsHandoff(TARGET)).toBe(TARGET);
  });
});

describe("핸드오프로 도착한 브라우저", () => {
  it("bootstrap으로 넘기고 주소에서 지우며, 도착 이벤트가 그 ID로 나간다", () => {
    window.history.replaceState(
      null,
      "",
      `/auth/login?returnTo=%2F&ph_did=${DID}&ph_sid=${SID}&ph_ts=${NOW()}#x`
    );
    posthog.init.mockImplementation(() => {
      posthog.__loaded = true;
    });
    track("browser_handoff_arrived", { app: "instagram", os: "ios" });

    initAnalytics("phc_test");

    expect(posthog.init.mock.calls[0][1].bootstrap).toEqual({
      distinctID: DID,
      sessionID: SID,
    });
    expect(window.location.pathname + window.location.search).toBe(
      "/auth/login?returnTo=%2F"
    );
    expect(window.location.hash).toBe("#x");
    // init 뒤에 보낸다 — bootstrap한 ID로 찍힌다
    expect(posthog.init.mock.invocationCallOrder[0]).toBeLessThan(
      posthog.capture.mock.invocationCallOrder[0]
    );
  });

  it("잘못된 값은 버리되 주소에서는 지운다", () => {
    window.history.replaceState(null, "", "/?ph_did=me%40mail.com&ph_sid=x");
    initAnalytics("phc_test");
    expect(posthog.init.mock.calls[0][1].bootstrap).toBeUndefined();
    expect(window.location.search).toBe("");
  });

  it("이 브라우저에 저장된 ID가 있으면 덮어쓰지 않는다", () => {
    localStorage.setItem("ph_phc_test_posthog", "{}");
    window.history.replaceState(null, "", `/?ph_did=${DID}&ph_ts=${NOW()}`);
    initAnalytics("phc_test");
    expect(posthog.init.mock.calls[0][1].bootstrap).toBeUndefined();
  });

  it("발급 10분이 지난 링크는 이어 붙이지 않고 주소에서만 지운다", () => {
    window.history.replaceState(
      null,
      "",
      `/?ph_did=${DID}&ph_sid=${SID}&ph_ts=${NOW() - 11 * 60}`
    );
    initAnalytics("phc_test");
    expect(posthog.init.mock.calls[0][1].bootstrap).toBeUndefined();
    expect(window.location.search).toBe("");
  });

  it("거부한 브라우저는 켜지 않고 주소만 지운다", () => {
    setAnalyticsOptOut(true);
    window.history.replaceState(null, "", `/?ph_did=${DID}`);
    initAnalytics("phc_test");
    expect(posthog.init).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });
});
