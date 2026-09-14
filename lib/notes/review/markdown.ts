import { describeAssignee } from "@/lib/assignees/describe";
import { formatDueDate } from "@/lib/format/date";
import { KIND_LABEL, REVIEW_SECTIONS, type ReviewSection } from "@/lib/notes/review/sections";
import type { MeetingReviewSummary } from "@/lib/notes/review/summary";
import type { TopicChip } from "@/lib/notes/review/topics";

/**
 * 검토 화면의 섹션을 하나씩 마크다운으로 옮긴다. 전사 · 요약 복사(`copy-markdown`)와 같이 헤딩 · 굵게 ·
 * 번호 · 불릿만 쓴다 — 붙여넣는 곳이 렌더하지 않아도 평문으로 읽힌다.
 * 뺀 항목은 싣지 않는다. 확정되지 않을 줄이 복사본을 타고 남에게 가면 안 된다.
 */

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();
const joined = (lines: string[]) => `${lines.join("\n")}\n`;

export function overviewToMarkdown(summary: MeetingReviewSummary) {
  return joined(["## 개요", "", oneLine(summary.lead.map((line) => line.text).join(" "))]);
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
