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
      | { action: "open-note"; noteId: string }
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
let filter = "ALL";
let recording = false;
let emptyMessage = "녹음 중인 회의가 없습니다.";
let following = true;
let previousTop = 0;
let previousHeight = scroll.scrollHeight;
let viewing = false;
const filters = [
  ["ALL", "전체"],
  ["decision", "결정"],
  ["task", "할 일"],
  ["open", "열린 질문"],
  ["reference", "참고"],
];
const filterButtons = filters.map(([key, label]) => {
  const button = document.createElement("button");
  button.textContent = label;
  button.type = "button";
  button.addEventListener("click", () => {
    filter = key;
    renderItems();
  });
  element("filters").append(button);
  return { key, button };
});
const offset = (ms: number | null) => {
  if (ms === null) return "—";
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

function createRow(item: MeetingTimelineItem) {
  const node = document.createElement("article");
  const time = document.createElement("time");
  time.className = "offset";
  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
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
  const label = document.createElement("span");
  summary.append(content, chevron, label);
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
  node.append(time, dot, body);
  const reveal = () => {
    if (summary.getAttribute("aria-expanded") !== "true") return;
    text.classList.add("revealed");
    detail.inert = false;
    detail.setAttribute("aria-hidden", "false");
  };
  let expansion = 0;
  summary.addEventListener("click", () => {
    const current = ++expansion;
    const open = summary.getAttribute("aria-expanded") !== "true";
    summary.setAttribute("aria-expanded", String(open));
    detail.classList.toggle("open", open);
    text.classList.remove("revealed");
    detail.inert = true;
    detail.setAttribute("aria-hidden", "true");
    if (!open) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      return;
    }
    window.requestAnimationFrame(() => {
      if (current !== expansion) return;
      // A same-frame close/open may have no CSS transition to finish.
      void Promise.allSettled(
        detail.getAnimations().map((animation) => animation.finished)
      ).then(() => {
        if (current === expansion) reveal();
      });
    });
  });
  let sizeAnimation: Animation | undefined;
  function update(value: MeetingTimelineItem) {
    const previousHeight = node.getBoundingClientRect().height;
    const changedContent = content.textContent !== value.content;
    const previousCitations = text.textContent;
    sizeAnimation?.cancel();
    time.textContent = offset(value.atMs);
    dot.className = `dot ${value.tone}`;
    content.textContent = value.content;
    label.className = `label ${value.tone}`;
    label.textContent = value.label;
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
    if (
      node.isConnected &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const height = node.getBoundingClientRect().height;
      if (Math.abs(previousHeight - height) > 1) {
        sizeAnimation = node.animate(
          [
            { height: `${previousHeight}px`, overflow: "clip" },
            { height: `${height}px`, overflow: "clip" },
          ],
          { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
      }
      if (changedContent) {
        content.animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: 180 });
      }
      if (
        text.classList.contains("revealed") &&
        previousCitations !== text.textContent
      ) {
        text.animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: 180 });
      }
    }
  }
  update(item);
  return { node, item, update };
}
const rowViews = new Map<string, ReturnType<typeof createRow>>();
function renderItems(animateNew = false) {
  const displayed = (timeline?.items ?? []).filter(
    (item) =>
      filter === "ALL" ||
      item.tone === filter ||
      (filter === "reference" && item.tone === "answered")
  );
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
  for (const { key, button } of filterButtons)
    button.setAttribute("aria-pressed", String(key === filter));
  element("empty").hidden = displayed.length > 0;
  element("empty").textContent = !timeline
    ? emptyMessage
    : timeline.loading
      ? "회의 내용을 불러오는 중입니다."
      : timeline.failed
        ? "회의 내용을 확인하지 못했습니다. 현재 회의를 열어 확인해 주세요."
        : "아직 이 유형의 항목이 없습니다.";
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
  new Date(ms).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
/** 타임라인이 없고 녹음 중도 아닐 때, 지금 진행 중인 회의를 골라 연다. */
let meetingsSignature = "";
function renderMeetings(list: ActiveMeeting[], show: boolean) {
  const container = element("meetings");
  container.hidden = !show;
  element("filters").hidden = show;
  if (!show) {
    meetingsSignature = "";
    return;
  }
  element("empty").hidden = true;
  latest.hidden = true;
  // 트레이가 매초 같은 값을 보낸다. 같으면 버튼을 다시 만들지 않아 키보드 초점이 남는다.
  const signature = JSON.stringify(list);
  if (signature === meetingsSignature) return;
  meetingsSignature = signature;
  container.replaceChildren(
    ...list.map((meeting) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "meeting";
      const title = document.createElement("span");
      title.className = "meeting-title";
      title.textContent = meeting.title || "제목 없는 회의";
      button.append(title);
      if (meeting.startedAt !== null) {
        const time = document.createElement("span");
        time.className = "meeting-time";
        time.textContent = `${startTime(meeting.startedAt)} 시작`;
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
  const animateNew =
    timeline?.noteId === view.timeline?.noteId &&
    Boolean(timeline?.items.length);
  if (timeline?.noteId !== view.timeline?.noteId) {
    filter = "ALL";
    following = true;
    rowViews.clear();
    items.replaceChildren();
  }
  timeline = view.timeline;
  recording = view.canStop;
  viewing = Boolean(view.viewing);
  emptyMessage = view.unknown
    ? "녹음 상태를 확인하지 못했습니다. HeyMoa를 열어 상태를 확인해 주세요."
    : recording
      ? "회의 타임라인을 기다리고 있습니다. 현재 회의를 열어 확인해 주세요."
      : view.phase === "requesting-permission" || view.phase === "connecting"
        ? "녹음 시작을 기다리고 있습니다. 현재 회의에서 상태를 확인해 주세요."
        : view.phase === "stopping"
          ? "녹음 일시정지와 전송 완료를 기다리고 있습니다."
          : view.warning || "녹음 중인 회의가 없습니다.";
  element("open").textContent =
    view.phase !== null && view.phase !== "idle"
      ? "현재 회의 열기 ↗"
      : "HeyMoa 열기 ↗";
  element("title").textContent =
    timeline?.title || (recording ? "진행 중인 회의" : view.label);
  element("phase").textContent = view.label;
  element("elapsed").textContent = view.elapsed || "";
  element("notice").textContent =
    view.warning ||
    (view.stale
      ? "갱신이 멈췄습니다. 현재 회의를 열어 확인해 주세요."
      : timeline?.reconnecting
        ? "연결을 다시 확인하고 있습니다."
        : timeline?.failed
          ? "회의 내용을 갱신하지 못했습니다."
          : "");
  // 뷰어로 보는 중에는 「녹음 일시정지」 대신 「보기 종료」로 목록에 돌아간다.
  const label = viewing ? " 보기 종료" : " 녹음 일시정지";
  if (stop.lastChild?.textContent !== label)
    stop.lastChild!.textContent = label;
  // ⏸ 는 녹음 일시정지에만 붙는다. 보기 종료는 회의를 멈추지 않는다.
  (stop.firstElementChild as HTMLElement).hidden = viewing;
  stop.disabled = !(view.canStop || viewing);
  renderItems(animateNew);
  const listing = !timeline && !recording && view.meetings.length > 0;
  if (listing) element("title").textContent = "진행 중인 회의";
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
    | { action: "open-note"; noteId: string }
) {
  if (value === "stop" || value === "stop-viewing") stop.disabled = true;
  void bridge.action(value).catch(() => {
    element("notice").textContent =
      "처리하지 못했습니다. 현재 회의에서 확인해 주세요.";
  });
}
stop.addEventListener("click", () => act(viewing ? "stop-viewing" : "stop"));
element("open").addEventListener("click", () => act("show-current"));
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
    element("notice").textContent = "현재 회의를 확인하지 못했습니다.";
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
