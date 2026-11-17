import type { HelpTopic } from "@/app/[lang]/help/_content/types";
import { normalizeQuery } from "@/lib/help/match-ranges";
import { textOf } from "@/lib/help/text";
import { localePath, type Locale } from "@/lib/i18n/locales";

export type HelpEntry = {
  path: string;
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
  excerpt: string;
  from: number;
  to: number;
  count: number;
};

export function buildHelpIndex(
  topics: readonly HelpTopic[],
  axisOf: (topic: HelpTopic) => "feature" | "situation" = () => "feature",
  locale: Locale = "ko"
): HelpEntry[] {
  return topics.flatMap((topic) =>
    topic.sections.flatMap((section) => {
      const base = {
        path: localePath(locale, `/help/${topic.group}/${topic.slug}`),
        axis: axisOf(topic),
        topicTitle: topic.title,
        sectionId: section.id,
        sectionTitle: section.title,
      };
      return [
        { ...base, text: section.title },
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
