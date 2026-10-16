import { headingLines, type NoteMeta } from "@/lib/notes/copy-markdown";
import type { MinutesGroup, MinutesTimelineRow } from "@/lib/notes/minutes/model";

/**
 * 타임라인 탭의 복사본. 머리말(회의명 · 일시 · 참석자)은 요약 · 스크립트 복사와 같고, 그 아래 안건마다 결정 · 할 일 ·
 * 미결을 시간순 한 줄씩 적는다. 헤딩 · 굵게 · 불릿만 쓴다 — 렌더하지 않는 곳에서도 읽힌다.
 */
export function timelineToMarkdown(note: NoteMeta, groups: readonly MinutesGroup<MinutesTimelineRow>[]) {
  const lines = [...headingLines(note, " — 타임라인")];
  if (groups.length === 0) lines.push("", "_정해진 것 · 남은 것이 아직 없습니다_");
  for (const group of groups) {
    if (group.title !== null) lines.push("", `## ${group.title}${group.range ? ` (${group.range})` : ""}`, "");
    else lines.push("");
    for (const row of group.rows) {
      lines.push(`- ${row.at ? `[${row.at}] ` : ""}**${row.label}** ${row.text}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
