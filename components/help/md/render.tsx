import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";

import { Key } from "@/app/[lang]/help/_content/shared";
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
import type { Locale } from "@/lib/i18n/locales";

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

const maps = new Map<string, Components>();
function componentsFor(locale: Locale, variant?: "related"): Components {
  const key = `${locale}:${variant ?? ""}`;
  let map = maps.get(key);
  if (!map) {
    map = {
      ...BASE,
      a: (props: ComponentProps<typeof MdLink>) => (
        <MdLink {...props} locale={locale} />
      ),
      td: (props: ComponentProps<typeof MdCell>) => (
        <MdCell {...props} locale={locale} />
      ),
      ...(variant === "related" ? { ul: RelatedList, li: RelatedItem } : {}),
    } as unknown as Components;
    maps.set(key, map);
  }
  return map;
}

export function MdBlock({
  source,
  variant,
  locale = "ko",
}: {
  source: string;
  variant?: "related";
  locale?: Locale;
  plainText?: string;
}): ReactNode {
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkDirective, remarkHelp]}
      urlTransform={(url) => url}
      components={componentsFor(locale, variant)}
    >
      {source}
    </Markdown>
  );
}

MdBlock.text = (props: { plainText?: string; source: string }) =>
  props.plainText ?? props.source;

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
