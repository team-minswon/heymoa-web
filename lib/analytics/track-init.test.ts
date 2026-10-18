import { describe, expect, it, vi } from "vitest";

// PostHog를 켜기 전·후를 보려고 SDK를 대역으로 바꾼다. 모듈 상태(켜기 전 큐)가 남으므로 파일을 따로 둔다.
const posthog = vi.hoisted(() => ({
  __loaded: false,
  init: vi.fn(),
  capture: vi.fn(),
  register: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: posthog }));

import {
  initAnalytics,
  setAnalyticsOptOut,
  track,
  trackMutation,
} from "@/lib/analytics/track";

describe("PostHog를 켜기 전에 난 이벤트", () => {
  // 연동 복귀 주소·요약 링크로 처음 들어오면 그 화면의 effect가 초기화 effect보다 먼저 돈다
  it("켤 때 차례대로 보낸다", () => {
    posthog.init.mockImplementation(() => {
      posthog.__loaded = true;
    });

    track("integration_connected", { provider: "LINEAR" });
    track("summary_viewed", { workspace_id: "W1" });
    expect(posthog.capture).not.toHaveBeenCalled();

    initAnalytics("phc_test");
    track("meeting_ended");

    // 기능 플래그 요청은 identify 때 userId 를 before_send 밖으로 보낸다 — 쓰지 않으므로 끈다
    expect(posthog.init.mock.calls[0][1]).toMatchObject({
      advanced_disable_flags: true,
      autocapture: false,
      disable_session_recording: true,
    });

    expect(posthog.capture.mock.calls).toEqual([
      ["integration_connected", { provider: "LINEAR" }],
      ["summary_viewed", { workspace_id: "W1" }],
      ["meeting_ended", undefined],
    ]);
  });
});

describe("거부한 브라우저", () => {
  // 켜면 이벤트가 아니어도 SDK가 스스로 요청을 보낸다(기능 플래그·원격 설정) — 아예 켜지 않는다
  it("PostHog를 켜지 않는다", () => {
    posthog.__loaded = false;
    posthog.init.mockClear();
    setAnalyticsOptOut(true);

    initAnalytics("phc_test");

    expect(posthog.init).not.toHaveBeenCalled();
    setAnalyticsOptOut(false);
  });
});


describe("새 행동 이벤트의 수집 거부", () => {
  it("초기화 전 거부한 이벤트는 큐에도 남기지 않습니다", () => {
    posthog.__loaded = false;
    posthog.capture.mockClear();
    setAnalyticsOptOut(true);
    track("note_opened", { workspace_id: "01K0000000000", view: "side" });
    trackMutation("createFeedback", { data: { kind: "QUESTION", message: "보내지 않을 본문입니다" } });
    setAnalyticsOptOut(false);
    initAnalytics("phc_test");
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("초기화 후에도 직접 호출과 mutation 모두 PostHog로 보내지 않습니다", () => {
    posthog.__loaded = true;
    posthog.capture.mockClear();
    setAnalyticsOptOut(true);
    try {
      track("recording_start_clicked", { workspace_id: "01K0000000000", retry: false });
      track("recording_stop_clicked", { surface: "note" });
      track("note_opened", { workspace_id: "01K0000000000", view: "full" });
      track("note_tab_opened", { workspace_id: "01K0000000000", tab: "summary" });
      track("review_confirmation_clicked", { workspace_id: "01K0000000000" });
      track("settings_tab_opened", { workspace_id: "01K0000000000", section: "account" });
      track("agent_opened", { surface: "fab" });
      trackMutation("createFeedback", { data: { kind: "QUESTION", message: "보내지 않을 본문입니다" } });
      expect(posthog.capture).not.toHaveBeenCalled();
    } finally {
      setAnalyticsOptOut(false);
    }
  });
});
