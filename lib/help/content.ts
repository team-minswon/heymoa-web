import fs from "node:fs";
import path from "node:path";

import { createElement, type ReactNode } from "react";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { helpGroups } from "@/app/(static)/help/_content/groups";
import { HELP_PAGES, type HelpPageId } from "@/app/(static)/help/_content/ids";
import {
  HELP_BADGES,
  type HelpBadgeName,
  type HelpSection,
  HelpTopic,
} from "@/app/(static)/help/_content/types";
import { FaqItem, MdBlock } from "@/components/help/md/render";

/**
 * 가이드 본문은 `content/help/<그룹>/<slug>.md` 에 있다(문법: `content/help/README.md`).
 * 여기서 한 번 읽어 `HelpTopic` 으로 만든다 — 라우트 · 검색 색인 · sitemap · JSON-LD 는 모두 이 결과를 쓴다.
 *
 * 파일을 읽는 곳은 여기 하나다(빌드 때 한 번, 정적 프리렌더). 파일은 `## 제목 {#섹션-id}` 로 섹션을 나눈다 —
 * 섹션 id 는 바깥 링크가 `#id` 로 오는 주소라서 바꾸지 않는다.
 */
const CONTENT_ROOT = path.join(process.cwd(), "content", "help");

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

/** mdast 의 글자(렌더된 DOM 의 textContent 와 같게 이어 붙인다). */
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
  for (const key of ["title", "description", "group", "slug", "order"]) {
    if (!meta[key]) throw new Error(`${file}: frontmatter ${key} 가 없습니다`);
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

/** `### 질문` + 그 아래 답 덩어리들 */
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

/** `:::problem` 에서 증상(질문)과 해결 방법(답)을 뽑는다 — 본문 글 그대로(렌더된 글과 같게 이어 붙인다). */
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
        if (["증상", "원인", "해결 방법"].includes(label)) {
          segs.push({ label, text: "" });
        } else {
          add(plain(inline));
        }
      }
    } else {
      add(plain(kid));
    }
  }
  const sym = segs.find((g) => g.label === "증상");
  const fix = segs.find((g) => g.label === "해결 방법");
  return sym && fix ? { question: oneLine(sym.text), answer: fix.text.trim() } : null;
}

function findAll(nodes: Mdast[], pick: (n: Mdast) => boolean): Mdast[] {
  return nodes.flatMap((n) => [
    ...(pick(n) ? [n] : []),
    ...findAll(n.children ?? [], pick),
  ]);
}

function topicOf(file: string): { topic: HelpTopic; order: number } {
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
            source: answer,
            plainText: oneLine(g.answer.map(spaced).join(" ")),
          }),
        });
      });
    } else {
      blocks = nodes.map((node, i) =>
        createElement(MdBlock, {
          key: i,
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
      sections,
      ...(howTo ? { howTo } : {}),
      ...(!howTo && faq.length > 0 ? { faq } : {}),
      ...(related ? { related } : {}),
    },
  };
}

const INLINE = new Set(["text", "strong", "emphasis", "link", "inlineCode", "delete", "textDirective", "break"]);

/** 검색 색인이 읽는 글: 블록 사이는 공백으로 띄운다. */
function spaced(node: Mdast): string {
  if (node.value !== undefined) return node.value;
  const kids = node.children ?? [];
  return kids.map(spaced).join(kids.some((k) => !INLINE.has(k.type)) ? " " : "");
}

/** 단계 한 줄의 글: 굵은 제목과 설명 사이에 공백을 둔다(검색 · HowTo 가 읽는다). */
function plainSpaced(node: Mdast): string {
  if (node.value !== undefined) return node.value;
  const parts = (node.children ?? []).map(plainSpaced);
  return node.type === "listItem" || node.type === "paragraph"
    ? parts.join(" ")
    : parts.join("");
}

let cache: readonly HelpTopic[] | undefined;

export function loadHelpTopics(): readonly HelpTopic[] {
  if (cache) return cache;
  const found: { topic: HelpTopic; order: number }[] = [];
  for (const group of fs.readdirSync(CONTENT_ROOT, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(CONTENT_ROOT, group.name))) {
      if (file.endsWith(".md")) {
        found.push(topicOf(path.join(CONTENT_ROOT, group.name, file)));
      }
    }
  }
  const groupIndex = (slug: string) =>
    helpGroups.findIndex((g) => g.slug === slug);
  cache = found
    .sort(
      (a, b) =>
        groupIndex(a.topic.group) - groupIndex(b.topic.group) ||
        a.order - b.order
    )
    .map((f) => f.topic);
  return cache;
}
