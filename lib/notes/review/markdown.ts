import { headingLines, type NoteMeta } from "@/lib/notes/copy-markdown";
import { describeAssignee } from "@/lib/assignees/describe";
import { formatDueDate } from "@/lib/format/date";
import { formatOffset } from "@/lib/transcription/presentation";
import type { DocLanguage } from "@/lib/i18n/translator";
import {
  REVIEW_SECTIONS,
  type ReviewItem,
  type ReviewSection,
} from "@/lib/notes/review/sections";
import {
  overviewText,
  type MeetingReviewSummary,
} from "@/lib/notes/review/summary";
import type { TopicChip } from "@/lib/notes/review/topics";

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();
const joined = (lines: string[]) => `${lines.join("\n")}\n`;

export function overviewToMarkdown(
  summary: MeetingReviewSummary,
  { t }: DocLanguage
) {
  return joined([
    `## ${t("dates.document.summaryHeading")}`,
    "",
    oneLine(overviewText(summary)),
  ]);
}

export function topicsToMarkdown(
  topics: readonly (TopicChip & { startMs?: number | null; text?: string })[],
  { t }: DocLanguage
) {
  return joined([
    `## ${t("dates.document.topicsHeading")}`,
    "",
    ...topics.map((topic, index) => {
      const at =
        topic.startMs == null ? "" : `[${formatOffset(topic.startMs)}] `;
      const text = topic.text?.trim() || topic.gist;
      return `${index + 1}. ${at}**${oneLine(topic.title)}**${text ? ` — ${oneLine(text)}` : ""}`;
    }),
  ]);
}

export type ItemContext = {
  whenOf?: (item: ReviewItem) => number | null;
  topicTitleOf?: (item: ReviewItem) => string | null;
};

export function reviewSectionToMarkdown(
  section: ReviewSection,
  doc: DocLanguage,
  topicTitle: string | null = null,
  context: ItemContext = {}
) {
  const { t, locale } = doc;
  const name = t(`notes.review.sections.names.${section.key}`);
  const mixed =
    (REVIEW_SECTIONS.find((row) => row.key === section.key)?.kinds.length ??
      0) > 1;
  const lines = [
    topicTitle ? `## ${name} — ${oneLine(topicTitle)}` : `## ${name}`,
    "",
  ];
  const items = section.items.filter((item) => item.included);
  if (items.length === 0)
    return joined([...lines, `_${t("dates.document.none")}_`]);

  for (const item of items) {
    const assignee = describeAssignee(item.assignee, (label) =>
      t("notes.speakers.fallback", { label })
    )?.name;
    const facts = [
      assignee && t("dates.document.assignee", { name: assignee }),
      item.due &&
        t("dates.document.due", { date: formatDueDate(item.due, locale) }),
    ].filter(Boolean);
    const kind = mixed ? `**${t(`notes.kinds.${item.kind}`)}** ` : "";
    const when = context.whenOf?.(item) ?? null;
    const topic = topicTitle ? null : context.topicTitleOf?.(item);
    const where = [
      when === null ? null : `[${formatOffset(when)}]`,
      topic ? t("dates.document.topic", { title: oneLine(topic) }) : null,
    ].filter(Boolean);
    lines.push(
      `- ${kind}${oneLine(item.content)}${facts.length ? ` — ${facts.join(" · ")}` : ""}${where.length ? ` (${where.join(" · ")})` : ""}`
    );
  }
  return joined(lines);
}

export type ExportFormat = "text" | "markdown";

export function reviewToMarkdown({
  note,
  summary,
  topics,
  sections,
  confirmed,
  context,
  doc,
}: {
  note: NoteMeta;
  summary: MeetingReviewSummary | null | undefined;
  topics: readonly (TopicChip & { startMs?: number | null })[];
  sections: readonly ReviewSection[];
  confirmed?: boolean;
  context?: ItemContext;
  doc: DocLanguage;
}) {
  const { t } = doc;
  const head = headingLines(note, doc);
  head[2] = [
    head[2],
    note.projectName
      ? t("dates.document.project", { name: note.projectName })
      : null,
    confirmed === undefined
      ? null
      : t(confirmed ? "dates.document.confirmed" : "dates.document.inReview"),
  ]
    .filter(Boolean)
    .join(" · ");
  const blocks = [joined(head)];
  if (summary?.status === "SUCCEEDED" && overviewText(summary))
    blocks.push(overviewToMarkdown(summary, doc));
  if (topics.length > 0) blocks.push(topicsToMarkdown(topics, doc));
  for (const section of sections) {
    if (section.items.some((item) => item.included))
      blocks.push(reviewSectionToMarkdown(section, doc, null, context));
  }
  return blocks.join("\n");
}

export function markdownToText(markdown: string) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^- /gm, "• ")
    .replace(/^_(.+)_$/gm, "$1");
}

export function renderExport(format: ExportFormat, markdown: string) {
  return format === "markdown" ? markdown : markdownToText(markdown);
}
