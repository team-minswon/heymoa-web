import fs from "node:fs";
import path from "node:path";

import { createElement, type ReactNode } from "react";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { helpGroups } from "@/app/[lang]/help/_content/groups";
import { HELP_PAGES, type HelpPageId } from "@/app/[lang]/help/_content/ids";
import {
  HELP_BADGES,
  type HelpBadgeName,
  type HelpSection,
  HelpTopic,
} from "@/app/[lang]/help/_content/types";
import { PROBLEM_LABELS } from "@/components/help/md/labels";
import { FaqItem, MdBlock } from "@/components/help/md/render";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/locales";

const CONTENT_ROOT = path.join(process.cwd(), "content", "help");
const rootOf = (locale: Locale) =>
  locale === DEFAULT_LOCALE ? CONTENT_ROOT : path.join(CONTENT_ROOT, locale);

type Mdast = {
  type: string;
  depth?: number;
  ordered?: boolean;
  name?: string;
  value?: string;
  children?: Mdast[];
  position?: { start: { offset: number }; end: { offset: number } };
};

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

const plain = (node: Mdast): string =>
  node.value ?? (node.children ?? []).map(plain).join("");

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

function frontmatterOf(raw: string, file: string) {
  const hit = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!hit) throw new Error(`${file}: frontmatter 가 없습니다`);
  const meta: Record<string, string> = {};
  for (const line of hit[1].split("\n")) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  for (const key of ["title", "description", "group", "slug", "order", "modified"]) {
    if (!meta[key]) throw new Error(`${file}: frontmatter ${key} 가 없습니다`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.modified)) {
    throw new Error(`${file}: modified 는 YYYY-MM-DD 여야 합니다 — ${meta.modified}`);
  }
  return { meta, body: raw.slice(hit[0].length) };
}

type RawSection = { id: string; title: string; nodes: Mdast[] };

function sectionsOf(body: string, file: string): RawSection[] {
  const root = parser.parse(body) as Mdast;
  const out: RawSection[] = [];
  for (const node of root.children ?? []) {
    if (node.type === "heading" && node.depth === 2) {
      const text = plain(node);
      const hit = /^(.*?)\s*\{#([\w-]+)\}$/.exec(text);
      if (!hit) throw new Error(`${file}: H2 에 {#id} 가 없습니다 — ${text}`);
      out.push({ id: hit[2], title: hit[1], nodes: [] });
    } else if (out.length > 0) {
      out[out.length - 1].nodes.push(node);
    } else {
      throw new Error(`${file}: 첫 H2 앞에 본문이 있습니다`);
    }
  }
  return out;
}

const slice = (body: string, nodes: Mdast[]) =>
  body.slice(
    nodes[0].position!.start.offset,
    nodes[nodes.length - 1].position!.end.offset
  );

function faqGroups(nodes: Mdast[]) {
  const groups: { question: Mdast; answer: Mdast[] }[] = [];
  for (const node of nodes) {
    if (node.type === "heading" && node.depth === 3) {
      groups.push({ question: node, answer: [] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].answer.push(node);
    }
  }
  return groups;
}

function problemQa(node: Mdast) {
  const segs: { label: string; text: string }[] = [];
  const add = (text: string) => {
    if (segs.length > 0) segs[segs.length - 1].text += text;
  };
  for (const kid of node.children ?? []) {
    if (kid.type === "paragraph") {
      for (const inline of kid.children ?? []) {
        const label =
          inline.type === "strong" ? plain(inline).replace(/[:：]\s*$/, "") : "";
        if (Object.hasOwn(PROBLEM_LABELS, label)) {
          segs.push({ label, text: "" });
        } else {
          add(plain(inline));
        }
      }
    } else {
      add(plain(kid));
    }
  }
  const sym = segs.find((g) => PROBLEM_LABELS[g.label] === "symptom");
  const fix = segs.find((g) => PROBLEM_LABELS[g.label] === "fix");
  return sym && fix ? { question: oneLine(sym.text), answer: fix.text.trim() } : null;
}

function findAll(nodes: Mdast[], pick: (n: Mdast) => boolean): Mdast[] {
  return nodes.flatMap((n) => [
    ...(pick(n) ? [n] : []),
    ...findAll(n.children ?? [], pick),
  ]);
}

function topicOf(
  file: string,
  locale: Locale
): { topic: HelpTopic; order: number } {
  const raw = fs.readFileSync(file, "utf8");
  const { meta, body } = frontmatterOf(raw, file);
  const slug = meta.slug as HelpPageId;
  if (HELP_PAGES[slug] !== meta.group) {
    throw new Error(`${file}: ids.ts 의 그룹(${HELP_PAGES[slug]})과 다릅니다`);
  }
  if (meta.badge && !(HELP_BADGES as readonly string[]).includes(meta.badge)) {
    throw new Error(`${file}: badge 는 ${HELP_BADGES.join(" · ")} 만 쓸 수 있습니다`);
  }
  const raws = sectionsOf(body, file);
  const faq: { question: string; answer: string }[] = [];

  const sections: HelpSection[] = raws.map(({ id, title, nodes }) => {
    let blocks: ReactNode[];
    if (id === "faq") {
      blocks = faqGroups(nodes).map((g, i) => {
        const question = oneLine(plain(g.question));
        const answer = g.answer.length ? slice(body, g.answer) : "";
        faq.push({
          question,
          answer: g.answer.map(plain).join("").trim(),
        });
        return createElement(FaqItem, {
          key: i,
          question,
          open: i === 0,
          answer: createElement(MdBlock, {
            locale,
            source: answer,
            plainText: oneLine(g.answer.map(spaced).join(" ")),
          }),
        });
      });
    } else {
      blocks = nodes.map((node, i) =>
        createElement(MdBlock, {
          key: i,
          locale,
          source: slice(body, [node]),
          variant: id === "related" ? "related" : undefined,
          plainText: oneLine(spaced(node)),
        })
      );
    }
    for (const node of findAll(nodes, (n) => n.name === "problem")) {
      const qa = problemQa(node);
      if (qa) faq.push(qa);
    }
    return { id, title, body: blocks };
  });

  const isSituation = meta.group === "situations";
  const steps = raws.find((s) => s.id === "steps");
  const list = steps?.nodes.find((n) => n.type === "list" && n.ordered);
  const howTo =
    isSituation && meta.kind !== "facts" && list
      ? (list.children ?? []).map((li) => oneLine(plainSpaced(li)))
      : undefined;
  const related = isSituation
    ? [
        ...new Set(
          findAll(raws.find((s) => s.id === "related")?.nodes ?? [], (n) => n.type === "link").map(
            (n) => (n as Mdast & { url: string }).url
          )
        ),
      ]
        .filter((url) => url.startsWith("help:"))
        .map((url) => url.slice(5).split("#")[0] as HelpPageId)
    : undefined;

  return {
    order: Number(meta.order),
    topic: {
      slug,
      group: meta.group,
      title: meta.title,
      ...(meta.navTitle ? { navTitle: meta.navTitle } : {}),
      ...(meta.badge ? { badge: meta.badge as HelpBadgeName } : {}),
      summary: meta.description,
      modified: meta.modified,
      sections,
      ...(howTo ? { howTo } : {}),
      ...(!howTo && faq.length > 0 ? { faq } : {}),
      ...(related ? { related } : {}),
    },
  };
}

const INLINE = new Set(["text", "strong", "emphasis", "link", "inlineCode", "delete", "textDirective", "break"]);

function spaced(node: Mdast): string {
  if (node.value !== undefined) return node.value;
  const kids = node.children ?? [];
  return kids.map(spaced).join(kids.some((k) => !INLINE.has(k.type)) ? " " : "");
}

function plainSpaced(node: Mdast): string {
  if (node.value !== undefined) return node.value;
  const parts = (node.children ?? []).map(plainSpaced);
  return node.type === "listItem" || node.type === "paragraph"
    ? parts.join(" ")
    : parts.join("");
}

const cache = new Map<Locale, readonly HelpTopic[]>();

export function loadHelpTopics(locale: Locale = DEFAULT_LOCALE): readonly HelpTopic[] {
  const hit = cache.get(locale);
  if (hit) return hit;
  const root = rootOf(locale);
  const found: { topic: HelpTopic; order: number }[] = [];
  for (const group of fs.readdirSync(root, { withFileTypes: true })) {
    if (!group.isDirectory() || (LOCALES as readonly string[]).includes(group.name)) continue;
    for (const file of fs.readdirSync(path.join(root, group.name))) {
      if (file.endsWith(".md")) {
        found.push(topicOf(path.join(root, group.name, file), locale));
      }
    }
  }
  const groupIndex = (slug: string) =>
    helpGroups.findIndex((g) => g.slug === slug);
  const topics = found
    .sort(
      (a, b) =>
        groupIndex(a.topic.group) - groupIndex(b.topic.group) ||
        a.order - b.order
    )
    .map((f) => f.topic);
  cache.set(locale, topics);
  return topics;
}
