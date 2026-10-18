import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";

import { Key } from "@/app/(static)/help/_content/shared";
import {
  HelpBadge,
  HelpCallout,
  HelpProblem,
  HelpTab,
  HelpTabs,
  MdCell,
  MdClip,
  MdH3,
  MdImage,
  MdInlineCode,
  MdLink,
  MdList,
  MdParagraph,
  MdPre,
  MdSteps,
  MdTable,
  RelatedItem,
  RelatedList,
} from "@/components/help/md/blocks";
import { remarkHelp } from "@/components/help/md/plugin";
import { textOf } from "@/lib/help/text";

const BASE = {
  a: MdLink,
  p: MdParagraph,
  img: MdImage,
  ol: MdSteps,
  ul: MdList,
  table: MdTable,
  td: MdCell,
  code: MdInlineCode,
  pre: MdPre,
  h3: MdH3,
  h4: MdH3,
  mark: Key,
  "help-callout": HelpCallout,
  "help-tabs": HelpTabs,
  "help-tab": HelpTab,
  "help-problem": HelpProblem,
  "help-clip": MdClip,
  "help-badge": HelpBadge,
} as unknown as Components;

const RELATED = {
  ...BASE,
  ul: RelatedList,
  li: RelatedItem,
} as unknown as Components;

/**
 * 가이드 마크다운 한 덩어리(문단 · 목록 · 표 · 알림 …)를 그린다. 문법은 `content/help/README.md`.
 * 내용은 우리가 쓴 글이라 원시 HTML 은 받지 않고(`rehype-raw` 없음), 주소만 `help:` · `img:` 를 그대로 둔다.
 */
export function MdBlock({
  source,
  variant,
}: {
  source: string;
  variant?: "related";
  /** 검색 색인 · 시험이 읽는 글(`textOf`). 화면에는 쓰지 않는다. */
  plainText?: string;
}): ReactNode {
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkDirective, remarkHelp]}
      urlTransform={(url) => url}
      components={variant === "related" ? RELATED : BASE}
    >
      {source}
    </Markdown>
  );
}

MdBlock.text = (props: { plainText?: string; source: string }) =>
  props.plainText ?? props.source;

/** 자주 묻는 질문 하나. `<details>` 라서 스크립트 없이 접고 펴지고, 프리렌더에도 답이 들어 있다. */
export function FaqItem({
  question,
  answer,
  open,
}: {
  question: string;
  answer: ReactNode;
  open?: boolean;
}) {
  return (
    <details
      open={open}
      data-help-faq=""
      className="details-motion group/faq rounded-[12px] border border-[var(--tv-rule)] px-4 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-bold text-[var(--tv-ink)]">
        {question}
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-[var(--tv-muted)] transition-transform group-open/faq:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-3 pb-4">{answer}</div>
    </details>
  );
}

FaqItem.text = (props: { question: string; answer: ReactNode }) =>
  `${props.question} ${textOf(props.answer)}`;
