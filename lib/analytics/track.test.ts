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

  // 메일·알림 유입 계측 (APP-1309): 출처는 닫힌 값이고 노트 id·이메일·이름·제목 자리는 없다
  it("note_opened 는 출처를 enum 으로만 받고 식별·내용 값을 받지 않는다", () => {
    type NoteOpened = Parameters<typeof track<"note_opened">>[1] & {};
    expectTypeOf<NoteOpened>().toEqualTypeOf<{
      workspace_id: string;
      view: "side" | "full";
      source: "list" | "notification" | "mail";
    }>();
    expectTypeOf<"note_id" | "noteId" | "email" | "name" | "title">().not.toExtend<keyof NoteOpened>();
    // @ts-expect-error 등록하지 않은 출처는 보낼 수 없다
    track("note_opened", { workspace_id: "W1", view: "side", source: "push" });
    // @ts-expect-error 출처를 빠뜨릴 수 없다
    track("note_opened", { workspace_id: "W1", view: "side" });
    // @ts-expect-error 제목 같은 내용을 실을 수 없다
    track("note_opened", { workspace_id: "W1", view: "side", source: "mail", title: "회의" });
  });
});

// 알림 모달·알림 설정 (PRO-67 I32): 종류·개수·워크스페이스만 받고 알림 내용·식별 값 자리는 없다
describe("알림 사건 타입", () => {
  type Props<E extends AnalyticsEvent> = Parameters<typeof track<E>>[1] & {};
  type Forbidden = "note_id" | "noteId" | "notification_id" | "email" | "name" | "title";

  it("다섯 이름을 등록하고 속성 모양을 정의와 맞춘다", () => {
    expectTypeOf<
      | "notifications_opened"
      | "notification_clicked"
      | "notifications_all_read_clicked"
      | "notification_setting_changed"
      | "notification_settings_reset"
    >().toExtend<AnalyticsEvent>();
    expectTypeOf<Props<"notifications_opened">>().toEqualTypeOf<{
      workspace_id: string;
      unread_count: number;
    }>();
    expectTypeOf<Props<"notification_clicked">>().toEqualTypeOf<{
      workspace_id: string;
      type: "WORKSPACE_INVITATION" | "ANALYSIS_READY";
      was_unread: boolean;
    }>();
    expectTypeOf<Props<"notifications_all_read_clicked">>().toEqualTypeOf<{
      workspace_id: string;
      count: number;
    }>();
    expectTypeOf<Props<"notification_settings_reset">>().toEqualTypeOf<{
      workspace_id: string;
    }>();
    expectTypeOf<Props<"settings_tab_opened">["section"]>().toExtend<string>();
    expectTypeOf<"notifications">().toExtend<Props<"settings_tab_opened">["section"]>();
    expectTypeOf<Props<"settings_tab_opened">["from"]>().toEqualTypeOf<"modal" | "settings">();
  });

  it("식별·내용 값을 받지 않는다", () => {
    expectTypeOf<Forbidden>().not.toExtend<keyof Props<"notifications_opened">>();
    expectTypeOf<Forbidden>().not.toExtend<keyof Props<"notification_clicked">>();
    expectTypeOf<Forbidden>().not.toExtend<keyof Props<"notifications_all_read_clicked">>();
    expectTypeOf<Forbidden>().not.toExtend<keyof Props<"notification_setting_changed">>();
    expectTypeOf<Forbidden>().not.toExtend<keyof Props<"notification_settings_reset">>();
    // @ts-expect-error 알림 제목을 실을 수 없다
    track("notification_clicked", { workspace_id: "W1", type: "WORKSPACE_INVITATION", was_unread: true, title: "초대" });
    // @ts-expect-error 계약에 없는 종류는 보낼 수 없다
    track("notification_clicked", { workspace_id: "W1", type: "SOMETHING", was_unread: true });
  });

  it("타임라인 안내 사건은 역할·닫힌 이유만 받는다 (PRO-67 I26)", () => {
    expectTypeOf<Props<"timeline_hint_shown">>().toEqualTypeOf<{
      workspace_id: string;
      role: "recorder" | "viewer";
    }>();
    expectTypeOf<Props<"timeline_hint_clicked">>().toEqualTypeOf<Props<"timeline_hint_shown">>();
    expectTypeOf<Props<"timeline_hint_dismissed">>().toEqualTypeOf<{
      workspace_id: string;
      reason: "auto" | "close";
    }>();
    expectTypeOf<Forbidden>().not.toExtend<keyof Props<"timeline_hint_shown">>();
    expectTypeOf<Forbidden>().not.toExtend<keyof Props<"timeline_hint_dismissed">>();
  });

  it("설정 변경은 종류 하나를 바꿀 때만 종류·채널을 싣는다", () => {
    track("notification_setting_changed", { workspace_id: "W1", scope: "all", enabled: false });
    track("notification_setting_changed", {
      workspace_id: "W1",
      scope: "type",
      type: "MEETING_PAUSED_REMINDER",
      channel: "EMAIL",
      enabled: false,
    });
    // @ts-expect-error 종류 하나를 바꾸면 채널이 있어야 한다
    track("notification_setting_changed", { workspace_id: "W1", scope: "type", type: "MEETING_AUTO_ENDED", enabled: true });
    // @ts-expect-error 등록하지 않은 범위
    track("notification_setting_changed", { workspace_id: "W1", scope: "web", enabled: true });
  });
});

// 가이드 이벤트(로그인 전 방문자도 온다): 이름은 유니온에만, 속성은 닫힌 값·숫자·slug 뿐이고 검색어 원문 필드는 없다.
describe("가이드 이벤트 타입", () => {
  it("검색 이벤트는 길이와 개수만 받고 원문을 받지 않는다", () => {
    expectTypeOf<
      "help_page_viewed" | "help_search_submitted" | "help_result_clicked" | "help_nav_clicked"
    >().toExtend<AnalyticsEvent>();
    expectTypeOf(track<"help_search_submitted">).parameter(1).exclude<undefined>().toEqualTypeOf<{
      query_length: number;
      result_count: number;
      zero_results: boolean;
      language: "ko" | "en";
    }>();
    expectTypeOf(track<"help_result_clicked">).parameter(1).exclude<undefined>().toEqualTypeOf<{
      slug: string;
      rank: number;
      query_length: number;
      language: "ko" | "en";
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
