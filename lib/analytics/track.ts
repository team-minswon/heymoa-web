import posthog, { type CaptureResult } from "posthog-js";

import type { BillingSetupCreatedResponseDataProvider } from "@/lib/api/generated/models/billingSetupCreatedResponseDataProvider";
import type { SetupView } from "@/lib/billing/setup-view";
import type { NotificationListResponseDataNotificationsItemType } from "@/lib/api/generated/models/notificationListResponseDataNotificationsItemType";
import type { NotificationSettingsResponseDataItemsItemChannelsItemChannel } from "@/lib/api/generated/models/notificationSettingsResponseDataItemsItemChannelsItemChannel";
import type { NotificationSettingsResponseDataItemsItemType } from "@/lib/api/generated/models/notificationSettingsResponseDataItemsItemType";
import { desktopAuthBridge } from "@/lib/desktop/auth";
import {
  HANDOFF_ANALYTICS_PARAMS,
  type HandoffContext,
} from "@/lib/auth/in-app-browser";
import {
  SESSION_REPLAY_CONFIG,
  SESSION_REPLAY_EFFECTIVE,
} from "@/lib/analytics/session-replay";

export type AnalyticsEvent =
  | "sign_up"
  | "first_recording"
  | "login_started"
  | "browser_handoff_attempted"
  | "browser_handoff_guide_shown"
  | "browser_handoff_link_copied"
  | "browser_handoff_arrived"
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
  | "chat_renamed"
  | "chat_deleted"
  | "chat_diagram_expanded"
  | "chat_example_clicked"
  | "integration_connected"
  | "agent_connected"
  | "desktop_download_clicked"
  | "desktop_panel_opacity_changed"
  | "desktop_update_check_clicked"
  | "desktop_update_automatic_changed"
  | "desktop_update_restart_requested"
  | "desktop_update_restart_blocked"
  | "desktop_update_request_failed"
  | "desktop_update_status_changed"
  | "desktop_update_notice_viewed"
  | "desktop_update_installer_clicked"
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
  | "minutes_emailed"
  | "recording_start_clicked"
  | "recording_stop_clicked"
  | "note_opened"
  | "note_deleted"
  | "agenda_map_opened"
  | "agenda_map_column_expanded"
  | "agenda_map_agenda_selected"
  | "agenda_map_topic_focused"
  | "agenda_map_note_opened"
  | "note_tab_opened"
  | "review_confirmation_clicked"
  | "settings_tab_opened"
  | "billing_plans_viewed"
  | "billing_checkout_entered"
  | "billing_card_setup_resulted"
  | "billing_setup_result_action_clicked"
  | "billing_card_change_resulted"
  | "billing_sales_unavailable_viewed"
  | "billing_receipt_clicked"
  | "billing_cancel_dialog_opened"
  | "billing_subscription_canceled"
  | "billing_subscription_resumed"
  | "billing_card_change_started"
  | "billing_payment_method_deleted"
  | "billing_payment_viewed"
  | "billing_payment_history_viewed"
  | "recording_quota_blocked"
  | "recording_quota_upgrade_clicked"
  | "notifications_opened"
  | "notification_clicked"
  | "notifications_all_read_clicked"
  | "notification_setting_changed"
  | "notification_settings_reset"
  | "timeline_hint_shown"
  | "timeline_hint_clicked"
  | "timeline_hint_dismissed"
  | "speaker_timeline_jumped"
  | "agent_opened"
  | "feedback_sent"
  | "feedback_dismissed"
  | "help_page_viewed"
  | "help_search_opened"
  | "help_search_submitted"
  | "help_result_clicked"
  | "help_nav_clicked"
  | "help_clip_played"
  | "help_clip_zoomed"
  | "help_image_zoomed"
  | "help_cta_clicked"
  | "help_code_copied"
  | "help_faq_opened"
  | "pricing_cta_clicked";

export type BillingProvider = BillingSetupCreatedResponseDataProvider;
export type BillingSetupResult =
  | "completed"
  | "declined"
  | "unknown"
  | "refunded";

export type BillingSetupScreen = BillingSetupResult | SetupView | "loadFailed";
export type BillingCardChangeResult = "completed" | "declined" | "unknown";

type HelpLanguage = "ko" | "en";

export type WebEventProperties = {
  desktop_update_check_clicked: { current_version: string };
  desktop_update_automatic_changed: {
    current_version: string;
    enabled: boolean;
  };
  desktop_update_restart_requested: {
    current_version: string;
    target_version?: string;
  };
  desktop_update_restart_blocked: {
    current_version: string;
    target_version?: string;
    source: "state" | "request";
  };
  desktop_update_request_failed: {
    action: "check" | "automatic" | "restart" | "state";
  };
  desktop_update_status_changed: {
    current_version: string;
    target_version?: string;
    status: import("@heymoa/desktop-contracts").DesktopUpdateState["status"];
    automatic: boolean;
    initial: boolean;
  };
  desktop_update_notice_viewed: {
    current_version?: string;
    platform: "windows" | "mac" | "other";
  };
  desktop_update_installer_clicked: { surface: "dashboard" | "settings" };
  browser_handoff_attempted: HandoffContext & {
    method: "app_scheme" | "android_intent" | "app_parameter" | "manual";
    trigger: "entry" | "login";
    interaction: "automatic" | "click";
  };
  browser_handoff_guide_shown: HandoffContext;
  browser_handoff_link_copied: HandoffContext;
  browser_handoff_arrived: HandoffContext;
  recording_start_clicked: { workspace_id: string; retry: boolean };
  recording_stop_clicked: { surface: "note" | "global" };
  note_deleted: { workspace_id: string };
  note_opened: {
    workspace_id: string;
    view: "side" | "full";
    source: "list" | "notification" | "mail";
  };
  agenda_map_opened: { workspace_id: string; meetings: number; topics: number };
  agenda_map_column_expanded: { workspace_id: string };
  agenda_map_agenda_selected: { workspace_id: string };
  agenda_map_topic_focused: { workspace_id: string };
  agenda_map_note_opened: { workspace_id: string; surface: "panel" | "focus" };
  note_tab_opened: {
    workspace_id: string;
    tab: "context" | "details" | "transcript" | "summary";
  };
  review_confirmation_clicked: { workspace_id: string | undefined };
  desktop_panel_opacity_changed: { opacity: number };
  settings_tab_opened: {
    workspace_id: string;
    section:
      | "account"
      | "language"
      | "workspace"
      | "members"
      | "guests"
      | "terms"
      | "integrations"
      | "appUpdates"
      | "workspaceAgents"
      | "agents"
      | "notifications"
      | "billing"
      | "payment"
      | "myPayments";
    from: "modal" | "settings";
  };
  billing_plans_viewed: { workspace_id: string; role: "admin" | "member" };
  billing_checkout_entered: { workspace_id: string; role: "admin" | "member" };
  billing_card_setup_resulted: {
    workspace_id?: string;
    provider?: BillingProvider;
    result: BillingSetupResult;
  };
  billing_setup_result_action_clicked: {
    action: "recheck" | "retry" | "to_workspace";
    result: BillingSetupScreen;
  };
  billing_card_change_resulted: {
    workspace_id?: string;
    result: BillingCardChangeResult;
  };
  billing_sales_unavailable_viewed: {
    workspace_id: string;
    role: "admin" | "member";
  };
  billing_receipt_clicked: { workspace_id?: string };
  billing_cancel_dialog_opened: { workspace_id: string };
  billing_subscription_canceled: { workspace_id: string };
  billing_subscription_resumed: {
    workspace_id: string;
    result: "resumed" | "not_admin";
  };
  billing_card_change_started: { workspace_id: string };
  billing_payment_method_deleted: {
    workspace_id: string;
    result: "deleted" | "in_use";
  };
  billing_payment_viewed: { workspace_id: string };
  billing_payment_history_viewed: { scope: "workspace" | "me" };
  recording_quota_blocked: { workspace_id: string; role: "admin" | "member" };
  recording_quota_upgrade_clicked: { workspace_id: string };
  notifications_opened: { workspace_id: string; unread_count: number };
  notification_clicked: {
    workspace_id: string;
    type: NotificationListResponseDataNotificationsItemType;
    was_unread: boolean;
  };
  notifications_all_read_clicked: { workspace_id: string; count: number };
  notification_setting_changed:
    | { workspace_id: string; scope: "all" | "email"; enabled: boolean }
    | {
        workspace_id: string;
        scope: "type";
        type: NotificationSettingsResponseDataItemsItemType;
        channel: NotificationSettingsResponseDataItemsItemChannelsItemChannel;
        enabled: boolean;
      };
  notification_settings_reset: { workspace_id: string };
  timeline_hint_shown: { workspace_id: string; role: "recorder" | "viewer" };
  timeline_hint_clicked: { workspace_id: string; role: "recorder" | "viewer" };
  timeline_hint_dismissed: { workspace_id: string; reason: "auto" | "close" };
  speaker_timeline_jumped: {
    workspace_id: string;
    surface: "dock" | "panel";
    via: "strip" | "step";
  };
  agent_opened: { surface: "fab" };
  chat_renamed: {
    workspace_id: string;
    previous_source: "DEFAULT" | "QUESTION" | "AI" | "USER" | "UNKNOWN";
  };
  chat_deleted: { workspace_id: string };
  chat_diagram_expanded: Record<string, never>;
  chat_example_clicked: {
    workspace_id: string;
    kind:
      | "decisions"
      | "changes"
      | "open_tasks"
      | "summary"
      | "action_items"
      | "new_task"
      | "web";
    state: "first" | "workspace" | "note";
  };

  feedback_sent: { kind: "INCIDENT" | "QUESTION" | "SUGGESTION" | "OTHER" };
  feedback_dismissed: { from: "meeting_end"; forever: boolean };
  help_page_viewed: {
    slug: string;
    group: string;
    level: "hub" | "group" | "topic";
    axis: "feature" | "situation" | "hub";
    entry: "search" | "hub" | "internal" | "external" | "back";
    language: HelpLanguage;
  };
  help_search_opened: {
    surface: "palette" | "hub";
    via: "keyboard" | "click";
    language: HelpLanguage;
  };
  help_search_submitted: {
    query_length: number;
    result_count: number;
    zero_results: boolean;
    language: HelpLanguage;
  };
  help_result_clicked: {
    slug: string;
    rank: number;
    query_length: number;
    language: HelpLanguage;
  };
  help_nav_clicked: {
    from_slug: string;
    to_slug: string;
    surface: "sidebar" | "toc" | "related" | "prev_next" | "hub_card";
    language: HelpLanguage;
  };
  help_clip_played: { clip: string; slug: string; language: HelpLanguage };
  help_clip_zoomed: { clip: string; slug: string; language: HelpLanguage };
  help_image_zoomed: { name: string; slug: string; language: HelpLanguage };
  help_cta_clicked: {
    target: "dashboard";
    surface: "topbar";
    language: HelpLanguage;
  };
  help_code_copied: { slug: string; language: HelpLanguage };
  help_faq_opened: { slug: string; index: number; language: HelpLanguage };
  pricing_cta_clicked: {
    plan: "free" | "pro";
    auth: "anonymous" | "member";
  };
};

type Properties = Record<string, string | number | boolean | null | undefined>;

// server application.yml 의 app.metrics.test-workspace-ids 기본값과 맞춥니다.
const TEST_WORKSPACES = new Set(["0R1Q3TMN6P4QY", "0RSQB39CHT4ZV"]);
const isTestWorkspace = (properties?: Properties) =>
  TEST_WORKSPACES.has(String(properties?.workspace_id ?? ""));

type MutationVariables = Record<string, unknown>;

type MutationEvent =
  | AnalyticsEvent
  | ((
      variables: MutationVariables
    ) => readonly [AnalyticsEvent, Properties?] | null);

const bodyOf = (variables: MutationVariables) =>
  (typeof variables.data === "object" && variables.data !== null
    ? variables.data
    : {}) as Record<string, unknown>;

const assignsSomeone = (variables: MutationVariables) => {
  const body = bodyOf(variables);
  return Boolean(body.participantId || body.guestId || body.userId);
};

export type ChatMutationContext = {
  workspaceId: string;
  previousTitleSource?: WebEventProperties["chat_renamed"]["previous_source"];
};

const TITLE_SOURCES = new Set(["DEFAULT", "QUESTION", "AI", "USER"]);

const MUTATION_EVENTS: Record<string, MutationEvent> = {
  createFeedback: (v) => {
    const kind = bodyOf(v).kind;
    if (
      kind !== "INCIDENT" &&
      kind !== "QUESTION" &&
      kind !== "SUGGESTION" &&
      kind !== "OTHER"
    )
      return null;
    return ["feedback_sent", { kind }];
  },
  createWorkspace: "workspace_created",
  createProject: "project_created",
  createNote: "meeting_created",
  deleteNote: "note_deleted",
  endMeeting: "meeting_ended",
  approveMeetingReview: "summary_confirmed",
  createWorkspaceInvitation: "invite_sent",
  acceptInvitationByToken: "invite_accepted",
  acceptWorkspaceInvitation: "invite_accepted",
  createProjectTask: "task_created",
  sendAgentChatMessage: "chat_message_sent",
  renameAgentChat: (v) => [
    "chat_renamed",
    {
      previous_source: TITLE_SOURCES.has(String(v.previousTitleSource))
        ? String(v.previousTitleSource)
        : "UNKNOWN",
    },
  ],
  deleteAgentChat: "chat_deleted",
  approveAgentOAuthConsent: "agent_connected",
  createAgentDelegation: "agent_connected",
  assignNoteSpeaker: (v) => (assignsSomeone(v) ? ["speaker_assigned"] : null),
  assignSegmentSpeaker: (v) =>
    assignsSomeone(v) ? ["speaker_assigned"] : null,
  createMeetingReviewItem: () => ["review_item_edited", { action: "created" }],
  updateMeetingReviewItem: () => ["review_item_edited", { action: "updated" }],
  resolveToolApproval: (v) => [
    "tool_call_resolved",
    { decision: String(bodyOf(v).decision) },
  ],
  updateProjectTask: (v) =>
    bodyOf(v).taskStatus === "COMPLETED" ? ["task_completed"] : null,
  requestAnalysis: "analysis_requested",
  revokeAgentDelegation: "agent_disconnected",
  sendNoteShareMail: (v) => {
    const body = bodyOf(v);
    const include = Array.isArray(body.include) ? body.include : [];
    return [
      "minutes_emailed",
      {
        recipient_count: Array.isArray(body.recipients)
          ? body.recipients.length
          : 0,
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

const GA_EVENTS = new Set<AnalyticsEvent>([
  "login_started",
  "desktop_download_clicked",
]);

type Listener = (event: AnalyticsEvent, properties?: Properties) => void;
const listeners = new Set<Listener>();

export function onTrack(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** PostHog 를 켜기 전에 난 이벤트입니다. 초기화가 `SiteAnalytics` 의 effect 라 첫 화면의 effect 가 먼저 돌아 여기 먼저 옵니다. 켤 때 차례대로 보냅니다. */
const BEFORE_INIT_LIMIT = 20;
type CaptureOptions = Parameters<typeof posthog.capture>[2];
const beforeInit: Array<
  [AnalyticsEvent, Properties | undefined, CaptureOptions?]
> = [];
type GoogleEvent =
  | "sign_up"
  | "first_recording"
  | "login_started"
  | "desktop_download_clicked";
const beforeGoogleInit: Array<[GoogleEvent, Properties | undefined]> = [];
let googleInitialized = false;

export function initGoogleAnalytics(measurementId: string) {
  if (googleInitialized) return;
  googleInitialized = true;
  const target = window as typeof window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  target.dataLayer ??= [];
  // Google 태그는 arguments 객체를 명령으로 해석합니다.
  target.gtag ??= function () {
    // eslint-disable-next-line prefer-rest-params -- Google 태그 명령 형식을 유지합니다.
    target.dataLayer!.push(arguments);
  };
  target.gtag("js", new Date());
  target.gtag("config", measurementId);
  for (const [event, properties] of beforeGoogleInit.splice(0)) {
    sendGoogleEvent(event, properties);
  }
}

function sendGoogleEvent(event: GoogleEvent, properties?: Properties) {
  if (isAnalyticsOptedOut() || isTestWorkspace(properties)) return;
  const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
  if (gtag) gtag("event", event, properties);
  else if (beforeGoogleInit.length < BEFORE_INIT_LIMIT)
    beforeGoogleInit.push([event, properties]);
}

export function trackConversion(
  event: "sign_up" | "first_recording",
  properties?: Properties
) {
  if (isTestWorkspace(properties)) return;
  track(event, properties);
  sendGoogleEvent(
    event,
    event === "sign_up" ? { method: "google" } : undefined
  );
}

export function track<Event extends AnalyticsEvent>(
  event: Event,
  properties?: Event extends keyof WebEventProperties
    ? WebEventProperties[Event]
    : Properties,
  options?: CaptureOptions
) {
  for (const listener of listeners) listener(event, properties);
  if (isAnalyticsOptedOut() || isTestWorkspace(properties)) return;
  if (posthog.__loaded) {
    if (options) posthog.capture(event, properties, options);
    else posthog.capture(event, properties);
  } else if (beforeInit.length < BEFORE_INIT_LIMIT)
    beforeInit.push([event, properties, options]);
  if (GA_EVENTS.has(event)) {
    sendGoogleEvent(event as GoogleEvent, properties);
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
  const resolved =
    typeof entry === "function" ? entry(vars) : ([entry] as const);
  if (!resolved) return;
  const [event, extra] = resolved;
  const properties: Properties = {
    ...("workspaceId" in vars && { workspace_id: String(vars.workspaceId) }),
    ...extra,
  };
  track(event, Object.keys(properties).length > 0 ? properties : undefined);
}

const HANDOFF_MAX_AGE_S = 10 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function withAnalyticsHandoff(target: string) {
  if (!posthog.__loaded || isAnalyticsOptedOut() || posthog._isIdentified())
    return target;
  const url = new URL(target);
  url.searchParams.set("ph_did", posthog.get_distinct_id());
  const sessionId = posthog.get_session_id();
  if (sessionId) url.searchParams.set("ph_sid", sessionId);
  url.searchParams.set("ph_ts", String(Math.floor(Date.now() / 1000)));
  return url.href;
}

function hasStoredAnalyticsId(apiKey: string) {
  const name = `ph_${apiKey}_posthog`;
  try {
    if (localStorage.getItem(name)) return true;
  } catch {}
  return document.cookie.split("; ").some((c) => c.startsWith(`${name}=`));
}

function takeHandoffBootstrap(apiKey: string) {
  const url = new URL(window.location.href);
  const distinctID = url.searchParams.get("ph_did");
  const sessionID = url.searchParams.get("ph_sid");
  const issuedAt = Number(url.searchParams.get("ph_ts"));
  if (distinctID === null && sessionID === null) return undefined;
  for (const key of HANDOFF_ANALYTICS_PARAMS) url.searchParams.delete(key);
  window.history.replaceState(
    window.history.state,
    "",
    url.pathname + url.search + url.hash
  );
  // SDK 1.438은 익명 bootstrap이 이미 저장된 ID(식별된 사람 포함)를 덮어씁니다 — 이 브라우저의 기존 ID를 지킵니다.
  const fresh = Math.abs(Date.now() / 1000 - issuedAt) <= HANDOFF_MAX_AGE_S;
  if (
    !distinctID ||
    !UUID.test(distinctID) ||
    !fresh ||
    hasStoredAnalyticsId(apiKey)
  )
    return undefined;
  return sessionID && UUID.test(sessionID)
    ? { distinctID, sessionID }
    : { distinctID };
}

let pendingUserId: string | undefined;

export function initAnalytics(apiKey: string) {
  if (posthog.__loaded) return;
  const bootstrap = takeHandoffBootstrap(apiKey);
  // 거부한 브라우저에서는 켜지 않습니다 — 켜면 이벤트가 아니어도 SDK가 스스로 요청을 보냅니다.
  // SDK의 동의 저장(opt_out_capturing)은 쓰지 않습니다 — `reset()`이 그것을 지웁니다.
  if (isAnalyticsOptedOut()) return;
  posthog.init(apiKey, {
    ...(bootstrap && { bootstrap }),
    api_host: "https://t.heymoa.app",
    ui_host: "https://us.posthog.com",
    defaults: "2026-08-30",
    person_profiles: "identified_only",
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    disable_session_recording: true,
    session_recording: SESSION_REPLAY_CONFIG,
    enable_recording_console_log: false,
    capture_performance: false,
    disable_surveys: true,
    advanced_disable_feature_flags: true,
    before_send: beforeSend,
  });
  posthog.register({ client: desktopAuthBridge() ? "desktop" : "web" });
  window.addEventListener("storage", (event) => {
    if (event.key === OPT_OUT_KEY || event.key === null) syncSessionReplay();
  });
  if (pendingUserId) {
    identifyUser(pendingUserId);
    pendingUserId = undefined;
  }
  for (const [event, properties, options] of beforeInit.splice(0)) {
    if (options) posthog.capture(event, properties, options);
    else posthog.capture(event, properties);
  }
}

const OPT_OUT_KEY = "heymoa:analytics-opt-out";

let unsavedOptOut: boolean | undefined;

export function isAnalyticsOptedOut() {
  if (unsavedOptOut !== undefined) return unsavedOptOut;
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAnalyticsOptOut(optOut: boolean) {
  if (optOut) {
    beforeInit.length = 0;
    beforeGoogleInit.length = 0;
    pendingUserId = undefined;
  }
  try {
    if (optOut) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
    unsavedOptOut = undefined;
  } catch {
    unsavedOptOut = optOut;
  }
  syncSessionReplay();
}

let replayPrivacyAgreed = false;

export function setSessionReplayConsent(
  consents: readonly {
    documentType: string;
    currentVersion: string;
    agreed: boolean;
  }[]
) {
  replayPrivacyAgreed = consents.some(
    (consent) =>
      consent.documentType === "PRIVACY" &&
      consent.currentVersion === SESSION_REPLAY_EFFECTIVE &&
      consent.agreed
  );
  syncSessionReplay();
}

export function syncSessionReplay() {
  if (!posthog.__loaded) return;
  const excluded =
    isAnalyticsOptedOut() ||
    !replayPrivacyAgreed ||
    desktopAuthBridge() ||
    TEST_WORKSPACES.has(window.location.pathname.split("/")[2]) ||
    /^\/(auth|oauth|invite)(\/|$)/.test(window.location.pathname) ||
    Date.now() < Date.parse(`${SESSION_REPLAY_EFFECTIVE}T00:00:00+09:00`);
  if (excluded) posthog.stopSessionRecording();
  else posthog.startSessionRecording();
}

export function identifyUser(userId: string) {
  if (isAnalyticsOptedOut()) return;
  if (!posthog.__loaded) {
    pendingUserId = userId;
    return;
  }
  if (posthog.__loaded && posthog.get_distinct_id() !== userId) {
    posthog.identify(userId);
  }
}

export function resetAnalytics() {
  pendingUserId = undefined;
  setSessionReplayConsent([]);
  if (posthog.__loaded) posthog.reset();
}

/** 자동 이벤트(`$pageview`·`$pageleave`)는 `track()`을 거치지 않아 거부를 여기서 막습니다. */
export function beforeSend(event: CaptureResult | null) {
  return isAnalyticsOptedOut() || isTestWorkspace(event?.properties)
    ? null
    : stripUrlQueries(event);
}

function withoutQuery(value: unknown) {
  return typeof value === "string" && /^https?:\/\//.test(value)
    ? value.split(/[?#]/)[0]
    : value;
}

/** 쿼리·해시를 지웁니다. SDK 주소 속성은 `$session_entry_url`처럼 이름을 조합해 만들어서 이름이 아니라 값으로 고릅니다. */
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
