import type { DocLanguage } from "@/lib/i18n/translator";
import { headingLines, type NoteMeta } from "@/lib/notes/copy-markdown";
import type {
  MinutesGroup,
  MinutesTimelineRow,
} from "@/lib/notes/minutes/model";

export function timelineToMarkdown(
  note: NoteMeta,
  groups: readonly MinutesGroup<MinutesTimelineRow>[],
  doc: DocLanguage
) {
  const lines = [...headingLines(note, doc, "timeline")];
  if (groups.length === 0)
    lines.push("", `_${doc.t("dates.document.timelineEmpty")}_`);
  for (const group of groups) {
    if (group.title !== null)
      lines.push(
        "",
        `## ${group.title}${group.range ? ` (${group.range})` : ""}`,
        ""
      );
    else lines.push("");
    for (const row of group.rows) {
      lines.push(
        `- ${row.at ? `[${row.at}] ` : ""}**${row.label}** ${row.text}`
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
