import type {
  MeetingTimelineItem,
  MeetingTimelineSnapshot,
} from "@heymoa/desktop-contracts";
import type { MeetingPopoverView } from "../src/meeting-timeline";

type MeetingBridge = {
  read(): Promise<MeetingPopoverView>;
  action(action: "stop" | "show-current" | "hide"): Promise<void>;
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
  function update(value: MeetingTimelineItem) {
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
  }
  update(item);
  return { node, item, update };
}
const rowViews = new Map<string, ReturnType<typeof createRow>>();
function renderItems() {
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
  element("limited").textContent =
    timeline && timeline.total > timeline.items.length
      ? `최근 ${timeline.items.length}개 항목을 표시합니다. 전체 ${timeline.total}개는 현재 회의에서 확인할 수 있습니다.`
      : "";
  if (following) scroll.scrollTop = scroll.scrollHeight;
  latest.hidden = following || displayed.length === 0;
}
function receive(view: MeetingPopoverView) {
  // Read follow intent before mutating the DOM, not after new rows push the bottom away.
  following = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 60;
  if (timeline?.noteId !== view.timeline?.noteId) {
    filter = "ALL";
    following = true;
    rowViews.clear();
    items.replaceChildren();
  }
  timeline = view.timeline;
  recording = view.canStop;
  emptyMessage = view.unknown
    ? "녹음 상태를 확인하지 못했습니다. HeyMoa를 열어 상태를 확인해 주세요."
    : recording
      ? "회의 타임라인을 기다리고 있습니다. 현재 회의를 열어 확인해 주세요."
      : view.phase === "requesting-permission" || view.phase === "connecting"
        ? "녹음 시작을 기다리고 있습니다. 현재 회의에서 상태를 확인해 주세요."
        : view.phase === "stopping"
          ? "녹음 중지와 전송 완료를 기다리고 있습니다."
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
  stop.disabled = !view.canStop;
  renderItems();
}
scroll.addEventListener("scroll", () => {
  following = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 60;
  latest.hidden = following || !timeline?.items.length;
});
latest.addEventListener("click", () => {
  following = true;
  scroll.scrollTop = scroll.scrollHeight;
  latest.hidden = true;
});
function act(value: "stop" | "show-current" | "hide") {
  if (value === "stop") stop.disabled = true;
  void bridge.action(value).catch(() => {
    element("notice").textContent =
      "처리하지 못했습니다. 현재 회의에서 확인해 주세요.";
  });
}
stop.addEventListener("click", () => act("stop"));
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
window.addEventListener("unload", unsubscribe, { once: true });
