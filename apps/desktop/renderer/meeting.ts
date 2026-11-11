import { localize } from "./i18n";
import { getLanguage } from "../src/i18n";
import { formatElapsed, t } from "../src/i18n";
import type {
  ActiveMeeting,
  MeetingTimelineItem,
  MeetingTimelineSnapshot,
} from "@heymoa/desktop-contracts";
import type { MeetingPopoverView } from "../src/meeting-timeline";
import {
  distanceFromBottom,
  nextFollowing,
  watchUpwardInput,
} from "../../../lib/notes/follow-scroll";

type MeetingBridge = {
  read(): Promise<MeetingPopoverView>;
  action(
    action:
      | "stop"
      | "stop-viewing"
      | "show-current"
      | "hide"
      | "settings"
      | { action: "open-note"; noteId: string }
      | { action: "set-panel"; pinned: boolean }
  ): Promise<void>;
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
let timeline: MeetingTimelineSnapshot | null = null;
let recording = false;
let emptyMessage = t("녹음 중인 회의가 없습니다.");
let following = true;
let previousTop = 0;
let previousHeight = scroll.scrollHeight;
let viewing = false;
const offset = (ms: number | null) => {
  if (ms === null) return "—";
  const seconds = Math.floor(ms / 1000);
  return formatElapsed(seconds);
};

function createRow(item: MeetingTimelineItem) {
  const node = document.createElement("article");
  const body = document.createElement("div");
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
  body.append(summary, detail);
  node.append(body);
  summary.addEventListener("click", () => {
    const open = summary.getAttribute("aria-expanded") !== "true";
    summary.setAttribute("aria-expanded", String(open));
    detail.classList.toggle("open", open);
    text.classList.toggle("revealed", open);
    detail.inert = !open;
    detail.setAttribute("aria-hidden", String(!open));
  });
  function update(value: MeetingTimelineItem) {
    content.textContent = value.content;
    chevron.hidden = value.citations.length === 0;
    summary.disabled = value.citations.length === 0;
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
  update(item);
  return { node, item, update };
}
const rowViews = new Map<string, ReturnType<typeof createRow>>();
function renderItems(animateNew = false) {
  const displayed = timeline?.items ?? [];
  const present = new Set(displayed.map((item) => item.id));
  for (const [id, row] of rowViews) {
    if (!present.has(id)) {
      row.node.remove();
      rowViews.delete(id);
    }
  }
  let cursor = items.firstElementChild;
  for (const item of displayed) {
    let row = rowViews.get(item.id);
    if (!row) {
      row = createRow(item);
      if (animateNew) row.node.classList.add("arriving");
      rowViews.set(item.id, row);
    } else if (JSON.stringify(row.item) !== JSON.stringify(item)) {
      row.update(item);
      row.item = item;
    }
    if (row.node !== cursor) items.insertBefore(row.node, cursor);
    cursor = row.node.nextElementSibling;
  }
  element("empty").hidden = displayed.length > 0;
  element("empty").textContent = !timeline
    ? emptyMessage
    : timeline.loading
      ? t("회의 내용을 불러오는 중입니다.")
      : timeline.failed
        ? t("회의 내용을 확인하지 못했습니다. 현재 회의를 열어 확인해 주세요.")
        : t("요약이 정리되면 여기에 표시됩니다.");
  followBottom();
  latest.hidden = following || displayed.length === 0;
}
function followBottom() {
  if (!following) return;
  scroll.scrollTop = scroll.scrollHeight;
  previousTop = scroll.scrollTop;
  previousHeight = scroll.scrollHeight;
}
const startTime = (ms: number) =>
  new Date(ms).toLocaleTimeString(getLanguage() === "en" ? "en-US" : "ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
/** 타임라인이 없고 녹음 중도 아닐 때, 지금 진행 중인 회의를 골라 연다. */
let meetingsSignature = "";
function renderMeetings(list: ActiveMeeting[], show: boolean) {
  const container = element("meetings");
  container.hidden = !show;
  if (!show) {
    meetingsSignature = "";
    return;
  }
  element("empty").hidden = true;
  latest.hidden = true;
  // 트레이가 매초 같은 값을 보낸다. 같으면 버튼을 다시 만들지 않아 키보드 초점이 남는다.
  const signature = getLanguage() + JSON.stringify(list);
  if (signature === meetingsSignature) return;
  meetingsSignature = signature;
  container.replaceChildren(
    ...list.map((meeting) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "meeting";
      const title = document.createElement("span");
      title.className = "meeting-title";
      title.textContent = meeting.title || t("제목 없는 회의");
      button.append(title);
      if (meeting.startedAt !== null) {
        const time = document.createElement("span");
        time.className = "meeting-time";
        time.textContent =
          getLanguage() === "en"
            ? `Started ${startTime(meeting.startedAt)}`
            : `${startTime(meeting.startedAt)} 시작`;
        button.append(time);
      }
      button.addEventListener("click", () =>
        act({ action: "open-note", noteId: meeting.noteId })
      );
      return button;
    })
  );
}
function receive(view: MeetingPopoverView) {
  localize(view.language ?? "ko");
  const pinned = view.panel?.pinned ?? false;
  element("pin").setAttribute("aria-pressed", String(pinned));
  document.body.dataset.recording = String(view.canStop);
  document.body.dataset.empty = String(
    !view.timeline && !view.canStop && !view.meetings.length
  );
  const animateNew =
    timeline?.noteId === view.timeline?.noteId &&
    Boolean(timeline?.items.length);
  if (timeline?.noteId !== view.timeline?.noteId) {
    following = true;
    rowViews.clear();
    items.replaceChildren();
  }
  timeline = view.timeline;
  recording = view.canStop;
  viewing = Boolean(view.viewing);
  emptyMessage = view.unknown
    ? t("녹음 상태를 확인하지 못했습니다. HeyMoa를 열어 상태를 확인해 주세요.")
    : recording
      ? t("회의 타임라인을 기다리고 있습니다. 현재 회의를 열어 확인해 주세요.")
      : view.phase === "requesting-permission" || view.phase === "connecting"
        ? t(
            "녹음 시작을 기다리고 있습니다. 현재 회의에서 상태를 확인해 주세요."
          )
        : view.phase === "stopping"
          ? t("녹음 일시정지와 전송 완료를 기다리고 있습니다.")
          : view.warning || t("녹음 중인 회의가 없습니다.");
  element("open").textContent =
    view.phase !== null && view.phase !== "idle"
      ? t("현재 회의 열기 ↗")
      : t("HeyMoa 열기 ↗");
  element("title").textContent =
    timeline?.title || (recording ? t("진행 중인 회의") : view.label);
  element("phase").textContent = view.label;
  element("elapsed").textContent = view.elapsed || "";
  element("notice").textContent =
    view.warning ||
    (view.stale
      ? t("갱신이 멈췄습니다. 현재 회의를 열어 확인해 주세요.")
      : timeline?.reconnecting
        ? t("연결을 다시 확인하고 있습니다.")
        : timeline?.failed
          ? t("회의 내용을 갱신하지 못했습니다.")
          : "");
  // 뷰어로 보는 중에는 「녹음 일시정지」 대신 「보기 종료」로 목록에 돌아간다.
  const label = viewing ? t(" 보기 종료") : t(" 녹음 일시정지");
  if (stop.lastElementChild?.textContent !== label)
    stop.lastElementChild!.textContent = label;
  // ⏸ 는 녹음 일시정지에만 붙는다. 보기 종료는 회의를 멈추지 않는다.
  (stop.firstElementChild as HTMLElement).hidden = viewing;
  stop.disabled = !(view.canStop || viewing);
  stop.hidden = stop.disabled;
  renderItems(animateNew);
  const listing = !timeline && !recording && view.meetings.length > 0;
  if (listing) element("title").textContent = t("진행 중인 회의");
  renderMeetings(view.meetings, listing);
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
  latest.hidden = following || !timeline?.items.length;
});
const stopWatching = watchUpwardInput(scroll, () => {
  following = false;
  latest.hidden = !timeline?.items.length;
});
const resizeObserver =
  typeof ResizeObserver === "undefined"
    ? null
    : new ResizeObserver(followBottom);
resizeObserver?.observe(items);
resizeObserver?.observe(scroll);
latest.addEventListener("click", () => {
  following = true;
  followBottom();
  latest.hidden = true;
});
function act(
  value:
    | "stop"
    | "stop-viewing"
    | "show-current"
    | "hide"
      | "settings"
    | { action: "open-note"; noteId: string }
    | { action: "set-panel"; pinned: boolean }
) {
  if (value === "stop" || value === "stop-viewing") stop.disabled = true;
  void bridge.action(value).catch(() => {
    element("notice").textContent = t(
      typeof value === "object" && value.action === "set-panel"
        ? "표시 설정을 저장하지 못했습니다. 다시 시도해 주세요."
        : "처리하지 못했습니다. 현재 회의에서 확인해 주세요."
    );
  });
}
stop.addEventListener("click", () => act(viewing ? "stop-viewing" : "stop"));
element("open").addEventListener("click", () => act("show-current"));
element("settings").addEventListener("click", () => act("settings"));
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
