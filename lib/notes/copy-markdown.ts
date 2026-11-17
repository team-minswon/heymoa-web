import type {
  AnalysisResultResponseDataSectionsItem,
  NoteResponseData,
} from "@/lib/api/generated/models";
import { formatAppDate } from "@/lib/format/date";
import type { DocLanguage } from "@/lib/i18n/translator";
import { SECTION_ORDER } from "@/lib/notes/analysis-sections";
import { gapHeadline } from "@/lib/transcription/gaps";
import {
  formatOffset,
  type TranscriptRow,
} from "@/lib/transcription/presentation";

export type NoteMeta = {
  title: string;
  whenIso: string;
  participantCount: number;
  participantNames?: string[];
  durationMs?: number;
  endedIso?: string;
  projectName?: string;
};

export function toNoteMeta(note: NoteResponseData): NoteMeta {
  return {
    title: note.title,
    whenIso: note.meetingStartedAt ?? note.createdAt,
    endedIso: note.meetingEndedAt ?? undefined,
    participantCount: note.participants?.length ?? 0,
    participantNames: note.participants?.map((participant) => participant.name),
    projectName: note.projectName,
  };
}

const MAX_NAMED_PARTICIPANTS = 8;

function participantsFact(meta: NoteMeta, { t }: DocLanguage) {
  const names = (meta.participantNames ?? [])
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.length === 0) {
    return meta.participantCount > 0
      ? t("dates.noteMeta.participants", { count: meta.participantCount })
      : null;
  }
  const shown = names.slice(0, MAX_NAMED_PARTICIPANTS).join(", ");
  const rest = names.length - MAX_NAMED_PARTICIPANTS;
  return rest > 0
    ? t("dates.document.participantsMore", { names: shown, rest })
    : t("dates.document.participantsNamed", { names: shown });
}

export function headingLines(
  meta: NoteMeta,
  doc: DocLanguage,
  kind?: "summary" | "timeline"
) {
  const { t, locale } = doc;
  const facts = [
    formatAppDate(
      meta.whenIso,
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      },
      locale
    ),
    participantsFact(meta, doc),
    meta.durationMs && meta.durationMs >= 60_000
      ? t("dates.noteMeta.recorded", {
          hours: Math.floor(meta.durationMs / 3_600_000),
          minutes: Math.floor(meta.durationMs / 60_000) % 60,
        })
      : null,
  ].filter(Boolean);
  const title =
    kind === "summary"
      ? t("dates.document.summaryTitle", { title: meta.title })
      : kind === "timeline"
        ? t("dates.document.timelineTitle", { title: meta.title })
        : meta.title;

  return [`# ${title}`, "", facts.join(" · ")];
}

export const utteranceMarkdown = (
  speaker: string | null,
  at: string,
  text: string
) => (speaker ? `**${speaker}** [${at}] ${text}` : `[${at}] ${text}`);

export function transcriptToMarkdown({
  note,
  rows,
  speakerNameOf,
  truncated = false,
  doc,
}: {
  note: NoteMeta;
  rows: TranscriptRow[];
  speakerNameOf: (
    label: string | null | undefined,
    assignedParticipantId?: string | null
  ) => string | null;
  truncated?: boolean;
  doc: DocLanguage;
}): string {
  const lines = headingLines(note, doc);

  for (const row of rows) {
    if (row.type === "gap") {
      lines.push("", `> ${gapHeadline(row.gap, doc.t)}`);
      continue;
    }

    const text = row.segment.text.trim();
    if (!text) continue;
    const speaker = speakerNameOf(
      row.segment.speakerLabel,
      row.segment.assignedParticipantId
    );
    lines.push(
      "",
      utteranceMarkdown(speaker, formatOffset(row.segment.startedAtMs), text)
    );
  }

  if (truncated) lines.push("", `> ${doc.t("dates.document.truncated")}`);

  return `${lines.join("\n")}\n`;
}

export function summaryToMarkdown({
  note,
  sections,
  doc,
}: {
  note: NoteMeta;
  sections: AnalysisResultResponseDataSectionsItem[];
  doc: DocLanguage;
}): string {
  const lines = headingLines(note, doc, "summary");
  const byKind = new Map(sections.map((section) => [section.kind, section]));

  for (const kind of SECTION_ORDER) {
    lines.push("", `## ${doc.t(`notes.summary.sections.${kind}`)}`, "");
    const items = byKind.get(kind)?.items ?? [];
    if (!items.length) {
      lines.push(`_${doc.t("dates.document.none")}_`);
      continue;
    }
    for (const item of items) {
      lines.push(`- ${item.content}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
