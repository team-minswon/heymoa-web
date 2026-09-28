"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/*
 * 답변 본문 렌더. 스트리밍 중에는 닫히지 않은 코드펜스·링크·표가 정상 입력이다.
 *
 * - 원시 HTML 은 안 그린다(`rehype-raw` 를 안 붙인다). 모델은 도구 결과를 그대로 옮길 수 있다.
 * - 링크는 새 탭에 `noopener noreferrer`. `javascript:` 는 기본 `urlTransform` 이 떨군다.
 * - 이미지는 안 그린다. URL 만으로 열람 사실이 밖으로 새는 픽셀이 된다.
 */

/**
 * ```sql 의 `sql`. 안 닫힌 코드펜스도 정상 입력이라 hast 모양을 가정하지 않는다. 못 읽으면
 * 언어를 지어내지 않고 `null` 을 낸다.
 */
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

/**
 * 코드블록. 머리줄에 언어와 복사가 선다.
 *
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
  const [copied, setCopied] = useState(false);

  return (
    <div className="my-2 overflow-hidden rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--el-hairline)] px-2.5 py-1">
        <span className="truncate font-mono text-[11px] text-[var(--el-muted)]">
          {language ?? "코드"}
        </span>
        <button
          type="button"
          // 고정 `aria-label` 이면 「복사됨」으로 바뀐 글자를 덮어 화면 낭독기에는 변화가 없다.
          aria-label={copied ? "코드 복사됨" : "코드 복사"}
          className="inline-flex shrink-0 items-center gap-1 rounded-control px-1.5 py-0.5 text-[11px] text-[var(--el-muted)] hover:text-[var(--el-ink)]"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                ref.current?.textContent ?? ""
              );
            } catch {
              // 클립보드가 없거나 권한이 없다. 「복사됨」이라고 거짓말하지 않는다.
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
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      {/* 긴 줄은 자기 안에서 가로 스크롤한다. 접으면 들여쓰기가 뭉개진다. */}
      <pre
        ref={ref}
        className="overflow-x-auto p-2.5 font-mono text-xs leading-relaxed"
      >
        {children}
      </pre>
    </div>
  );
}

// 모듈 스코프에 둔다. 렌더마다 새 함수면 React 가 다른 컴포넌트로 보고 토큰마다 마크다운
// 전체를 다시 마운트한다.
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
  // 표는 좁은 레일에서 넘친다. 페이지 전체가 가로로 밀리지 않게 자기 안에서 스크롤한다.
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
  pre: ({ node, children }) => (
    <CodeBlock language={languageOf(node)}>{children}</CodeBlock>
  ),
  ul: ({ children }) => (
    <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>
  ),
  p: ({ children }) => (
    <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>
  ),
  // 본문이 14px 이라 h1·h2 는 17·15px, h3 는 굵기와 색으로만 가른다.
  h1: ({ children }) => (
    <h1 className="mt-4 mb-1.5 text-[1.0625rem] leading-snug font-semibold text-[var(--el-ink)] first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3.5 mb-1 text-[0.9375rem] leading-snug font-semibold text-[var(--el-ink)] first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-3 mb-0.5 font-semibold text-[var(--el-body-strong)] first:mt-0">
      {children}
    </h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-[var(--el-hairline-strong)] pl-3 text-[var(--el-muted)]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-[var(--el-hairline)]" />,
  // 일부러 안 그린다. 파일 머리의 sanitize 정책을 본다.
  img: () => null,
};

/** 같은 이유로 고정한다. 새 배열이면 processor 가 매번 다시 선다. */
const REMARK = [remarkGfm];

/** 낱말마다 span 을 세우지 않는다. 매끄러움은 `use-smooth-text` 가 토큰을 고르게 푸는 데서 온다. */
export function Markdown({ content }: { content: string }) {
  return (
    // `break-words` 는 긴 URL 이 좁은 패널 밖으로 삐져나가지 않게 한다.
    // 체크박스 목록은 표식을 뗀다. `li:has(input)` 은 자손을 봐서 상위 `li` 의 불릿까지 떼므로
    // gfm 이 붙이는 `task-list-item` 을 짚는다.
    <div className="chat-md text-sm leading-[1.65] break-words text-[var(--el-body)] [&_.task-list-item]:list-none">
      <ReactMarkdown remarkPlugins={REMARK} components={COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
