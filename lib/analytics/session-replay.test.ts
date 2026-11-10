import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  __loaded: false,
  init: vi.fn(),
  register: vi.fn(),
  capture: vi.fn(),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: posthog }));

import {
  beforeSend,
  initAnalytics,
  setAnalyticsOptOut,
  syncSessionReplay,
  setSessionReplayConsent,
} from "./track";
import {
  SESSION_REPLAY_CONFIG,
  SESSION_REPLAY_EFFECTIVE,
} from "./session-replay";
import { LEGAL_CURRENT } from "../page-dates";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T00:00:00+09:00"));
  window.history.replaceState({}, "", "/w/real-workspace");
  localStorage.clear();
  posthog.__loaded = false;
  setAnalyticsOptOut(false);
  setSessionReplayConsent([
    {
      documentType: "PRIVACY",
      currentVersion: SESSION_REPLAY_EFFECTIVE,
      agreed: true,
    },
  ]);
  vi.clearAllMocks();
  posthog.__loaded = true;
});
afterEach(() => {
  Reflect.deleteProperty(window, "heymoaDesktop");
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("시행일·화면·수집 선택에 따른 세션 리플레이", () => {
  it("처리방침과 같은 시행일 전에는 녹화를 시작하지 않습니다", () => {
    expect(LEGAL_CURRENT.privacy.effective).toBe(SESSION_REPLAY_EFFECTIVE);
    const effective = Date.parse(`${SESSION_REPLAY_EFFECTIVE}T00:00:00+09:00`);
    vi.setSystemTime(effective - 1);
    syncSessionReplay();
    expect(posthog.startSessionRecording).not.toHaveBeenCalled();
    expect(posthog.stopSessionRecording).toHaveBeenCalledOnce();
    vi.setSystemTime(effective);
    syncSessionReplay();
    expect(posthog.startSessionRecording).toHaveBeenCalledExactlyOnceWith();
  });

  it("지난 버전 동의·미동의·조회 실패에서는 녹화하지 않습니다", () => {
    for (const consents of [
      [],
      [{ documentType: "PRIVACY", currentVersion: "2026-11-03", agreed: true }],
      [
        {
          documentType: "PRIVACY",
          currentVersion: SESSION_REPLAY_EFFECTIVE,
          agreed: false,
        },
      ],
    ]) {
      setSessionReplayConsent(consents);
    }
    expect(posthog.startSessionRecording).not.toHaveBeenCalled();
    expect(posthog.stopSessionRecording).toHaveBeenCalledTimes(3);
  });

  it.each([
    "/auth/login",
    "/auth/callback",
    "/oauth/google",
    "/invite",
    "/w/0R1Q3TMN6P4QY",
    "/w/0RSQB39CHT4ZV/notes/private",
  ])("제외 화면 %s에서는 중지합니다", (path) => {
    window.history.replaceState({}, "", path);
    syncSessionReplay();
    expect(posthog.startSessionRecording).not.toHaveBeenCalled();
    expect(posthog.stopSessionRecording).toHaveBeenCalledOnce();
  });

  it("데스크톱 인증 브리지에서는 녹화하지 않습니다", () => {
    Object.defineProperty(window, "heymoaDesktop", {
      configurable: true,
      value: {},
    });
    syncSessionReplay();
    expect(posthog.stopSessionRecording).toHaveBeenCalledOnce();
    expect(posthog.startSessionRecording).not.toHaveBeenCalled();
  });

  it("통계 수집을 거부하면 즉시 중지하고 남은 snapshot도 폐기합니다", () => {
    syncSessionReplay();
    setAnalyticsOptOut(true);
    expect(posthog.stopSessionRecording).toHaveBeenCalledOnce();
    expect(
      beforeSend({ event: "$snapshot", properties: {} } as Parameters<
        typeof beforeSend
      >[0])
    ).toBeNull();
    setAnalyticsOptOut(false);
    expect(posthog.startSessionRecording).toHaveBeenCalledTimes(2);
  });

  it("거부 선택을 저장할 수 없어도 녹화와 snapshot 전송을 막습니다", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    setAnalyticsOptOut(true);
    expect(posthog.stopSessionRecording).toHaveBeenCalledOnce();
    expect(
      beforeSend({ event: "$snapshot", properties: {} } as Parameters<
        typeof beforeSend
      >[0])
    ).toBeNull();
  });

  it("다른 탭에서 통계 수집을 거부해도 진행 중 녹화를 중지합니다", () => {
    posthog.__loaded = false;
    posthog.init.mockImplementation(() => {
      posthog.__loaded = true;
    });
    initAnalytics("phc_test");
    localStorage.setItem("heymoa:analytics-opt-out", "1");
    window.dispatchEvent(
      new StorageEvent("storage", { key: "heymoa:analytics-opt-out" })
    );
    expect(posthog.stopSessionRecording).toHaveBeenCalledOnce();
    expect(
      beforeSend({ event: "$snapshot", properties: {} } as Parameters<
        typeof beforeSend
      >[0])
    ).toBeNull();
  });
});

describe("녹화 원문이 브라우저 밖으로 나가지 않는 설정", () => {
  it("텍스트·입력·속성을 가리고 원본 미디어·인증 입력은 차단합니다", () => {
    expect(SESSION_REPLAY_CONFIG).toMatchObject({
      maskAllInputs: true,
      maskTextSelector: "*",
      maskAllElementAttributes: true,
      recordBody: false,
      recordHeaders: false,
      captureJsonLd: false,
      recordCrossOriginIframes: false,
      captureCanvas: { recordCanvas: false },
    });
    const root = document.createElement("div");
    root.innerHTML =
      '<input type="hidden"><input type="file"><img><picture></picture><audio></audio><video></video><source><canvas></canvas><iframe></iframe><object></object><embed><svg><image /></svg>';
    expect(
      root.querySelectorAll(SESSION_REPLAY_CONFIG.blockSelector)
    ).toHaveLength(12);
  });

  it("주소의 code·토큰을 제거하고 네트워크 본문·헤더를 결과에 넣지 않습니다", () => {
    const request = {
      name: "https://heymoa.app/auth/callback?code=secret#token",
      entryType: "resource",
      startTime: 0,
      duration: 20,
      requestHeaders: { Authorization: "secret" },
      responseBody: "private transcript",
    };
    expect(SESSION_REPLAY_CONFIG.maskCapturedNetworkRequestFn(request)).toEqual(
      {
        name: "https://heymoa.app/auth/callback",
        entryType: "resource",
        startTime: 0,
        duration: 20,
      }
    );
  });
});
