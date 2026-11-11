import { localize } from "./i18n";
import { getLanguage } from "../src/i18n";
import { formatElapsed, t } from "../src/i18n";
import type {
  ActiveMeeting,
  MeetingTimelineItem,
  MeetingTimelineSnapshot,
} from "@heymoa/desktop-contracts";
import type {
  MeetingPopoverView,
  MeetingPopoverAction,
} from "../src/meeting-timeline";
import {
  inFilter,
  TIMELINE_FILTERS,
  type TimelineFilter,
} from "../../../lib/notes/proposals/timeline";
import {
  distanceFromBottom,
  nextFollowing,
  watchUpwardInput,
} from "../../../lib/notes/follow-scroll";

type MeetingBridge = {
  read(): Promise<MeetingPopoverView>;
  action(action: MeetingPopoverAction): Promise<void>;
  subscribe(listener: (view: MeetingPopoverView) => void): () => void;
};
const bridge = (window as unknown as { heymoaMeeting: MeetingBridge })
  .heymoaMeeting;
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const scroll = element("scroll"),
  items = element("items"),
  latest = element<HTMLButtonElement>("latest");
const stop = element<HTMLButtonElement>("stop");
const liveText = element("live-transcript").querySelector("p")!;
element("live-transcript")
  .querySelector("p")!
  .replaceChildren(element("confirmed"), element("pending"));
let timeline: MeetingTimelineSnapshot | null = null;
let recording = false;
let emptyMessage = t("녹음 중인 회의가 없습니다.");
let following = true;
let previousTop = 0;
let previousHeight = scroll.scrollHeight;
let viewing = false;
let mode: "summary" | "timeline" = "timeline";
let modeChosen = false;
let localError: string | null = null;
let stopFocusPending = false;
let lastView: MeetingPopoverView | null = null;
let summarySignature = "";
const scrollPositions = { summary: 0, timeline: 0 };
let filter: TimelineFilter = "ALL";
let renderedSignature = "";
const filterLabels: Record<TimelineFilter, string> = {
  ALL: "전체",
  DECISION: "결정",
  ACTION_ITEM: "할 일",
  OPEN: "열린 질문",
  REFERENCE: "참고",
};
const filterButtons = TIMELINE_FILTERS.map((value) => {
  const button = document.createElement("button");
  button.type = "button";
  button.addEventListener("click", () => {
    modeChosen = true;
    filter = value;
    renderedSignature = "";
    following = false;
    renderItems();
    scroll.scrollTop = 0;
    previousTop = 0;
    previousHeight = scroll.scrollHeight;
  });
  element("filters").append(button);
  return { value, button };
});
function setText(node: HTMLElement, value: string) {
  if (node.textContent !== value) node.textContent = value;
}
const offset = (ms: number | null) => {
  if (ms === null) return "—";
  const seconds = Math.floor(ms / 1000);
  return formatElapsed(seconds);
};

function createRow(item: MeetingTimelineItem) {
  const node = document.createElement("article");
  const at = document.createElement("time");
  at.className = "offset";
  const body = document.createElement("div");
  const label = document.createElement("div");
  label.className = "label";
  const summary = document.createElement("button");
  summary.className = "summary";
  summary.type = "button";
  summary.setAttribute("aria-expanded", "false");
  const content = document.createElement("span");
  content.className = "content";
  const chevron = document.createElement("span");
  chevron.className = "chevron";
  chevron.textContent = "⌄";
  chevron.setAttribute("aria-hidden", "true");
  summary.append(content, chevron);
  const detail = document.createElement("div");
  detail.className = "detail";
  detail.inert = true;
  detail.id = `evidence-${item.id}`;
  summary.setAttribute("aria-controls", detail.id);
  detail.setAttribute("aria-hidden", "true");
  const clip = document.createElement("div");
  clip.className = "clip";
  const quote = document.createElement("div");
  quote.className = "quote";
  const text = document.createElement("div");
  text.className = "quote-text";
  quote.append(text);
  clip.append(quote);
  detail.append(clip);
  body.append(summary, label, detail);
  node.append(at, body);
  summary.addEventListener("click", () => {
    const open = summary.getAttribute("aria-expanded") !== "true";
    summary.setAttribute("aria-expanded", String(open));
    detail.classList.toggle("open", open);
    text.classList.toggle("revealed", open);
    detail.inert = !open;
    detail.setAttribute("aria-hidden", String(!open));
  });
  function update(value: MeetingTimelineItem) {
    node.dataset.tone = value.tone;
    setText(at, offset(value.atMs));
    setText(label, value.label);
    setText(content, value.content);
    chevron.hidden = value.citations.length === 0;
    summary.disabled = value.citations.length === 0;
    if (JSON.stringify(value.citations) !== text.dataset.signature) {
      text.dataset.signature = JSON.stringify(value.citations);
      text.replaceChildren(
        ...value.citations.map((citation) => {
          const line = document.createElement("div");
          line.className = "citation";
          const at = document.createElement("time");
          at.textContent = offset(citation.atMs);
          const words = document.createElement("span");
          words.textContent = citation.text;
          line.append(at, words);
          return line;
        })
      );
    }
  }
  update(item);
  return { node, item, update };
}
const rowViews = new Map<string, ReturnType<typeof createRow>>();
function syncLatest() {
  latest.hidden = !timeline || following || distanceFromBottom(scroll) <= 2;
}
const groupViews = new Map<
  string,
  {
    node: HTMLElement;
    heading: HTMLButtonElement;
    rows: HTMLElement;
    range: HTMLElement;
    title: HTMLElement;
    count: HTMLElement;
  }
>();
function renderItems() {
  scroll.setAttribute(
    "aria-label",
    t(
      !timeline
        ? "회의 목록"
        : mode === "summary"
          ? "회의 요약"
          : "회의 타임라인"
    )
  );
  const signature =
    getLanguage() + JSON.stringify(timeline) + filter + emptyMessage;
  if (signature === renderedSignature) return;
  renderedSignature = signature;
  const all = timeline?.items ?? [];
  const displayed = all.filter((item) => inFilter(item.tone, filter));
  element("view-tabs").hidden = !timeline || Boolean(lastView?.noteFailed);
  element("filters").hidden =
    !timeline || mode !== "timeline" || Boolean(lastView?.noteFailed);
  items.hidden = mode !== "timeline";
  element("summary-view").hidden = !timeline || mode !== "summary";
  element("summary-tab").setAttribute(
    "aria-pressed",
    String(mode === "summary")
  );
  element("timeline-tab").setAttribute(
    "aria-pressed",
    String(mode === "timeline")
  );
  renderSummary();
  for (const { value, button } of filterButtons) {
    const count =
      timeline?.detail?.counts[value] ??
      all.filter((item) => inFilter(item.tone, value)).length;
    setText(
      button,
      `${t(filterLabels[value])}${timeline?.loading || timeline?.failed ? "" : ` ${count}`}`
    );
    button.setAttribute("aria-pressed", String(value === filter));
  }
  const present = new Set(displayed.map((item) => item.id));
  for (const [id, row] of rowViews) {
    if (!present.has(id)) {
      row.node.remove();
      rowViews.delete(id);
    }
  }
  const groups = timeline?.detail?.groups ?? [
    {
      id: "ungrouped",
      title: "",
      startMs: null,
      endMs: null,
      itemIds: all.map((item) => item.id),
    },
  ];
  const byId = new Map(displayed.map((item) => [item.id, item]));
  const presentGroups = new Set(groups.map((group) => group.id));
  for (const [id, group] of groupViews) {
    if (!presentGroups.has(id)) {
      group.node.remove();
      groupViews.delete(id);
    }
  }
  let groupCursor = items.firstElementChild;
  for (const group of groups) {
    let g = groupViews.get(group.id);
    if (!g) {
      const node = document.createElement("section"),
        heading = document.createElement("button"),
        rows = document.createElement("div");
      const titleRow = document.createElement("h2"),
        range = document.createElement("span"),
        title = document.createElement("span"),
        count = document.createElement("span");
      titleRow.className = "group-title";
      range.className = "group-range";
      title.className = "group-name";
      count.className = "group-count";
      node.className = "group";
      heading.className = "group-heading";
      heading.type = "button";
      heading.setAttribute("aria-expanded", "true");
      rows.id = `group-${group.id}`;
      heading.setAttribute("aria-controls", rows.id);
      heading.append(range, title, count);
      titleRow.append(heading);
      heading.addEventListener("click", () => {
        rows.hidden = !rows.hidden;
        heading.setAttribute("aria-expanded", String(!rows.hidden));
        following = false;
      });
      node.append(titleRow, rows);
      g = { node, heading, rows, range, title, count };
      groupViews.set(group.id, g);
    }
    const grouped = group.itemIds.flatMap((id) =>
      byId.has(id) ? [byId.get(id)!] : []
    );
    g.node.hidden = !grouped.length;
    g.heading.hidden = !group.title;
    setText(
      g.range,
      `${offset(group.startMs)}${group.endMs !== null && group.endMs !== group.startMs ? ` – ${offset(group.endMs)}` : ""}`
    );
    setText(g.title, group.title);
    g.range.title = g.range.textContent ?? "";
    g.title.title = group.title;
    setText(g.count, String(grouped.length));
    if (g.node !== groupCursor) items.insertBefore(g.node, groupCursor);
    groupCursor = g.node.nextElementSibling;
    let cursor = g.rows.firstElementChild;
    for (const item of grouped) {
      let row = rowViews.get(item.id);
      if (!row) {
        row = createRow(item);
        rowViews.set(item.id, row);
      } else if (JSON.stringify(row.item) !== JSON.stringify(item)) {
        row.update(item);
        row.item = item;
      }
      if (row.node !== cursor) g.rows.insertBefore(row.node, cursor);
      cursor = row.node.nextElementSibling;
    }
  }
  const partial = timeline?.detail?.partial;
  const partialAtBottom = distanceFromBottom(liveText) <= 2;
  const live = Boolean(
    timeline?.detail &&
    !timeline.detail.ended &&
    (partial ||
      (recording && timeline.detail.ownsRecording !== false) ||
      ["IN_PROGRESS", "PAUSED"].includes(timeline.detail.meetingState ?? "")) &&
    mode === "timeline"
  );
  element("live-transcript").hidden = !live;
  setText(element("confirmed"), partial?.confirmedText ?? "");
  setText(
    element("pending"),
    partial?.pendingText ??
      t(
        timeline?.detail?.meetingState === "PAUSED"
          ? "녹음이 일시정지되었습니다."
          : "다음 발화를 기다리고 있습니다."
      )
  );
  if (partialAtBottom) liveText.scrollTop = liveText.scrollHeight;
  element("empty").hidden =
    displayed.length > 0 ||
    Boolean(timeline && mode === "summary" && !lastView?.noteFailed);
  if (lastView?.noteFailed) {
    items.hidden = true;
    element("summary-view").hidden = true;
    element("live-transcript").hidden = true;
  }
  element("empty").textContent = !timeline
    ? emptyMessage
    : lastView?.noteFailed
      ? t(
          "이 회의록을 열 수 없습니다. 삭제되었거나 접근 권한이 변경되었을 수 있습니다."
        )
      : timeline.loading
        ? t("회의 내용을 불러오는 중입니다.")
        : timeline.failed
          ? t(
              "회의 내용을 확인하지 못했습니다. 현재 회의를 열어 확인해 주세요."
            )
          : filter !== "ALL"
            ? t("아직 이 유형의 항목이 없습니다.")
            : t("요약이 정리되면 여기에 표시됩니다.");
  followBottom();
  syncLatest();
}
function renderSummary() {
  const summary = timeline?.detail?.summary;
  const signature =
    getLanguage() + JSON.stringify(summary) + timeline?.detail?.ended;
  if (signature === summarySignature) return;
  summarySignature = signature;
  const root = element("summary-view");
  root.replaceChildren();
  const paragraph = (text: string, className = "") => {
    const p = document.createElement("p");
    p.className = className;
    p.textContent = text;
    return p;
  };
  if (!summary || summary.status !== "ready") {
    const message =
      summary?.status === "failed"
        ? "요약을 불러오지 못했습니다. HeyMoa를 열어 확인해 주세요."
        : summary?.status === "loading"
          ? "요약을 불러오는 중입니다."
          : summary?.status === "pending"
            ? "회의 요약을 정리하고 있습니다."
            : timeline?.detail?.ended
              ? "이 회의의 요약이 아직 준비되지 않았습니다."
              : "회의가 종료되면 요약을 확인할 수 있습니다.";
    root.append(paragraph(t(message), "summary-state"));
    return;
  }
  if (summary.lead) root.append(paragraph(summary.lead, "summary-lead"));
  for (const section of summary.sections) {
    const node = document.createElement("section"),
      heading = document.createElement("h2");
    heading.textContent = section.title;
    node.append(heading);
    if (section.description) node.append(paragraph(section.description));
    for (const [label, lines] of [
      ["결론", section.conclusions],
      ["남은 일", section.openItems],
    ] as const) {
      if (!lines.length) continue;
      const h = document.createElement("h3"),
        list = document.createElement("ul");
      h.textContent = t(label);
      for (const line of lines) {
        const li = document.createElement("li");
        li.textContent = line;
        list.append(li);
      }
      node.append(h, list);
    }
    root.append(node);
  }
  if (!root.childElementCount)
    root.append(
      paragraph(
        t("이 회의의 요약이 아직 준비되지 않았습니다."),
        "summary-state"
      )
    );
}
function followBottom() {
  if (!following || !timeline || mode !== "timeline") return;
  scroll.scrollTop = scroll.scrollHeight;
  previousTop = scroll.scrollTop;
  previousHeight = scroll.scrollHeight;
}
const startTime = (ms: number) =>
  new Date(ms).toLocaleString(getLanguage() === "en" ? "en-US" : "ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
/** 최근 회의 목록은 녹음 상태와 독립적으로 탐색한다. */
let meetingsSignature = "";
const meetingButtons = new Map<string, HTMLButtonElement>();
function renderMeetings(list: ActiveMeeting[], show: boolean) {
  const container = element("meetings");
  container.hidden = !show || !list.length;
  if (!show) {
    meetingsSignature = "";
    return;
  }
  if (list.length) element("empty").hidden = true;
  latest.hidden = true;
  const signature = getLanguage() + JSON.stringify(list);
  if (signature === meetingsSignature) return;
  meetingsSignature = signature;
  const ids = new Set(list.map((meeting) => meeting.noteId));
  for (const [id, button] of meetingButtons)
    if (!ids.has(id)) {
      button.remove();
      meetingButtons.delete(id);
    }
  let cursor = container.firstElementChild;
  for (const meeting of list) {
    let button = meetingButtons.get(meeting.noteId);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "meeting";
      button.dataset.noteId = meeting.noteId;
      for (const name of ["title", "state", "time"]) {
        const span = document.createElement("span");
        span.className = `meeting-${name}`;
        button.append(span);
      }
      button.addEventListener("click", () =>
        act({ action: "open-note", noteId: meeting.noteId })
      );
      meetingButtons.set(meeting.noteId, button);
    }
    const title = meeting.title || t("제목 없는 회의");
    const state = t(
      meeting.state === "NOT_STARTED"
        ? "시작 전"
        : meeting.state === "PAUSED"
          ? "일시정지"
          : meeting.ended
            ? "종료됨"
            : "진행 중"
    );
    const date = meeting.startedAt === null ? "" : startTime(meeting.startedAt);
    setText(button.children[0] as HTMLElement, title);
    setText(button.children[1] as HTMLElement, state);
    setText(button.children[2] as HTMLElement, date);
    (button.children[2] as HTMLElement).hidden = !date;
    button.setAttribute(
      "aria-label",
      [title, state, date].filter(Boolean).join(", ")
    );
    if (button !== cursor) container.insertBefore(button, cursor);
    cursor = button.nextElementSibling;
  }
}
function receive(view: MeetingPopoverView) {
  const focused = document.activeElement as HTMLElement | null;
  const listFocus = Boolean(focused?.closest("#meetings"));
  const previousNote = timeline?.noteId;
  lastView = view;
  localize(view.language ?? "ko");
  const pinned = view.panel?.pinned ?? false;
  element("pin").setAttribute("aria-pressed", String(pinned));
  document.body.dataset.recording = String(view.canStop);
  document.body.dataset.empty = String(
    !view.timeline && !view.canStop && !view.meetings.length
  );
  if (timeline?.noteId !== view.timeline?.noteId) {
    liveText.scrollTop = liveText.scrollHeight;
    scrollPositions.summary = scrollPositions.timeline = 0;
    scroll.scrollTop = previousTop = 0;
    following = true;
    filter = "ALL";
    renderedSignature = "";
    summarySignature = "";
    mode = view.timeline?.detail?.ended ? "summary" : "timeline";
    modeChosen = false;
    if (mode === "summary") following = false;
    rowViews.clear();
    groupViews.clear();
    items.replaceChildren();
  }
  timeline = view.timeline;
  if (!modeChosen && timeline?.detail?.ended && mode !== "summary") {
    mode = "summary";
    following = false;
    renderedSignature = "";
    scroll.scrollTop = previousTop = scrollPositions.summary = 0;
  }
  recording = view.canStop;
  viewing = Boolean(view.viewing);
  emptyMessage = view.noteFailed
    ? t("회의 내용을 확인하지 못했습니다. 현재 회의를 열어 확인해 주세요.")
    : !timeline && view.meetingsStatus
      ? t(
          view.meetingsStatus === "loading"
            ? "회의 목록을 불러오는 중입니다."
            : view.meetingsStatus === "failed"
              ? "회의 목록을 불러오지 못했습니다. HeyMoa를 열어 확인해 주세요."
              : view.meetingsStatus === "no-workspace"
                ? "HeyMoa에서 워크스페이스를 선택해 주세요."
                : "아직 회의록이 없습니다."
        )
      : view.unknown
        ? t(
            "녹음 상태를 확인하지 못했습니다. HeyMoa를 열어 상태를 확인해 주세요."
          )
        : recording
          ? t(
              "회의 타임라인을 기다리고 있습니다. 현재 회의를 열어 확인해 주세요."
            )
          : view.phase === "requesting-permission" ||
              view.phase === "connecting"
            ? t(
                "녹음 시작을 기다리고 있습니다. 현재 회의에서 상태를 확인해 주세요."
              )
            : view.phase === "stopping"
              ? t("녹음 일시정지와 전송 완료를 기다리고 있습니다.")
              : view.meetingsStatus === "loading"
                ? t("회의 목록을 불러오는 중입니다.")
                : view.meetingsStatus === "failed"
                  ? t(
                      "회의 목록을 불러오지 못했습니다. HeyMoa를 열어 확인해 주세요."
                    )
                  : t("아직 회의록이 없습니다.");
  setText(
    element("open"),
    timeline ? t("HeyMoa에서 열기 ↗") : t("HeyMoa 열기 ↗")
  );
  setText(element("title"), timeline?.title || t("최근 회의록"));
  element("title").title = element("title").textContent ?? "";
  setText(
    element("phase"),
    !recording && ["idle", "completed"].includes(view.phase ?? "")
      ? t("회의록")
      : view.label
  );
  setText(element("elapsed"), view.elapsed || "");
  element("recording-note").hidden =
    !view.recordingTarget ||
    view.selection?.noteId === view.recordingTarget.noteId;
  element("back").hidden = !timeline;
  setText(
    element("notice"),
    (localError ? t(localError) : null) ||
      view.warning ||
      (!timeline && view.meetingsStatus === "failed" && view.meetings.length
        ? t("회의 목록을 갱신하지 못했습니다. 다시 확인하고 있습니다.")
        : null) ||
      (view.stale
        ? t("갱신이 멈췄습니다. 현재 회의를 열어 확인해 주세요.")
        : timeline?.reconnecting
          ? t("연결을 다시 확인하고 있습니다.")
          : timeline?.failed
            ? t("회의 내용을 갱신하지 못했습니다.")
            : "")
  );
  element("notice").title = element("notice").textContent ?? "";
  const label = t(" 녹음 일시정지");
  if (stop.lastElementChild?.textContent !== label)
    stop.lastElementChild!.textContent = label;
  (stop.firstElementChild as HTMLElement).hidden = false;
  const stoppedFocus =
    !view.canStop &&
    (focused === stop || (stopFocusPending && focused === document.body));
  if (!view.canStop) stopFocusPending = false;
  stop.disabled = !view.canStop;
  stop.hidden = stop.disabled;
  renderItems();
  const listing = !timeline;
  renderMeetings(view.meetings, listing);
  followBottom();
  syncLatest();
  if (timeline && (listFocus || focused?.id === "recording-note"))
    element("title").focus();
  else if (listing && (focused?.id === "back" || stoppedFocus)) {
    const buttons = Array.from(
      element("meetings").querySelectorAll<HTMLButtonElement>("button")
    );
    (
      buttons.find((button) => button.dataset.noteId === previousNote) ??
      buttons[0] ??
      element("open")
    ).focus();
  } else if (stoppedFocus) element("back").focus();
}
scroll.addEventListener("scroll", () => {
  const top = scroll.scrollTop;
  // Unchanged scroll events after a render must not undo an upward gesture.
  if (top !== previousTop) {
    following = nextFollowing({
      following,
      top,
      previousTop,
      distance: distanceFromBottom(scroll),
      contentGrew: scroll.scrollHeight > previousHeight,
    });
  }
  previousTop = top;
  previousHeight = scroll.scrollHeight;
  syncLatest();
});
const stopWatching = watchUpwardInput(scroll, () => {
  modeChosen = true;
  following = false;
  syncLatest();
});
const resizeObserver =
  typeof ResizeObserver === "undefined"
    ? null
    : new ResizeObserver(followBottom);
resizeObserver?.observe(items);
resizeObserver?.observe(element("live-transcript"));
resizeObserver?.observe(scroll);
latest.addEventListener("click", () => {
  following = true;
  followBottom();
  latest.hidden = true;
});
function act(value: MeetingPopoverAction) {
  localError = null;
  if (lastView) receive(lastView);
  if (value === "stop" || value === "stop-viewing") {
    stopFocusPending = document.activeElement === stop;
    stop.disabled = true;
  }
  void bridge.action(value).catch(() => {
    stopFocusPending = false;
    localError =
      typeof value === "object" && value.action === "set-panel"
        ? "표시 설정을 저장하지 못했습니다. 다시 시도해 주세요."
        : "처리하지 못했습니다. 현재 회의에서 확인해 주세요.";
    if (lastView) receive(lastView);
  });
}
stop.addEventListener("click", () => act("stop"));
element("open").addEventListener("click", () =>
  act(
    timeline
      ? {
          action: "open-selection",
          tab: mode === "summary" ? "summary" : "context",
        }
      : "show-app"
  )
);
element("recording-note").addEventListener("click", () =>
  act("show-recording")
);
element("settings").addEventListener("click", () => act("settings"));
element("back").addEventListener("click", () => act("list"));
for (const next of ["summary", "timeline"] as const)
  element(`${next}-tab`).addEventListener("click", () => {
    scrollPositions[mode] = scroll.scrollTop;
    mode = next;
    following = false;
    renderedSignature = "";
    modeChosen = true;
    renderItems();
    scroll.scrollTop = scrollPositions[mode];
    previousTop = scroll.scrollTop;
    previousHeight = scroll.scrollHeight;
    syncLatest();
  });
element("pin").addEventListener("click", () =>
  act({
    action: "set-panel",
    pinned: element("pin").getAttribute("aria-pressed") !== "true",
  })
);
element("close").addEventListener("click", () => act("hide"));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") act("hide");
});
let received = false;
const unsubscribe = bridge.subscribe((view) => {
  received = true;
  receive(view);
});
void bridge
  .read()
  .then((view) => {
    if (!received) receive(view);
  })
  .catch(() => {
    element("notice").textContent = t("현재 회의를 확인하지 못했습니다.");
  });
window.addEventListener(
  "unload",
  () => {
    unsubscribe();
    stopWatching();
    resizeObserver?.disconnect();
  },
  { once: true }
);
