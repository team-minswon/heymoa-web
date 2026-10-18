import posthog, { type CaptureResult } from "posthog-js";

import { desktopAuthBridge } from "@/lib/desktop/auth";

/**
 * 보내는 이벤트 이름. **여기 없는 이름은 보낼 수 없다** — PostHog 깔때기는 이름 문자열로
 * 묶이므로 호출부마다 손으로 쓰면 `meeting_create`·`meeting_created`처럼 갈라진다.
 *
 * 깔때기: login_started → login_completed → workspace_created → project_created →
 * meeting_created → recording_started → meeting_ended → summary_viewed → summary_confirmed.
 * 「가입」은 따로 보내지 않는다 — 서버가 신규 여부를 주지 않고, 사람마다 첫 `login_completed`가 곧 가입이다.
 */
export type AnalyticsEvent =
  | "login_started"
  | "login_completed"
  | "workspace_created"
  | "project_created"
  | "meeting_created"
  | "recording_started"
  | "recording_failed"
  | "meeting_ended"
  | "summary_viewed"
  | "summary_confirmed"
  | "invite_sent"
  | "invite_accepted"
  | "task_created"
  | "chat_message_sent"
  | "integration_connected"
  | "agent_connected"
  | "desktop_download_clicked"
  | "help_opened"
  | "feedback_opened"
  | "onboarding_dismissed"
  | "onboarding_reopened"
  | "onboarding_completed"
  | "speaker_assigned"
  | "review_item_edited"
  | "tool_call_resolved"
  | "task_completed"
  | "analysis_requested"
  | "agent_disconnected"
  | "integration_disconnected"
  | "summary_copied"
  | "summary_exported"
  | "export_requested"
  | "minutes_emailed";

type Properties = Record<string, string | number | boolean | null | undefined>;

/** orval mutation 변수 — 경로 값(`workspaceId` 등)과 요청 본문(`data`). */
type MutationVariables = Record<string, unknown>;

/**
 * 이벤트 이름 하나, 또는 요청 내용을 보고 이벤트와 속성을 고르는 함수. 함수가 null 이면 보내지 않는다.
 * 속성은 enum 만 싣는다 — 처리방침 7조가 적은 범위(회원 · 워크스페이스 식별자, 사용한 기능)를 넘지 않게
 * note_id · chat_id 같은 새 식별자는 보내지 않는다(APP-1072).
 */
type MutationEvent =
  | AnalyticsEvent
  | ((variables: MutationVariables) => readonly [AnalyticsEvent, Properties?] | null);

const bodyOf = (variables: MutationVariables) =>
  (typeof variables.data === "object" && variables.data !== null
    ? variables.data
    : {}) as Record<string, unknown>;

/** 누군가에게 잇는 요청인가. 셋 다 비우면 연결을 지우거나 「참석자 중에 없다」로 둔 것이라 세지 않는다. */
const assignsSomeone = (variables: MutationVariables) => {
  const body = bodyOf(variables);
  return Boolean(body.participantId || body.guestId || body.userId);
};

/**
 * 성공한 mutation(orval operationId) → 이벤트. 호출부마다 `track()`을 흩지 않고
 * `MutationCache.onSuccess` 한 곳에서 본다(`lib/query/query-client.ts`).
 */
const MUTATION_EVENTS: Record<string, MutationEvent> = {
  createWorkspace: "workspace_created",
  createProject: "project_created",
  createNote: "meeting_created",
  endMeeting: "meeting_ended",
  approveMeetingReview: "summary_confirmed",
  createWorkspaceInvitation: "invite_sent",
  acceptInvitationByToken: "invite_accepted",
  acceptWorkspaceInvitation: "invite_accepted",
  createProjectTask: "task_created",
  sendAgentChatMessage: "chat_message_sent",
  approveAgentOAuthConsent: "agent_connected",
  createAgentDelegation: "agent_connected",
  assignNoteSpeaker: (v) => (assignsSomeone(v) ? ["speaker_assigned"] : null),
  assignSegmentSpeaker: (v) => (assignsSomeone(v) ? ["speaker_assigned"] : null),
  createMeetingReviewItem: () => ["review_item_edited", { action: "created" }],
  updateMeetingReviewItem: () => ["review_item_edited", { action: "updated" }],
  resolveToolApproval: (v) => [
    "tool_call_resolved",
    { decision: String(bodyOf(v).decision) },
  ],
  // ponytail: 이미 완료된 할 일의 내용만 고쳐도 다시 센다 — 바뀌기 전 상태가 변수에 없다.
  updateProjectTask: (v) =>
    bodyOf(v).taskStatus === "COMPLETED" ? ["task_completed"] : null,
  requestAnalysis: "analysis_requested",
  revokeAgentDelegation: "agent_disconnected",
  // 받는 사람 주소는 싣지 않는다 — 수와 붙임 종류만 센다
  sendNoteShareMail: (v) => {
    const body = bodyOf(v);
    const include = Array.isArray(body.include) ? body.include : [];
    return [
      "minutes_emailed",
      {
        recipient_count: Array.isArray(body.recipients) ? body.recipients.length : 0,
        agenda_log: include.includes("AGENDA_LOG"),
        transcript: include.includes("TRANSCRIPT"),
      },
    ];
  },
  disconnectWorkspaceIntegration: (v) => [
    "integration_disconnected",
    { provider: String(v.provider) },
  ],
};

/**
 * 도구마다 맡는 것 (APP-1037). **같은 사건을 두 도구가 따로 세지 않게** GA에는 유입 이벤트만 보낸다.
 *
 * | 무엇 | 정본 |
 * |---|---|
 * | 제품 깔때기 · 유입별 가입 전환 | PostHog — 모든 이벤트. UTM·referrer를 사람의 첫 값으로 남긴다 |
 * | 유입 경로 · 검색 유입 | GA4 — 페이지뷰와 아래 `GA_EVENTS`뿐. Search Console을 여기 잇는다 |
 * | 성능(Web Vitals) | Vercel Speed Insights · Analytics |
 * | 검색 노출 · 색인 | Search Console |
 */
const GA_EVENTS = new Set<AnalyticsEvent>([
  "login_started",
  "desktop_download_clicked",
]);

/** 이벤트를 듣는 쪽. 온보딩 체크리스트가 「해 봤다」를 기록할 때 쓴다. */
type Listener = (event: AnalyticsEvent, properties?: Properties) => void;
const listeners = new Set<Listener>();

export function onTrack(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * PostHog에 보내고, 유입 이벤트(`GA_EVENTS`)는 GA에도 같은 이름으로 보낸다. **수집이 꺼진 환경(로컬·preview)에서는 아무것도
 * 보내지 않는다** — PostHog는 `init` 전이면, GA는 `gtag`가 없으면 그냥 지나간다. 게이트는
 * `SiteAnalytics` 한 곳이다.
 *
 * 속성에 회의 제목·전사·이메일을 넣지 않는다. 개인정보처리방침이 「회의 음성·스크립트·노트는
 * 분석 도구로 보내지 않는다」고 약속한다. id와 종류·개수만 싣는다.
 */
/**
 * PostHog를 켜기 전에 난 이벤트. 초기화는 `SiteAnalytics`의 effect인데, 연동 복귀 주소나 요약 링크로 처음 들어오면
 * 그 화면의 effect가 먼저 돌아 `integration_connected`·`summary_viewed`가 여기 먼저 온다. 켤 때 차례대로 보낸다.
 *
 * ponytail: 켜지지 않는 환경(로컬·preview·키 없음)에서 끝없이 쌓이지 않게 20개에서 자른다. 첫 화면에서 그보다
 * 많이 나는 일은 없다 — 넘치면 늦은 것부터 버려진다.
 */
const BEFORE_INIT_LIMIT = 20;
const beforeInit: Array<[AnalyticsEvent, Properties | undefined]> = [];

export function track(event: AnalyticsEvent, properties?: Properties) {
  // 듣는 쪽(체크리스트)은 이 기기 안의 일이라 거부해도 알린다. 바깥으로 보내는 것만 막는다.
  for (const listener of listeners) listener(event, properties);
  if (isAnalyticsOptedOut()) return;
  if (posthog.__loaded) posthog.capture(event, properties);
  else if (beforeInit.length < BEFORE_INIT_LIMIT) beforeInit.push([event, properties]);
  if (GA_EVENTS.has(event)) {
    const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.("event", event, properties);
  }
  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", event, properties ?? {});
  }
}

export function trackMutation(mutationKey: unknown, variables: unknown) {
  const entry = MUTATION_EVENTS[String(mutationKey)];
  if (!entry) return;
  const vars = (
    typeof variables === "object" && variables !== null ? variables : {}
  ) as MutationVariables;
  const resolved = typeof entry === "function" ? entry(vars) : ([entry] as const);
  if (!resolved) return;
  const [event, extra] = resolved;
  const properties: Properties = {
    ...("workspaceId" in vars && { workspace_id: String(vars.workspaceId) }),
    ...extra,
  };
  track(event, Object.keys(properties).length > 0 ? properties : undefined);
}

export function initAnalytics(apiKey: string) {
  // 거부한 브라우저에서는 켜지 않는다 — 켜면 이벤트가 아니어도 SDK가 스스로 요청을 보낸다. 다시 허용하면 다음에
  // 열 때부터 켜진다. 거부의 원본은 우리 키 하나이고 SDK의 동의 저장(opt_out_capturing)은 쓰지 않는다 —
  // `reset()`이 그것을 지우고 저장소가 꽉 차면 저장도 안 돼 우리 키와 어긋났다(codex 리뷰 4·5회차).
  if (posthog.__loaded || isAnalyticsOptedOut()) return;
  posthog.init(apiKey, {
    // ponytail: 광고 차단기에 막히는 만큼 덜 잡힌다. 많이 빠지면 next.config rewrites로
    // `/ingest` 프록시를 둔다(proxy.ts matcher에서 그 경로를 빼야 토큰 갱신이 안 돈다).
    api_host: "https://us.i.posthog.com",
    defaults: "2026-08-30",
    person_profiles: "identified_only",
    // 화면 글자를 가져가는 수집은 전부 끈다. 전사·요약이 화면에 그대로 있고, 처리방침이
    // 그것을 분석 도구로 보내지 않는다고 약속한다. 이벤트는 `track()`으로만 보낸다.
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    disable_session_recording: true,
    disable_surveys: true,
    // 기능 플래그를 쓰지 않는다. 켜 두면 `identify()`마다 `/flags`로 userId가 나가는데 `before_send`를 거치지
    // 않는다. 원격 설정도 같이 꺼지므로 쓰는 기능은 위처럼 여기서 모두 정한다.
    advanced_disable_flags: true,
    before_send: beforeSend,
  });
  posthog.register({ client: desktopAuthBridge() ? "desktop" : "web" });
  for (const [event, properties] of beforeInit.splice(0)) {
    posthog.capture(event, properties);
  }
}

const OPT_OUT_KEY = "heymoa:analytics-opt-out";

/**
 * 이번 문서에서 바꿨지만 **저장하지 못한** 선택 — 저장소가 막혔거나(사생활 보호 모드) 꽉 찼다.
 * 있으면 저장소보다 먼저 본다. 쓰기만 실패하고 읽기는 되면 저장소에는 옛 값이 남아 있기 때문이다.
 * 저장이 되는 평소에는 비어 있어서 다른 탭에서 바꾼 값도 저장소로 따라간다.
 */
let unsavedOptOut: boolean | undefined;

/**
 * 「이용 통계 보내기」를 끈 브라우저인가 — PostHog를 켤 때 개인정보 처리방침 5조에 거부 방법으로 적는다.
 * **기기(브라우저)별이다.** 계정에 묶으려면 서버에 사용자 설정이 있어야 한다.
 */
export function isAnalyticsOptedOut() {
  if (unsavedOptOut !== undefined) return unsavedOptOut;
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 끄면 PostHog로 가는 이벤트는 `beforeSend`가, GA로 가는 기능 이벤트는 `track()`이 막는다. 다음에 열 때는 PostHog를
 * 아예 켜지 않는다. GA 페이지뷰는 Google 차단 부가기능 몫이다.
 */
export function setAnalyticsOptOut(optOut: boolean) {
  try {
    if (optOut) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
    unsavedOptOut = undefined;
  } catch {
    // 저장하지 못했다 — 이번 문서 동안은 위 `unsavedOptOut`으로 지킨다.
    unsavedOptOut = optOut;
  }
}

/** userId만 쓴다. 이메일·이름은 보내지 않는다 — PostHog를 켤 때 처리방침 7절에 이 항목만 적는다. */
export function identifyUser(userId: string) {
  if (posthog.__loaded && posthog.get_distinct_id() !== userId) {
    posthog.identify(userId);
  }
}

/** 로그아웃·세션 만료로 앱을 떠날 때. 같은 브라우저의 다음 사람이 이전 사람으로 묶이지 않게 한다. */
export function resetAnalytics() {
  if (posthog.__loaded) posthog.reset();
}

/**
 * PostHog로 나가는 **모든** 이벤트가 지나는 마지막 관문. 자동 이벤트(`$pageview`·`$pageleave`)는 `track()`을
 * 거치지 않으므로, 켜진 뒤에 거부한 경우를 여기서 막는다. 거부의 원본은 우리 키 하나다.
 */
export function beforeSend(event: CaptureResult | null) {
  return isAnalyticsOptedOut() ? null : stripUrlQueries(event);
}

/** 절대 주소면 쿼리·해시를 떼고, 아니면 그대로 둔다. */
function withoutQuery(value: unknown) {
  return typeof value === "string" && /^https?:\/\//.test(value)
    ? value.split(/[?#]/)[0]
    : value;
}

/**
 * 주소의 쿼리·해시를 지운다. `/invite?token=`의 초대 토큰과 `/oauth/*`의 state·code가
 * 쿼리에 실려 있어서, 페이지뷰를 그대로 보내면 분석 도구에 남는다.
 *
 * **속성 이름이 아니라 값으로 고른다.** SDK가 붙이는 주소 속성은 `$current_url`·`$referrer`만이 아니라
 * `$session_entry_url`처럼 이름을 조합해 만든 것도 있어서, 이름 목록으로 막으면 새 속성이 생길 때마다 샌다
 * (codex 리뷰 2회차 P1). `$initial_person_info` 같은 한 단계 안쪽 객체의 주소도 같이 지운다.
 */
export function stripUrlQueries(event: CaptureResult | null) {
  if (!event) return event;
  for (const bag of [event.properties, event.$set, event.$set_once]) {
    if (!bag) continue;
    for (const [key, value] of Object.entries(bag)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [innerKey, inner] of Object.entries(value)) {
          (value as Record<string, unknown>)[innerKey] = withoutQuery(inner);
        }
      } else {
        bag[key] = withoutQuery(value);
      }
    }
  }
  return event;
}
