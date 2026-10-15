import { headingLines, type NoteMeta } from "@/lib/notes/copy-markdown";
import { describeAssignee } from "@/lib/assignees/describe";
import { formatDueDate } from "@/lib/format/date";
import { KIND_LABEL, REVIEW_SECTIONS, type ReviewSection } from "@/lib/notes/review/sections";
import { overviewText, type MeetingReviewSummary } from "@/lib/notes/review/summary";
import type { TopicChip } from "@/lib/notes/review/topics";

/**
 * 검토 화면의 섹션을 하나씩 마크다운으로 옮긴다. 전사 · 요약 복사(`copy-markdown`)와 같이 헤딩 · 굵게 ·
 * 번호 · 불릿만 쓴다 — 붙여넣는 곳이 렌더하지 않아도 평문으로 읽힌다.
 * 뺀 항목은 싣지 않는다. 확정되지 않을 줄이 복사본을 타고 남에게 가면 안 된다.
 */

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();
const joined = (lines: string[]) => `${lines.join("\n")}\n`;

export function overviewToMarkdown(summary: MeetingReviewSummary) {
  return joined(["## 요약", "", oneLine(overviewText(summary))]);
}

export function topicsToMarkdown(topics: readonly TopicChip[]) {
  return joined([
    "## 주제",
    "",
    ...topics.map(
      (topic) => `${topic.ordinal}. **${oneLine(topic.title)}**${topic.gist ? ` — ${oneLine(topic.gist)}` : ""}`
    ),
  ]);
}

/** [topicTitle] 은 주제로 걸러 본 섹션이다. 걸러진 목록이 전부인 것처럼 읽히지 않게 제목에 붙인다. */
export function reviewSectionToMarkdown(section: ReviewSection, topicTitle: string | null = null) {
  const mixed = (REVIEW_SECTIONS.find((row) => row.key === section.key)?.kinds.length ?? 0) > 1;
  const lines = [topicTitle ? `## ${section.label} — ${oneLine(topicTitle)}` : `## ${section.label}`, ""];
  const items = section.items.filter((item) => item.included);
  if (items.length === 0) return joined([...lines, "_없음_"]);

  for (const item of items) {
    const assignee = describeAssignee(item.assignee)?.name;
    const facts = [assignee && `담당 ${assignee}`, item.due && `기한 ${formatDueDate(item.due)}`].filter(Boolean);
    const kind = mixed ? `**${KIND_LABEL[item.kind]}** ` : "";
    lines.push(`- ${kind}${oneLine(item.content)}${facts.length ? ` — ${facts.join(" · ")}` : ""}`);
  }
  return joined(lines);
}

/** 복사·내보내기가 고르는 형식. 형식을 더하면 [renderExport] 한 곳만 늘린다. */
export type ExportFormat = "text" | "markdown";

/**
 * 요약 탭 전체 — 머리말 · 요약 · 주제 · 섹션 — 를 한 문서로 옮긴다. 복사 · 내보내기 · 공유가 모두 이 문서에서 출발한다.
 * 비어 있는 부분은 싣지 않는다: 아직 안 온 요약이나 뺀 항목만 남은 섹션이 「_없음_」 줄로 복사본에 남으면 빈 회의록처럼 읽힌다.
 */
export function reviewToMarkdown({
  note,
  summary,
  topics,
  sections,
}: {
  note: NoteMeta;
  summary: MeetingReviewSummary | null | undefined;
  topics: readonly TopicChip[];
  sections: readonly ReviewSection[];
}) {
  const blocks = [joined(headingLines(note))];
  if (summary?.status === "SUCCEEDED" && overviewText(summary)) blocks.push(overviewToMarkdown(summary));
  if (topics.length > 0) blocks.push(topicsToMarkdown(topics));
  for (const section of sections) {
    if (section.items.some((item) => item.included)) blocks.push(reviewSectionToMarkdown(section));
  }
  return blocks.join("\n");
}

/** 마크다운 기호를 걷어 낸 평문. 렌더하지 않는 곳(메신저·메일 본문)에 붙일 때 기호가 남지 않게 한다. */
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
