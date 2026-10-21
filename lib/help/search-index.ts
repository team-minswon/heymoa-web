import type { HelpTopic } from "@/app/[lang]/help/_content/types";
import { normalizeQuery } from "@/lib/help/match-ranges";
import { textOf } from "@/lib/help/text";

/** 허브 검색이 훑는 한 줄(문단 또는 섹션 제목). 서버가 만들어 클라이언트에 넘긴다. */
export type HelpEntry = {
  /** 페이지 주소(`/help/<그룹>/<페이지>`) */
  path: string;
  /** 기능 / 상황 — 결과에 종류 칩을 붙인다 */
  axis: "feature" | "situation";
  topicTitle: string;
  sectionId: string;
  sectionTitle: string;
  text: string;
};

export type HelpHit = {
  path: string;
  axis: "feature" | "situation";
  topicTitle: string;
  sectionId: string;
  sectionTitle: string;
  /** 일치 문장 발췌와 그 안의 일치 구간 */
  excerpt: string;
  from: number;
  to: number;
  /** 이 섹션 안의 일치 줄 수 */
  count: number;
};

export function buildHelpIndex(
  topics: readonly HelpTopic[],
  axisOf: (topic: HelpTopic) => "feature" | "situation" = () => "feature"
): HelpEntry[] {
  return topics.flatMap((topic) =>
    topic.sections.flatMap((section) => {
      const base = {
        path: `/help/${topic.group}/${topic.slug}`,
        axis: axisOf(topic),
        topicTitle: topic.title,
        sectionId: section.id,
        sectionTitle: section.title,
      };
      return [
        { ...base, text: section.title },
        // 페이지 제목·요약도 찾아지게 첫 섹션에 한 번 붙인다
        ...(section === topic.sections[0]
          ? [topic.title, topic.summary].map((text) => ({ ...base, text }))
          : []),
        ...section.body
          .map((paragraph) => textOf(paragraph).trim())
          .filter(Boolean)
          .map((text) => ({ ...base, text })),
      ];
    })
  );
}

/** 공백·대소문자를 무시한 첫 일치의 원문 위치. */
export function findInText(text: string, query: string) {
  const needle = normalizeQuery(query);
  if (!needle) return null;
  let flat = "";
  const origin: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (/\s/.test(text[i])) continue;
    flat += text[i].toLowerCase()[0];
    origin.push(i);
  }
  const at = flat.indexOf(needle);
  return at === -1
    ? null
    : { from: origin[at], to: origin[at + needle.length - 1] + 1 };
}

const CONTEXT = 36;

/** 섹션마다 하나로 묶어 돌려준다. 입력 순서(주제 순서)를 지킨다. */
export function searchHelp(
  entries: readonly HelpEntry[],
  query: string
): HelpHit[] {
  const hits = new Map<string, HelpHit>();
  for (const entry of entries) {
    const found = findInText(entry.text, query);
    if (!found) continue;
    const key = `${entry.path}#${entry.sectionId}`;
    const existing = hits.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const start = Math.max(0, found.from - CONTEXT);
    const end = Math.min(entry.text.length, found.to + CONTEXT);
    const lead = start > 0 ? "…" : "";
    hits.set(key, {
      path: entry.path,
      axis: entry.axis,
      topicTitle: entry.topicTitle,
      sectionId: entry.sectionId,
      sectionTitle: entry.sectionTitle,
      excerpt:
        lead +
        entry.text.slice(start, end) +
        (end < entry.text.length ? "…" : ""),
      from: found.from - start + lead.length,
      to: found.to - start + lead.length,
      count: 1,
    });
  }
  return [...hits.values()];
}
