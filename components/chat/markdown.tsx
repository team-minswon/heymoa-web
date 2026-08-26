"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 답변 본문 렌더.
 *
 * **스트리밍 중에는 언제나 부분 마크다운이다.** 닫히지 않은 코드펜스·링크·표가 오류가
 * 아니라 정상 입력이고, 다음 토큰이 닫아 준다. 파서에 완결성을 요구하면 매 토큰마다
 * 화면이 깨진다 — react-markdown은 미완결 구조를 그 시점의 최선으로 그린다.
 *
 * ### sanitize 정책
 *
 * - **원시 HTML을 렌더하지 않는다.** `rehype-raw`를 안 붙이면 기본이 그렇다.
 *   답변 본문은 모델이 쓴 글이고 모델은 도구 결과를 그대로 옮길 수 있다 — 회의 전사에
 *   `<script>`가 들어 있을 이유는 없지만, 없으리라고 믿는 것이 정책일 수는 없다.
 * - 링크는 `rel="noopener noreferrer"`에 새 탭. `javascript:`는 react-markdown 기본
 *   `urlTransform`이 떨어뜨린다.
 * - 이미지도 안 그린다. 답변에 원격 이미지가 실릴 경로가 없고, 열어 두면 URL만으로
 *   외부에 열람 사실이 새는 픽셀이 된다.
 */
/**
 * ```sql 의 `sql`. **hast 모양을 가정하지 않는다** — 스트리밍 중에는 아직 안 닫힌
 * 코드펜스가 정상 입력이라, 자식이 있으리라 믿고 뜯으면 그 순간 화면이 터진다.
 * 못 읽으면 `null` 이다. **언어를 지어내지 않는다** — 그때 머리줄이 세우는 것은 언어가
 * 아니라 「코드」라는 갈래 이름이다(아래 `CodeBlock`).
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
 * 코드블록. **머리줄에 언어와 복사가 선다.**
 *
 * 복사할 글은 `children` 이 아니라 **그려진 DOM** 에서 읽는다 — 흐르는 동안 children 은
 * 매 토큰 다른 모양이고, 그걸 문자열로 되짚는 코드는 반쯤 온 코드펜스에서 가장 먼저 깨진다.
 *
 * ★ **`textContent` 로 읽는다. `innerText` 가 아니다.** 둘은 여기서 같은 값을 낸다 —
 * `ref` 가 붙은 `pre` 안에는 코드밖에 없고 머리줄은 밖에 있다. 다른 것은 둘뿐인데 둘 다
 * `textContent` 편이다: `innerText` 는 읽을 때마다 레이아웃을 강제하고, **jsdom 에는
 * 아예 없다.** 없으면 `undefined` 라 조용히 빈 문자열이 복사되고, 「무엇을 복사했나」를
 * 재는 검사가 빈 문자열을 상대로 통과한다. 실제로 그랬다.
 *
 * 버튼은 `navigator.clipboard` 유무와 **상관없이 그린다.** 그 값으로 렌더를 가르면
 * 서버 HTML 과 첫 클라이언트 렌더가 갈려 hydration 이 어긋난다. 없을 때는 눌러도
 * 아무 일이 없다.
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
          // 눌린 뒤 「복사됨」으로 바뀌는 것이 보이는 글자인데, 고정 `aria-label` 이
          // 그 이름을 덮어써서 화면을 못 보는 사람에게는 아무 일도 안 일어난 것이 된다.
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
      {/* 긴 줄은 **자기 안에서** 가로 스크롤한다. 줄바꿈으로 접으면 들여쓰기가 뭉개진다. */}
      <pre
        ref={ref}
        className="overflow-x-auto p-2.5 font-mono text-xs leading-relaxed"
      >
        {children}
      </pre>
    </div>
  );
}

/**
 * **모듈 스코프에 둔다.** 컴포넌트 안에서 만들면 렌더마다 새 함수가 되고, React 는
 * 그것을 *다른 컴포넌트*로 보고 마크다운 전체를 다시 마운트한다. 토큰이 올 때마다
 * 그러면 이미 그려진 낱말까지 전부 다시 떠올라서, 문단이 통째로 깜빡이는 것처럼 보인다.
 */
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
  /**
   * ★ **제목 세 층이 실제로 세 층이다.** 셋 다 같은 굵은 글씨였어서, 답이 길어지면
   * 어디가 절이고 어디가 그 안인지가 안 보였다. 크기·색·위 여백을 층마다 벌린다 —
   * 본문이 14px 이므로 위로 두 칸(17·15)만 쓰고 h3 는 굵기와 색으로만 가른다.
   */
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
  // **일부러 안 그린다** — 미구현이 아니다. 이유는 이 파일 머리의 sanitize 정책에 있다:
  // 답변에 원격 이미지가 실릴 경로가 없고, 열어 두면 URL 하나로 열람 사실이 밖으로
  // 새는 픽셀이 된다. 판정 원장(결정.md)의 W-02 는 이미지에 대해 정한 것이 없다.
  img: () => null,
};

/** 플러그인 배열도 같은 이유로 고정한다 — 새 배열이면 processor 가 매번 다시 선다. */
const REMARK = [remarkGfm];

/**
 * ★ **낱말을 안 쪼갠다.** 한때 `rehype-word-fade` 가 흐르는 동안 낱말마다 `<span>` 을
 * 세워 각자 떠오르게 했다. 그것이 스르륵이 아니라 **번쩍**으로 읽혔고, DOM 도 문단
 * 하나에 span 수십 개로 무거웠다. ChatGPT 도 Claude 도 글자에는 아무것도 안 건다 —
 * 매끄러움은 `use-smooth-text` 가 토큰을 고르게 풀어 놓는 데서 온다.
 */
export function Markdown({ content }: { content: string }) {
  return (
    // ★ `break-words` 는 **긴 URL 때문이다.** 표와 코드블록은 각자 가로 스크롤로 막혀
    // 있지만 링크 글자는 안 막혀 있어서, 끊을 자리가 없는 주소 하나가 좁은 패널(본문
    // 열 약 398px) 밖으로 그대로 삐져나갔다.
    //
    // ★ 체크박스 목록은 불릿·번호를 뗀다 — gfm 이 `<input>` 을 넣는데 표식까지 서면 둘이다.
    // **`gfm` 이 그 `li` 에 붙여 주는 `task-list-item` 을 짚는다.** 한때 `li:has(input)`
    // 이었는데 `:has()` 가 **자손**을 보므로, 체크박스를 품은 위 단계 `li` 의 불릿까지
    // 같이 뗐다(「- 상위 / - [ ] 하위」에서 「상위」의 불릿이 사라졌다). 여기 한 줄이면
    // `ul` 과 `ol` 이 함께 걸린다 — 번호 목록 안의 체크박스도 같은 문제였다.
    <div className="chat-md text-sm leading-[1.65] break-words text-[var(--el-body)] [&_.task-list-item]:list-none">
      <ReactMarkdown remarkPlugins={REMARK} components={COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
