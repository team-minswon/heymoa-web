import type { MeetingTimelineSnapshot } from "@heymoa/desktop-contracts";

export const MEETING_CHANNELS = {
  report: "heymoa:meeting-timeline",
  read: "heymoa:meeting-read",
  changed: "heymoa:meeting-changed",
  action: "heymoa:meeting-action",
} as const;
export const TIMELINE_STALE_MS = 30_000;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_MEETING_TIMELINE");
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[]) {
  if (
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    throw new Error("INVALID_MEETING_TIMELINE");
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max)
    throw new Error("INVALID_MEETING_TIMELINE");
  return value;
}
function offset(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error("INVALID_MEETING_TIMELINE");
  return value as number;
}
/** Rebuild a bounded display DTO at the remote renderer -> main trust boundary. */
export function meetingTimeline(
  value: unknown
): MeetingTimelineSnapshot | null {
  if (value === null) return null;
  const v = record(value);
  exact(v, [
    "noteId",
    "title",
    "loading",
    "failed",
    "reconnecting",
    "total",
    "items",
  ]);
  for (const key of ["loading", "failed", "reconnecting"])
    if (typeof v[key] !== "boolean")
      throw new Error("INVALID_MEETING_TIMELINE");
  if (!Array.isArray(v.items) || v.items.length > 120)
    throw new Error("INVALID_MEETING_TIMELINE");
  const total = offset(v.total);
  if (total < v.items.length) throw new Error("INVALID_MEETING_TIMELINE");
  const ids = new Set<string>();
  const items = v.items.map((raw) => {
    const item = record(raw);
    exact(item, ["id", "tone", "label", "content", "atMs", "citations"]);
    const id = text(item.id, 64);
    if (!id || ids.has(id)) throw new Error("INVALID_MEETING_TIMELINE");
    ids.add(id);
    if (
      !["decision", "task", "open", "answered", "reference"].includes(
        item.tone as string
      ) ||
      !Array.isArray(item.citations) ||
      item.citations.length > 8
    )
      throw new Error("INVALID_MEETING_TIMELINE");
    return {
      id,
      tone: item.tone as MeetingTimelineSnapshot["items"][number]["tone"],
      label: text(item.label, 64),
      content: text(item.content, 4000),
      atMs: item.atMs === null ? null : offset(item.atMs),
      citations: item.citations.map((rawCitation) => {
        const citation = record(rawCitation);
        exact(citation, ["atMs", "text"]);
        return { atMs: offset(citation.atMs), text: text(citation.text, 4000) };
      }),
    };
  });
  const noteId = text(v.noteId, 64);
  if (!noteId) throw new Error("INVALID_MEETING_TIMELINE");
  return {
    noteId,
    title: text(v.title, 300),
    total,
    items,
    loading: v.loading as boolean,
    failed: v.failed as boolean,
    reconnecting: v.reconnecting as boolean,
  };
}

export type MeetingPopoverView = {
  timeline: MeetingTimelineSnapshot | null;
  label: string;
  elapsed: string | null;
  warning: string | null;
  canStop: boolean;
  stale: boolean;
};

/** Constrain both top menu bars and bottom/side taskbars to the selected display. */
export function popoverBounds(
  anchor: { x: number; y: number; width: number; height: number },
  area: { x: number; y: number; width: number; height: number }
) {
  const width = Math.min(420, area.width),
    height = Math.min(580, area.height);
  const below = anchor.y + anchor.height;
  const y = below + height <= area.y + area.height ? below : anchor.y - height;
  return {
    x: Math.round(
      Math.max(
        area.x,
        Math.min(
          anchor.x + anchor.width / 2 - width / 2,
          area.x + area.width - width
        )
      )
    ),
    y: Math.round(Math.max(area.y, Math.min(y, area.y + area.height - height))),
    width,
    height,
  };
}
