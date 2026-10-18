import type { CaptureResult } from "posthog-js";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  type AnalyticsEvent,
  beforeSend,
  isAnalyticsOptedOut,
  onTrack,
  setAnalyticsOptOut,
  stripUrlQueries,
  track,
  trackMutation,
} from "@/lib/analytics/track";

afterEach(() => {
  delete (window as { gtag?: unknown }).gtag;
  localStorage.clear();
});

describe("이벤트 타입", () => {
  it("등록한 행동만 허용하고 탭 속성은 enum으로 제한합니다", () => {
    expectTypeOf<"note_opened" | "feedback_sent">().toExtend<AnalyticsEvent>();
    expectTypeOf<"not_registered" | "user_signed_up">().not.toExtend<AnalyticsEvent>();
    expectTypeOf(track<"note_tab_opened">).parameter(1).exclude<undefined>().toEqualTypeOf<{
      workspace_id: string;
      tab: "context" | "details" | "transcript" | "summary";
    }>();
  });
});

describe("trackMutation", () => {
  const heardFrom = (calls: Array<[string, unknown]>) => {
    const heard: Array<[string, unknown]> = [];
    const stop = onTrack((event, properties) => heard.push([event, properties]));
    for (const [key, variables] of calls) trackMutation(key, variables);
    stop();
    return heard;
  };

  it("문의 종류만 보내고 본문·이메일·주소는 보내지 않습니다", () => {
    expect(heardFrom([
      ["createFeedback", { data: { kind: "QUESTION", message: "개인 본문 user@example.com https://example.com/?secret=1" } }],
      ["createFeedback", { data: { kind: "자유 입력" } }],
    ])).toEqual([["feedback_sent", { kind: "QUESTION" }]]);
  });

  // 요청 내용으로 거르는 것 (APP-1072): 화자 연결을 지우거나 완료가 아닌 할 일 수정은 세지 않는다
  it("요청 내용을 보고 보낼지와 속성을 정한다", () => {
    expect(
      heardFrom([
        ["assignSegmentSpeaker", { noteId: "N1", segmentId: "S1", data: { userId: "U1" } }],
        ["assignNoteSpeaker", { noteId: "N1", label: "A", data: { participantId: null } }],
        ["updateProjectTask", { workspaceId: "W1", projectId: "P1", taskId: "T1", data: { taskStatus: "OPEN" } }],
        ["updateProjectTask", { workspaceId: "W1", projectId: "P1", taskId: "T1", data: { taskStatus: "COMPLETED" } }],
        ["resolveToolApproval", { chatId: "C1", approvalId: "A1", data: { decision: "REJECTED" } }],
        ["disconnectWorkspaceIntegration", { workspaceId: "W1", provider: "LINEAR" }],
        ["requestAnalysis", { noteId: "N1" }],
      ])
    ).toEqual([
      ["speaker_assigned", undefined],
      ["task_completed", { workspace_id: "W1" }],
      ["tool_call_resolved", { decision: "REJECTED" }],
      ["integration_disconnected", { workspace_id: "W1", provider: "LINEAR" }],
      ["analysis_requested", undefined],
    ]);
  });


  it("표에 있는 operationId만 이벤트로 바꾼다", () => {
    const heard: string[] = [];
    const stop = onTrack((event) => heard.push(event));

    trackMutation("approveMeetingReview", { workspaceId: "W1", noteId: "N1" });
    trackMutation("updateNote", { workspaceId: "W1" });
    stop();

    expect(heard).toEqual(["summary_confirmed"]);
  });
});

// 같은 사건을 GA와 PostHog가 따로 세지 않게 GA는 유입만 받는다 (APP-1037)
describe("GA로 가는 이벤트", () => {
  it("유입 이벤트만 GA로 보낸다", () => {
    const gtag = vi.fn();
    (window as { gtag?: unknown }).gtag = gtag;

    track("summary_confirmed", { workspace_id: "W1" });
    track("desktop_download_clicked");

    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "desktop_download_clicked", undefined);
  });
});

describe("track", () => {
  it("PostHog가 꺼져 있어도 듣는 쪽에는 알린다", () => {
    const heard: string[] = [];
    const stop = onTrack((event) => heard.push(event));

    track("invite_sent");
    stop();
    track("invite_sent");

    expect(heard).toEqual(["invite_sent"]);
  });
});

describe("이용 통계 거부", () => {
  it("끄면 바깥으로는 안 보내고, 체크리스트는 계속 듣는다", () => {
    const gtag = vi.fn();
    (window as { gtag?: unknown }).gtag = gtag;
    const heard: string[] = [];
    const stop = onTrack((event) => heard.push(event));

    setAnalyticsOptOut(true);
    track("login_started");
    setAnalyticsOptOut(false);
    track("desktop_download_clicked");
    stop();

    expect(heard).toEqual(["login_started", "desktop_download_clicked"]);
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "desktop_download_clicked", undefined);
    expect(isAnalyticsOptedOut()).toBe(false);
  });
});

describe("저장소가 막힌 브라우저", () => {
  it("이번 문서 동안은 끈 것을 지킨다", () => {
    const gtag = vi.fn();
    (window as { gtag?: unknown }).gtag = gtag;
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);

    setAnalyticsOptOut(true);
    track("login_started");

    expect(isAnalyticsOptedOut()).toBe(true);
    expect(gtag).not.toHaveBeenCalled();
    get.mockRestore();
    set.mockRestore();
    setAnalyticsOptOut(false);
  });
});

describe("저장 공간이 꽉 찬 브라우저", () => {
  // 쓰기만 실패하고 읽기는 된다 — 저장소에는 옛 값(켜짐)이 남아 있다 (codex 리뷰 3회차)
  it("저장하지 못한 거부를 옛 값보다 먼저 지킨다", () => {
    const gtag = vi.fn();
    (window as { gtag?: unknown }).gtag = gtag;
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    setAnalyticsOptOut(true);
    track("login_started");

    expect(isAnalyticsOptedOut()).toBe(true);
    expect(gtag).not.toHaveBeenCalled();
    // SDK도 동의를 저장하지 못해 자동 페이지뷰를 보내려 한다 — 마지막 관문에서 막는다
    expect(
      beforeSend({ uuid: "u", event: "$pageview", properties: {} } as CaptureResult)
    ).toBeNull();
    set.mockRestore();
    setAnalyticsOptOut(false);
    expect(isAnalyticsOptedOut()).toBe(false);
  });
});

describe("stripUrlQueries", () => {
  it("초대 토큰처럼 쿼리에 실린 값을 주소에서 지운다", () => {
    const event = {
      uuid: "u",
      event: "$pageview",
      properties: {
        $current_url: "https://heymoa.app/invite?token=SECRET#x",
        $pathname: "/invite",
        // SDK가 이름을 조합해 붙이는 진입 속성 — 이름 목록으로 막았을 때 샜다
        $session_entry_url: "https://heymoa.app/oauth/consent?state=S&code=C",
        $session_entry_referrer: "https://heymoa.app/invite?token=SECRET",
        utm_source: "newsletter",
        $initial_person_info: { u: "https://heymoa.app/invite?token=SECRET", r: "$direct" },
      },
      $set_once: { $initial_current_url: "https://heymoa.app/oauth/consent?state=S" },
    } as CaptureResult;

    const result = stripUrlQueries(event);

    expect(result?.properties.$current_url).toBe("https://heymoa.app/invite");
    expect(result?.properties.$pathname).toBe("/invite");
    expect(result?.properties.$session_entry_url).toBe("https://heymoa.app/oauth/consent");
    expect(result?.properties.$session_entry_referrer).toBe("https://heymoa.app/invite");
    expect(result?.properties.utm_source).toBe("newsletter");
    expect(result?.properties.$initial_person_info).toEqual({
      u: "https://heymoa.app/invite",
      r: "$direct",
    });
    expect(JSON.stringify(result)).not.toMatch(/SECRET|state=|code=/);
    expect(result?.$set_once?.$initial_current_url).toBe(
      "https://heymoa.app/oauth/consent"
    );
  });
});
