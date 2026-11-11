import type {
  ActiveMeeting,
  MeetingTimelineSnapshot,
  RecordingSummary,
  MeetingTarget,
} from "@heymoa/desktop-contracts";

export const MEETING_CHANNELS = {
  report: "heymoa:meeting-timeline",
  read: "heymoa:meeting-read",
  changed: "heymoa:meeting-changed",
  action: "heymoa:meeting-action",
  activeMeetings: "heymoa:active-meetings",
  openNote: "heymoa:open-note",
  list: "heymoa:meeting-list",
  selection: "heymoa:meeting-selection",
  selectionRead: "heymoa:meeting-selection-read",
  unavailable: "heymoa:meeting-unavailable",
  recordingTarget: "heymoa:meeting-recording-target",
} as const;
export const TIMELINE_STALE_MS = 30_000;
/** 웹이 30초마다 다시 보낸다. 숨은 창은 1분으로 느려질 수 있어 그 두 배 넘게 둔다. */
export const ACTIVE_MEETINGS_STALE_MS = 150_000;
export const ACTIVE_MEETINGS_MAX = 20;

export function meetingTarget(value: unknown): MeetingTarget | null {
  if (value === null) return null;
  const v = record(value);
  exact(v, ["workspaceId", "noteId"]);
  const workspaceId = text(v.workspaceId, 64),
    noteId = text(v.noteId, 64);
  if (!workspaceId || !noteId) throw new Error("INVALID_MEETING_TARGET");
  return { workspaceId, noteId };
}

export function loadingMeeting(
  target: Pick<
    ActiveMeeting,
    "noteId" | "workspaceId" | "title" | "state" | "ended"
  >,
  requestId?: number,
  ownsRecording = false
): MeetingTimelineSnapshot {
  const ended = target.ended ?? target.state === "ENDED";
  return {
    noteId: target.noteId,
    title: target.title,
    loading: true,
    failed: false,
    reconnecting: false,
    total: 0,
    items: [],
    detail: {
      workspaceId: target.workspaceId,
      ownsRecording,
      ...(requestId !== undefined ? { selectionId: requestId } : {}),
      ended,
      ...(target.state ? { meetingState: target.state } : {}),
      counts: { ALL: 0, DECISION: 0, ACTION_ITEM: 0, OPEN: 0, REFERENCE: 0 },
      groups: [],
      partial: null,
      summary: {
        status: ended ? "loading" : "unavailable",
        lead: "",
        sections: [],
      },
    },
  };
}

function meetingSummary(
  value: unknown
): NonNullable<NonNullable<MeetingTimelineSnapshot["detail"]>["summary"]> {
  const v = record(value);
  exact(v, ["status", "lead", "sections"]);
  if (
    !["loading", "pending", "failed", "ready", "unavailable"].includes(
      v.status as string
    ) ||
    !Array.isArray(v.sections) ||
    v.sections.length > 20
  )
    throw new Error("INVALID_MEETING_TIMELINE");
  const strings = (value: unknown) => {
    if (!Array.isArray(value) || value.length > 5)
      throw new Error("INVALID_MEETING_TIMELINE");
    return value.map((line) => text(line, 2000));
  };
  const ids = new Set<string>();
  const sections = v.sections.map((raw) => {
    const section = record(raw);
    exact(section, ["id", "title", "description", "conclusions", "openItems"]);
    const id = text(section.id, 64);
    if (!id || ids.has(id)) throw new Error("INVALID_MEETING_TIMELINE");
    ids.add(id);
    return {
      id,
      title: text(section.title, 300),
      description: text(section.description, 4000),
      conclusions: strings(section.conclusions),
      openItems: strings(section.openItems),
    };
  });
  return {
    status: v.status as
      | "loading"
      | "pending"
      | "failed"
      | "ready"
      | "unavailable",
    lead: text(v.lead, 4000),
    sections,
  };
}

export function meetingList(value: unknown) {
  const v = record(value);
  exact(v, ["workspaceId", "status", "meetings"]);
  if (
    !["loading", "ready", "failed", "no-workspace"].includes(v.status as string)
  )
    throw new Error("INVALID_MEETING_LIST");
  const workspaceId = v.workspaceId === null ? null : text(v.workspaceId, 64);
  const meetings = activeMeetings(v.meetings);
  if (
    (!workspaceId && workspaceId !== null) ||
    meetings.some((meeting) => meeting.workspaceId !== workspaceId)
  )
    throw new Error("INVALID_MEETING_LIST");
  return {
    workspaceId,
    status: v.status as "loading" | "ready" | "failed" | "no-workspace",
    meetings,
  };
}

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
    ...(Object.hasOwn(v, "detail") ? ["detail"] : []),
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
  let detail: MeetingTimelineSnapshot["detail"];
  if (Object.hasOwn(v, "detail")) {
    const d = record(v.detail);
    exact(d, [
      "counts",
      "groups",
      "partial",
      ...[
        "ended",
        "summary",
        "workspaceId",
        "ownsRecording",
        "selectionId",
        "meetingState",
      ].filter((key) => Object.hasOwn(d, key)),
    ]);
    if (Object.hasOwn(d, "ended") && typeof d.ended !== "boolean")
      throw new Error("INVALID_MEETING_TIMELINE");
    if (Object.hasOwn(d, "selectionId")) offset(d.selectionId);
    if (
      Object.hasOwn(d, "ownsRecording") &&
      typeof d.ownsRecording !== "boolean"
    )
      throw new Error("INVALID_MEETING_TIMELINE");
    if (
      Object.hasOwn(d, "meetingState") &&
      !["NOT_STARTED", "IN_PROGRESS", "PAUSED", "ENDED"].includes(
        d.meetingState as string
      )
    )
      throw new Error("INVALID_MEETING_TIMELINE");
    if (Object.hasOwn(d, "workspaceId") && !text(d.workspaceId, 64))
      throw new Error("INVALID_MEETING_TIMELINE");
    const c = record(d.counts);
    exact(c, ["ALL", "DECISION", "ACTION_ITEM", "OPEN", "REFERENCE"]);
    const counts = {
      ALL: offset(c.ALL),
      DECISION: offset(c.DECISION),
      ACTION_ITEM: offset(c.ACTION_ITEM),
      OPEN: offset(c.OPEN),
      REFERENCE: offset(c.REFERENCE),
    };
    if (
      counts.ALL !== total ||
      counts.DECISION + counts.ACTION_ITEM + counts.OPEN + counts.REFERENCE !==
        total ||
      !Array.isArray(d.groups) ||
      d.groups.length > 120
    )
      throw new Error("INVALID_MEETING_TIMELINE");
    const groupIds = new Set<string>(),
      groupedIds = new Set<string>();
    const groups = d.groups.map((raw) => {
      const group = record(raw);
      exact(group, ["id", "title", "startMs", "endMs", "itemIds"]);
      const id = text(group.id, 160);
      if (
        !id ||
        groupIds.has(id) ||
        !Array.isArray(group.itemIds) ||
        group.itemIds.length > 120
      )
        throw new Error("INVALID_MEETING_TIMELINE");
      groupIds.add(id);
      const itemIds = group.itemIds.map((rawId) => {
        const itemId = text(rawId, 64);
        if (!ids.has(itemId) || groupedIds.has(itemId))
          throw new Error("INVALID_MEETING_TIMELINE");
        groupedIds.add(itemId);
        return itemId;
      });
      return {
        id,
        title: text(group.title, 300),
        startMs: group.startMs === null ? null : offset(group.startMs),
        endMs: group.endMs === null ? null : offset(group.endMs),
        itemIds,
      };
    });
    if (groupedIds.size !== ids.size)
      throw new Error("INVALID_MEETING_TIMELINE");
    let partial = null;
    if (d.partial !== null) {
      const p = record(d.partial);
      exact(p, ["confirmedText", "pendingText"]);
      partial = {
        confirmedText: text(p.confirmedText, 4000),
        pendingText: text(p.pendingText, 4000),
      };
    }
    detail = {
      counts,
      groups,
      partial,
      ...(Object.hasOwn(d, "workspaceId")
        ? { workspaceId: d.workspaceId as string }
        : {}),
      ...(Object.hasOwn(d, "ownsRecording")
        ? { ownsRecording: d.ownsRecording as boolean }
        : {}),
      ...(Object.hasOwn(d, "selectionId")
        ? { selectionId: d.selectionId as number }
        : {}),
      ...(Object.hasOwn(d, "meetingState")
        ? {
            meetingState: d.meetingState as
              | "NOT_STARTED"
              | "IN_PROGRESS"
              | "PAUSED"
              | "ENDED",
          }
        : {}),
      ...(Object.hasOwn(d, "ended") ? { ended: d.ended as boolean } : {}),
      ...(Object.hasOwn(d, "summary")
        ? { summary: meetingSummary(d.summary) }
        : {}),
    };
  }
  return {
    noteId,
    title: text(v.title, 300),
    total,
    items,
    ...(detail ? { detail } : {}),
    loading: v.loading as boolean,
    failed: v.failed as boolean,
    reconnecting: v.reconnecting as boolean,
  };
}

/** Rebuild the bounded active-meeting list at the remote renderer -> main trust boundary. */
export function activeMeetings(value: unknown): ActiveMeeting[] {
  try {
    if (!Array.isArray(value) || value.length > ACTIVE_MEETINGS_MAX)
      throw new Error();
    const ids = new Set<string>();
    return value.map((raw) => {
      const item = record(raw);
      exact(item, [
        "workspaceId",
        "noteId",
        "title",
        "startedAt",
        ...["ended", "state"].filter((key) => Object.hasOwn(item, key)),
      ]);
      if (Object.hasOwn(item, "ended") && typeof item.ended !== "boolean")
        throw new Error();
      if (
        Object.hasOwn(item, "state") &&
        !["NOT_STARTED", "IN_PROGRESS", "PAUSED", "ENDED"].includes(
          item.state as string
        )
      )
        throw new Error();
      const noteId = text(item.noteId, 64);
      const workspaceId = text(item.workspaceId, 64);
      if (!noteId || !workspaceId || ids.has(noteId)) throw new Error();
      ids.add(noteId);
      return {
        workspaceId,
        noteId,
        title: text(item.title, 300),
        startedAt: item.startedAt === null ? null : offset(item.startedAt),
        ...(Object.hasOwn(item, "ended")
          ? { ended: item.ended as boolean }
          : {}),
        ...(Object.hasOwn(item, "state")
          ? {
              state: item.state as
                | "NOT_STARTED"
                | "IN_PROGRESS"
                | "PAUSED"
                | "ENDED",
            }
          : {}),
      };
    });
  } catch {
    throw new Error("INVALID_ACTIVE_MEETINGS");
  }
}

export type MeetingPopoverView = {
  selection?: MeetingTarget | null;
  selectionSource?: "recording" | "browse" | null;
  recordingTarget?: MeetingTarget | null;
  noteFailed?: boolean;
  meetingsStatus?: "loading" | "ready" | "failed" | "no-workspace";
  panel?: { pinned: boolean; opacity: number };
  language?: "ko" | "en";
  meetings: ActiveMeeting[];
  /** 내 녹음이 아니라 뷰어로 보는 회의가 있다 */
  viewing: boolean;
  phase: RecordingSummary["phase"] | null;
  unknown: boolean;
  timeline: MeetingTimelineSnapshot | null;
  label: string;
  elapsed: string | null;
  warning: string | null;
  canStop: boolean;
  stale: boolean;
};
export type MeetingPopoverAction =
  | "stop"
  | "stop-viewing"
  | "show-current"
  | "show-app"
  | "hide"
  | "settings"
  | "list"
  | "show-recording"
  | { action: "open-note"; noteId: string }
  | { action: "set-panel"; pinned: boolean }
  | { action: "open-selection"; tab: "summary" | "transcript" | "context" };

/** Constrain both top menu bars and bottom/side taskbars to the selected display. */
export function popoverBounds(
  anchor: { x: number; y: number; width: number; height: number },
  area: { x: number; y: number; width: number; height: number },
  preferredHeight = 580
) {
  const width = Math.min(420, area.width),
    height = Math.min(preferredHeight, area.height);
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
