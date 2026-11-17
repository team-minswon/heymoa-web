"use client";

import { createContext, useContext, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { MermaidBlock } from "@/components/chat/mermaid-block";
import { copyText } from "@/lib/ui/copy-text";

function languageOf(node: unknown): string | null {
  const first = (
    node as
      | { children?: { properties?: { className?: unknown } }[] }
      | undefined
  )?.children?.[0];
  const classes = first?.properties?.className;
  if (!Array.isArray(classes)) return null;
  const hit = classes.find(
    (each) => typeof each === "string" && each.startsWith("language-")
  );
  return typeof hit === "string" ? hit.slice("language-".length) : null;
}

function CopyButton({ read }: { read: () => string }) {
  const t = useTranslations("chat.code");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? t("copiedLabel") : t("copyLabel")}
      className="inline-flex shrink-0 items-center gap-1 rounded-control px-1.5 py-0.5 text-[11px] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
      onClick={async () => {
        try {
          await copyText(read());
        } catch {
          return;
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <Check aria-hidden className="size-3" />
      ) : (
        <Copy aria-hidden className="size-3" />
      )}
      {copied ? t("copied") : t("copy")}
    </button>
  );
}

/**
 * 복사할 글은 `children` 이 아니라 그려진 DOM 의 `textContent` 에서 읽는다. `innerText` 는
 * 레이아웃을 강제하고 jsdom 에 없어서, 검사가 빈 문자열을 상대로 통과한다.
 *
 * 버튼은 `navigator.clipboard` 유무와 상관없이 그린다 — 그 값으로 렌더를 가르면 hydration 이
 * 어긋난다.
 */
function CodeBlock({
  language,
  children,
}: {
  language: string | null;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLPreElement>(null);
  const t = useTranslations("chat.code");

  return (
    <div className="my-2 overflow-hidden rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--el-hairline)] px-2.5 py-1">
        <span className="truncate font-mono text-[11px] text-[var(--el-muted)]">
          {language ?? t("language")}
        </span>
        <CopyButton read={() => ref.current?.textContent ?? ""} />
      </div>
      <pre
        ref={ref}
        className="overflow-x-auto p-2.5 font-mono text-xs leading-relaxed"
      >
        {children}
      </pre>
    </div>
  );
}

function textOf(node: unknown): string {
  const n = node as { value?: unknown; children?: unknown[] } | undefined;
  if (typeof n?.value === "string") return n.value;
  return Array.isArray(n?.children) ? n.children.map(textOf).join("") : "";
}

const StreamingContext = createContext(false);

function MermaidPre({
  source,
  children,
}: {
  source: string;
  children?: React.ReactNode;
}) {
  const streaming = useContext(StreamingContext);
  const code = <CodeBlock language="mermaid">{children}</CodeBlock>;
  if (streaming) return code;
  return (
    <MermaidBlock
      source={source}
      fallback={code}
      copyButton={<CopyButton read={() => source} />}
    />
  );
}

const COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-[var(--el-ink)] underline underline-offset-2"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-2 py-1 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-[var(--el-hairline)] px-2 py-1 align-top">
      {children}
    </td>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-[var(--el-surface-strong)] px-1 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    ),
  pre: ({ node, children }) =>
    languageOf(node) === "mermaid" ? (
      <MermaidPre source={textOf(node)}>{children}</MermaidPre>
    ) : (
      <CodeBlock language={languageOf(node)}>{children}</CodeBlock>
    ),
  ul: ({ children }) => (
    <ul className="my-3.5 list-disc space-y-1.5 pl-5 first:mt-0 last:mb-0 marker:text-[var(--el-muted)] [&_ol]:my-1.5 [&_ul]:my-1.5">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3.5 list-decimal space-y-1.5 pl-5 first:mt-0 last:mb-0 marker:text-[var(--el-muted)] [&_ol]:my-1.5 [&_ul]:my-1.5">
      {children}
    </ol>
  ),
  p: ({ children }) => (
    <p className="my-3.5 [text-wrap:pretty] first:mt-0 last:mb-0">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="mt-5 mb-2 text-[1.0625rem] leading-snug font-semibold text-[var(--el-ink)] first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 mb-1.5 text-[0.9375rem] leading-snug font-semibold text-[var(--el-ink)] first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-1 font-semibold text-[var(--el-body-strong)] first:mt-0">
      {children}
    </h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-[var(--el-hairline-strong)] pl-3 text-[var(--el-muted)]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-[var(--el-hairline)]" />,
  img: () => null,
};

const REMARK = [remarkGfm];

export function Markdown({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  return (
    // 체크박스 목록은 표식을 뗀다. `li:has(input)` 은 자손을 봐서 상위 `li` 의 불릿까지 떼므로
    // gfm 이 붙이는 `task-list-item` 을 짚는다.
    <div className="chat-md text-[14.5px] leading-[1.7] text-[var(--el-ink)] [overflow-wrap:anywhere] [&_.task-list-item]:list-none">
      <StreamingContext value={streaming}>
        <ReactMarkdown remarkPlugins={REMARK} components={COMPONENTS}>
          {content}
        </ReactMarkdown>
      </StreamingContext>
    </div>
  );
}
