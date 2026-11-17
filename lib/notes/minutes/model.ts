import { describeAssignee } from "@/lib/assignees/describe";
import {
  formatAppClock,
  formatAppDate,
  formatDueDate,
  getAppDateKey,
} from "@/lib/format/date";
import type { DocLanguage } from "@/lib/i18n/translator";
import type { NoteMeta } from "@/lib/notes/copy-markdown";
import type { TimelineGroup } from "@/lib/notes/proposals/timeline";
import type { ReviewItem, ReviewSection } from "@/lib/notes/review/sections";
import { gapHeadline } from "@/lib/transcription/gaps";
import {
  formatOffset,
  type TranscriptRow,
} from "@/lib/transcription/presentation";
import type { SpeakerIdentity } from "@/lib/transcription/speaker-identity";

export type MinutesDocument = {
  title: string;
  dateLabel: string;
  durationLabel: string | null;
  attendees: string[];
  attendeeCount: number;
  unnamedSpeakers: number;
  sharedBy: string | null;
  confirmed: boolean;
  headline: string | null;
  lead: string[];
  agendas: MinutesAgenda[];
  owners: { name: string | null; count: number }[];
  decisions: MinutesDecision[];
  actions: MinutesAction[];
  open: MinutesOpen[];
  transcript: MinutesLine[] | null;
  transcriptTruncated: boolean;
  footer: string;
  fileName: string;
};

export type MinutesAgenda = {
  no: number;
  title: string;
  gist: string | null;
  text: string;
  start: string | null;
  decisions: number;
  actions: number;
  open: number;
};

export type MinutesDecision = {
  no: number;
  text: string;
  agendaNo: number | null;
  at: string | null;
};

export type MinutesAction = {
  no: number;
  content: string;
  assignee: string | null;
  due: string | null;
  agendaNo: number | null;
  at: string | null;
};

export type MinutesOpen = {
  no: number;
  content: string;
  assignee: string | null;
  agendaNo: number | null;
  at: string | null;
};

export type MinutesLine =
  | { type: "agenda"; at: string; no: number; title: string }
  | {
      type: "utterance";
      at: string;
      speaker: string | null;
      unnamed: boolean;
      text: string;
      refs: string[];
    }
  | { type: "gap"; at: string; text: string };

export type MinutesTone = "decision" | "task" | "open";

export type MinutesTimelineRow = {
  at: string | null;
  tone: MinutesTone;
  label: string;
  text: string;
};

export type MinutesGroup<Row> = {
  title: string | null;
  range: string | null;
  rows: Row[];
};

export type MinutesInclude = { transcript: boolean };

export function durationLabel(
  ms: number | null | undefined,
  { t }: DocLanguage
) {
  if (!ms || ms < 60_000) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return t("dates.duration.minutes", { minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest
    ? t("dates.duration.hoursMinutes", { hours, minutes: rest })
    : t("dates.duration.hours", { hours });
}

function dateLabelOf(
  whenIso: string,
  endedIso: string | undefined,
  locale: string
) {
  const day = formatAppDate(
    whenIso,
    { year: "numeric", month: "numeric", day: "numeric", weekday: "short" },
    locale
  );
  const start = formatAppClock(whenIso);
  if (!endedIso) return `${day} ${start}`;
  if (getAppDateKey(endedIso) !== getAppDateKey(whenIso)) {
    const endDay = formatAppDate(
      endedIso,
      { year: "numeric", month: "numeric", day: "numeric", weekday: "short" },
      locale
    );
    return `${day} ${start} – ${endDay} ${formatAppClock(endedIso)}`;
  }
  return `${day} ${start} – ${formatAppClock(endedIso)}`;
}

export function minutesFileName(
  title: string,
  whenIso: string,
  { t }: DocLanguage
) {
  const safe = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .replace(/[. ]+$/, "");
  return t("dates.document.minutesFile", {
    title: safe || t("dates.document.minutesFileUntitled"),
    date: getAppDateKey(whenIso).replaceAll("-", ""),
  });
}

const rangeOf = (startMs: number | null, endMs: number | null) =>
  startMs === null
    ? null
    : endMs === null || endMs === startMs
      ? formatOffset(startMs)
      : `${formatOffset(startMs)} – ${formatOffset(endMs)}`;

function headsOf(
  groups: readonly TimelineGroup[],
  lengthMs: number | null,
  { t }: DocLanguage
) {
  const anyAgenda = groups.some((group) => group.agenda !== null);
  return groups.map((group) => ({
    title: anyAgenda
      ? (group.agenda?.title ?? t("dates.document.otherAgenda"))
      : null,
    range: anyAgenda ? rangeOf(group.startMs, group.endMs ?? lengthMs) : null,
  }));
}

export function minutesTimeline(
  groups: readonly TimelineGroup[],
  doc: DocLanguage,
  lengthMs: number | null = null
) {
  const heads = headsOf(groups, lengthMs, doc);
  return groups
    .map(
      (group, index): MinutesGroup<MinutesTimelineRow> => ({
        ...heads[index],
        rows: group.items.flatMap((item) => {
          if (item.proposal.closeReason === "RETRACTED") return [];
          if (
            item.tone !== "decision" &&
            item.tone !== "task" &&
            item.tone !== "open"
          )
            return [];
          return [
            {
              at: item.atMs === null ? null : formatOffset(item.atMs),
              tone: item.tone,
              label: doc.t(`dates.document.tones.${item.tone}`),
              text: item.proposal.content.trim(),
            },
          ];
        }),
      })
    )
    .filter((group) => group.rows.length > 0);
}

export function stillOpen(
  items: readonly ReviewItem[],
  groups: readonly TimelineGroup[]
): ReviewItem[] {
  const open = new Set(
    groups.flatMap((group) =>
      group.items
        .filter((row) => row.tone === "open")
        .map((row) => row.proposal.proposalId)
    )
  );
  return items.filter(
    (item) =>
      !item.originalProposalRef || open.has(item.originalProposalRef.proposalId)
  );
}

export type SpeakerOf = (
  label: string | null | undefined,
  assignedParticipantId?: string | null
) => SpeakerIdentity | null;

const RUN_CHARS = 400;
const RUN_LINES = 8;

export type MinutesTopic = {
  title: string;
  gist: string | null;
  text: string;
  decisions: readonly ReviewItem[];
  tasks: readonly ReviewItem[];
  open: readonly ReviewItem[];
  startMs?: number | null;
};

export type MinutesTranscriptSource = {
  rows: readonly TranscriptRow[];
  speakerOf: SpeakerOf | null;
  truncated: boolean;
};

const GIST_CHARS = 60;

function gistOf(topic: Pick<MinutesTopic, "gist" | "text">): string | null {
  const text =
    topic.gist?.trim() ||
    topic.text.trim().match(/^.+?[.!?。](?=\s|$)/)?.[0] ||
    topic.text.trim();
  if (!text) return null;
  if (text.length <= GIST_CHARS) return text;
  const cut = text.lastIndexOf(" ", GIST_CHARS);
  return `${text.slice(0, cut > GIST_CHARS / 2 ? cut : GIST_CHARS).trimEnd()}…`;
}

const pointAt = (ms: number | null | undefined) =>
  ms === null || ms === undefined ? null : formatOffset(ms);

export function buildMinutes({
  note,
  sharedBy = null,
  confirmed = false,
  headline = null,
  lead = [],
  topics,
  sections,
  citedAt,
  unfiledOpen = [],
  unnamedSpeakers = 0,
  transcript = null,
  include,
  doc,
}: {
  note: NoteMeta;
  sharedBy?: string | null;
  confirmed?: boolean;
  headline?: string | null;
  lead?: readonly string[];
  topics: readonly MinutesTopic[];
  sections: readonly ReviewSection[];
  citedAt: (item: ReviewItem) => number | null;
  unfiledOpen?: readonly ReviewItem[];
  unnamedSpeakers?: number;
  transcript?: MinutesTranscriptSource | null;
  include: MinutesInclude;
  doc: DocLanguage;
}): MinutesDocument {
  const { t, locale } = doc;
  const speakerName = (label: string) =>
    t("notes.speakers.fallback", { label });
  const attendees = (note.participantNames ?? [])
    .map((name) => name.trim())
    .filter(Boolean);
  const date = formatAppDate(
    note.whenIso,
    { year: "numeric", month: "numeric", day: "numeric" },
    locale
  );

  const seen = new Set<string>();
  const fresh = (items: readonly ReviewItem[]) =>
    items.filter((item) => {
      if (!item.included || seen.has(item.itemId)) return false;
      seen.add(item.itemId);
      return true;
    });

  const decisions: MinutesDecision[] = [];
  const actions: MinutesAction[] = [];
  const open: MinutesOpen[] = [];
  const agendas: MinutesAgenda[] = [];
  const agendaStarts: { ms: number; no: number; title: string }[] = [];
  const refsOf = new Map<string, string[]>();
  const cite = (item: ReviewItem, label: string) => {
    for (const { segmentId } of item.citations ?? [])
      refsOf.set(segmentId, [...(refsOf.get(segmentId) ?? []), label]);
  };

  const place = (
    no: number | null,
    title: string,
    gist: string | null,
    startMs: number | null,
    source: Pick<MinutesTopic, "decisions" | "tasks" | "open">,
    text = ""
  ) => {
    const picked = {
      decisions: fresh(source.decisions),
      tasks: fresh(source.tasks),
      open: fresh(source.open),
    };
    for (const item of picked.decisions) {
      decisions.push({
        no: decisions.length + 1,
        text: item.content.trim(),
        agendaNo: no,
        at: pointAt(citedAt(item)),
      });
      cite(item, t("dates.document.refs.decision", { no: decisions.length }));
    }
    for (const item of picked.tasks) {
      actions.push({
        no: actions.length + 1,
        content: item.content.trim(),
        assignee: describeAssignee(item.assignee, speakerName)?.name ?? null,
        due: item.due ? formatDueDate(item.due, locale) : null,
        agendaNo: no,
        at: pointAt(citedAt(item)),
      });
      cite(item, t("dates.document.refs.task", { no: actions.length }));
    }
    for (const item of picked.open) {
      open.push({
        no: open.length + 1,
        content: item.content.trim(),
        assignee: describeAssignee(item.assignee, speakerName)?.name ?? null,
        agendaNo: no,
        at: pointAt(citedAt(item)),
      });
      cite(item, t("dates.document.refs.open", { no: open.length }));
    }
    const counts = {
      decisions: picked.decisions.length,
      actions: picked.tasks.length,
      open: picked.open.length,
    };
    if (
      no === null ||
      (!gist && counts.decisions + counts.actions + counts.open === 0)
    )
      return;
    agendas.push({ no, title, gist, text, start: pointAt(startMs), ...counts });
    if (startMs !== null) agendaStarts.push({ ms: startMs, no, title });
  };

  topics.forEach((topic, index) =>
    place(
      index + 1,
      topic.title.trim(),
      gistOf(topic),
      topic.startMs ?? null,
      topic,
      topic.text.trim() || topic.gist?.trim() || ""
    )
  );
  const rest = (key: ReviewSection["key"]) =>
    sections.find((section) => section.key === key)?.items ?? [];
  place(null, "", null, null, {
    decisions: rest("DECISION"),
    tasks: rest("ACTION_ITEM"),
    open: unfiledOpen,
  });

  const owners = new Map<string | null, number>();
  for (const action of actions)
    owners.set(action.assignee, (owners.get(action.assignee) ?? 0) + 1);

  return {
    title: note.title,
    dateLabel: dateLabelOf(note.whenIso, note.endedIso, locale),
    durationLabel: durationLabel(note.durationMs, doc),
    attendees,
    attendeeCount: attendees.length || note.participantCount,
    unnamedSpeakers,
    sharedBy: sharedBy?.trim() || null,
    confirmed,
    headline: headline?.trim() || null,
    lead: lead.map((line) => line.trim()).filter(Boolean),
    agendas,
    owners: [...owners]
      .map(([name, count]) => ({ name, count }))
      .sort(
        (a, b) =>
          Number(a.name === null) - Number(b.name === null) || b.count - a.count
      ),
    decisions,
    actions,
    open,
    transcript:
      include.transcript && transcript
        ? transcriptLines(transcript, refsOf, agendaStarts, doc)
        : null,
    transcriptTruncated:
      include.transcript && transcript ? transcript.truncated : false,
    footer: t("dates.document.minutesFooter", { date, title: note.title }),
    fileName: minutesFileName(note.title, note.whenIso, doc),
  };
}

function splitRun(text: string): string[] {
  const lines = text.split("\n").flatMap((line) => {
    const parts: string[] = [];
    let rest = line;
    while (rest.length > RUN_CHARS) {
      const space = rest.lastIndexOf(" ", RUN_CHARS);
      const cut = space > RUN_CHARS / 2 ? space : RUN_CHARS;
      parts.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    parts.push(rest);
    return parts;
  });
  const out: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (
      current.length > 0 &&
      (current.length >= RUN_LINES ||
        [...current, line].join("\n").length > RUN_CHARS)
    ) {
      out.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.some(Boolean)) out.push(current.join("\n"));
  return out.filter((part) => part.trim());
}

function transcriptLines(
  { rows, speakerOf }: MinutesTranscriptSource,
  refsOf: ReadonlyMap<string, string[]>,
  agendaStarts: readonly { ms: number; no: number; title: string }[],
  { t }: DocLanguage
): MinutesLine[] {
  const starts = [...agendaStarts].sort((a, b) => a.ms - b.ms);
  const lines: MinutesLine[] = [];
  let next = 0;
  let lastKey: string | null = null;
  for (const row of rows) {
    while (next < starts.length && starts[next].ms <= row.startedAtMs) {
      const { ms, no, title } = starts[next++];
      lines.push({ type: "agenda", at: formatOffset(ms), no, title });
    }
    if (row.type === "gap") {
      lines.push({
        type: "gap",
        at: formatOffset(row.gap.startedAtMs),
        text: gapHeadline(row.gap, t),
      });
      lastKey = null;
      continue;
    }
    const text = row.segment.text.trim();
    if (!text) continue;
    const who =
      speakerOf?.(
        row.segment.speakerLabel,
        row.segment.assignedParticipantId
      ) ?? null;
    const speaker = who?.displayName ?? null;
    const key =
      who === null
        ? null
        : row.segment.assignedParticipantId
          ? `p:${row.segment.assignedParticipantId}`
          : `l:${row.segment.speakerLabel}`;
    const refs = [...new Set(refsOf.get(row.segment.segmentId) ?? [])];
    const previous = lines.at(-1);
    const sameSpeaker = key !== null && key === lastKey;
    lastKey = key;
    const joinedLines =
      previous?.type === "utterance"
        ? previous.text.split("\n").length + text.split("\n").length
        : 0;
    if (
      previous?.type === "utterance" &&
      sameSpeaker &&
      previous.text.length + text.length < RUN_CHARS &&
      joinedLines <= RUN_LINES
    ) {
      lines[lines.length - 1] = {
        ...previous,
        text: `${previous.text} ${text}`,
        refs: [...new Set([...previous.refs, ...refs])],
      };
      continue;
    }
    splitRun(text).forEach((part, index) =>
      lines.push({
        type: "utterance",
        at: index === 0 ? formatOffset(row.segment.startedAtMs) : "",
        speaker,
        unnamed:
          who !== null &&
          who.displayName ===
            t("notes.speakers.fallback", {
              label: row.segment.speakerLabel ?? "",
            }),
        text: part,
        refs: index === 0 ? refs : [],
      })
    );
  }
  for (; next < starts.length; next++) {
    const { ms, no, title } = starts[next];
    lines.push({ type: "agenda", at: formatOffset(ms), no, title });
  }
  return lines;
}

const MARK_CONSONANTS = [0, 2, 3, 5, 6, 7, 9, 11, 12, 14, 15, 16, 17, 18];
const MARK_VOWELS = [0, 4, 8, 13, 18, 20];

export function hangulMarker(index: number) {
  const consonant = MARK_CONSONANTS[index % 14];
  const vowel = MARK_VOWELS[Math.floor(index / 14)];
  if (vowel === undefined) return `${index + 1}`;
  return String.fromCharCode(0xac00 + (consonant * 21 + vowel) * 28);
}
