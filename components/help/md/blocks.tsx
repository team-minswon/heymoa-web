import Link from "next/link";
import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Check,
  Info,
  Lightbulb,
  Minus,
  OctagonAlert,
  TriangleAlert,
  X,
} from "lucide-react";

import { LINK } from "@/app/[lang]/legal-document";
import type { HelpPageId } from "@/app/[lang]/help/_content/ids";
import { helpPathById } from "@/app/[lang]/help/_content/path-by-id";
import { HelpClip } from "@/components/help/help-clip";
import { HelpFigure } from "@/components/help/help-figure";
import { HelpCodeBlock, HelpTabsView } from "@/components/help/md/client";
import { CALLOUT_TONES, PROBLEM_LABELS } from "@/components/help/md/labels";
import { messagesFor } from "@/i18n/messages";
import { textOf } from "@/lib/help/text";
import { localePath, type Locale } from "@/lib/i18n/locales";
import { isMarketingPath } from "@/lib/i18n/marketing-routes";
import { cn } from "@/lib/utils";

/*
 * 가이드 마크다운이 그려지는 모양. 문법표는 `content/help/README.md`. 색은 가이드의 `--tv-*` 토큰만 쓴다(새 색 없음).
 * 서버 컴포넌트라 본문은 스크립트 없이도 있다 — 탭만 하이드레이션 뒤에 접힌다(`client.tsx`).
 */

type El = ReactElement<{ children?: ReactNode } & Record<string, unknown>>;

/** `help:slug#앵커` → 그 언어의 가이드 안 주소 */
export function resolveHelpHref(href: string, locale: Locale = "ko") {
  const [id, hash] = href.slice("help:".length).split("#");
  return `${localePath(locale, helpPathById(id as HelpPageId))}${hash ? `#${hash}` : ""}`;
}

/** 사이트 안 주소(`/privacy#x`)를 그 언어판으로. 언어판이 없는 제품 면(`/w/...`)은 그대로 둔다. */
function localSiteHref(href: string, locale: Locale) {
  const at = href.search(/[?#]/);
  const path = at === -1 ? href : href.slice(0, at);
  return isMarketingPath(path)
    ? localePath(locale, path) + (at === -1 ? "" : href.slice(at))
    : href;
}

export function MdLink({
  href = "",
  children,
  locale = "ko",
}: ComponentProps<"a"> & { locale?: Locale }) {
  if (href.startsWith("help:") || href.startsWith("/")) {
    return (
      <Link
        href={
          href.startsWith("help:")
            ? resolveHelpHref(href, locale)
            : localSiteHref(href, locale)
        }
        className={LINK}
      >
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {children}
    </a>
  );
}

const CALLOUT = {
  note: { Icon: Info, line: "var(--tv-rule-strong)" },
  tip: { Icon: Lightbulb, line: "var(--tv-brand)" },
  caution: { Icon: TriangleAlert, line: "var(--tv-pop)" },
  irreversible: { Icon: OctagonAlert, line: "var(--el-warning-strong)" },
} as const;

export function HelpCallout({
  kind = "참고",
  children,
}: {
  kind?: string;
  children?: ReactNode;
}) {
  // 이름표는 본문 언어로 적힌 종류 낱말 그대로다(`labels.ts`)
  const { Icon, line } =
    CALLOUT[Object.hasOwn(CALLOUT_TONES, kind) ? CALLOUT_TONES[kind] : "note"];
  return (
    <aside
      role="note"
      style={{ borderLeftColor: line }}
      className="flex gap-3 rounded-[12px] border border-l-4 border-[var(--tv-rule)] bg-[var(--tv-lav-soft)] px-4 py-3"
    >
      <Icon aria-hidden className="mt-1 size-4 shrink-0 text-[var(--tv-ink)]" />
      <div className="flex min-w-0 flex-col gap-1.5 [&_p]:m-0">
        <strong className="text-[var(--tv-ink)]">{kind}</strong>
        {children}
      </div>
    </aside>
  );
}

export const STEPS_CLASS = cn(
  "m-0 flex list-none flex-col p-0 [counter-reset:step]",
  "[&>li]:relative [&>li]:min-h-8 [&>li]:pb-5 [&>li]:pl-11 [&>li]:[counter-increment:step] [&>li:last-child]:pb-0",
  "[&>li]:before:absolute [&>li]:before:top-0 [&>li]:before:left-0 [&>li]:before:grid [&>li]:before:size-7 [&>li]:before:place-items-center [&>li]:before:rounded-full",
  "[&>li]:before:bg-[var(--tv-brand-deep)] [&>li]:before:text-[13px] [&>li]:before:font-extrabold [&>li]:before:text-white [&>li]:before:content-[counter(step)]",
  "[&>li:not(:last-child)]:after:absolute [&>li:not(:last-child)]:after:top-8 [&>li:not(:last-child)]:after:bottom-1 [&>li:not(:last-child)]:after:left-[13.5px] [&>li:not(:last-child)]:after:w-px [&>li:not(:last-child)]:after:bg-[var(--tv-rule-strong)] [&>li:not(:last-child)]:after:content-['']",
  "[&>li>strong:first-child]:block [&>li>strong:first-child]:text-[var(--tv-ink)] [&>li>p:first-child>strong:first-child]:block [&>li>p:first-child>strong:first-child]:text-[var(--tv-ink)] [&>li>p]:m-0 [&>li>p+p]:mt-1.5"
);

/** 번호 목록은 모두 단계 카드다: 번호 원 + 굵은 제목 + 설명, 세로 연결선. */
export const MdSteps = ({ children }: { children?: ReactNode }) => (
  <ol className={STEPS_CLASS}>{children}</ol>
);

/** 줄무늬 표. */
export function MdTable({ children }: { children?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[var(--tv-rule)]">
      <table className="m-0 w-full table-fixed border-collapse text-[14px] leading-[1.6] [&_td]:border-t [&_td]:border-[var(--tv-rule)] [&_td]:p-3 [&_td]:align-top [&_tbody_tr:nth-child(even)]:bg-[var(--tv-lav-soft)] [&_th]:bg-[var(--tv-lav)] [&_th]:p-3 [&_th]:text-left [&_th]:font-bold [&_th]:text-[var(--tv-ink)]">
        {children}
      </table>
    </div>
  );
}

const MARKS: Record<
  string,
  { Icon: typeof Check; label: "yes" | "no" | "none"; tone: string }
> = {
  "✓": {
    Icon: Check,
    label: "yes",
    tone: "bg-[var(--tv-lav)] text-[var(--tv-brand-deep)]",
  },
  "✗": {
    Icon: X,
    label: "no",
    tone: "bg-[var(--tv-lav-soft)] text-[var(--tv-muted)]",
  },
  "–": {
    Icon: Minus,
    label: "none",
    tone: "bg-[var(--tv-lav-soft)] text-[var(--tv-muted)]",
  },
};

/** ✓ ✗ – 만 든 칸은 아이콘 칩이 된다(스크린 리더에는 가능 · 불가 · 해당 없음을 그 언어로). */
export function MdCell({
  children,
  node: _node,
  locale = "ko",
  ...rest
}: ComponentProps<"td"> & { node?: unknown; locale?: Locale }) {
  void _node;
  const only = Children.toArray(children).map(String).join("").trim();
  const found = Object.hasOwn(MARKS, only) ? MARKS[only] : undefined;
  return (
    <td {...rest}>
      {found ? (
        <span
          className={cn(
            "inline-grid size-6 place-items-center rounded-full",
            found.tone
          )}
        >
          <found.Icon aria-hidden className="size-3.5" />
          <span className="sr-only">
            {messagesFor(locale).help.md[found.label]}
          </span>
        </span>
      ) : (
        children
      )}
    </td>
  );
}

export function HelpBadge({ children }: { children?: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex h-5 items-center rounded-full bg-[var(--tv-lav)] px-2 align-middle text-[12px] font-bold text-[var(--tv-brand-deep)]">
      {children}
    </span>
  );
}

/** 인라인 코드. `kbd:⌘K` 는 키캡이 된다. */
export function MdInlineCode({ children, className }: ComponentProps<"code">) {
  const text = typeof children === "string" ? children : "";
  if (text.startsWith("kbd:")) {
    return (
      <kbd className="rounded-[6px] border border-b-2 border-[var(--tv-rule-strong)] bg-white px-1.5 py-0.5 font-sans text-[0.9em] font-bold text-[var(--tv-ink)]">
        {text.slice(4)}
      </kbd>
    );
  }
  return (
    <code
      className={cn(
        "rounded-[6px] bg-[var(--tv-lav-soft)] px-1.5 py-0.5 font-mono text-[0.92em] text-[var(--tv-ink)]",
        className
      )}
    >
      {children}
    </code>
  );
}

type HastLike = { children?: { tagName?: string; value?: string; children?: HastLike["children"] }[] };

/** 코드 블록(복사 버튼) */
export function MdPre({ node }: { node?: HastLike }) {
  const text = node?.children?.[0]?.children?.[0]?.value ?? "";
  return <HelpCodeBlock text={text.replace(/\n$/, "")} />;
}

/** 문단 안에 이미지 하나뿐이면 `<p>` 를 벗긴다(그림은 블록이라 `<p>` 안에 둘 수 없다). */
export function MdParagraph({
  node,
  children,
}: {
  node?: HastLike;
  children?: ReactNode;
}) {
  const only =
    node?.children?.length === 1 && node.children[0].tagName === "img";
  return only ? <>{children}</> : <p>{children}</p>;
}

/** `![설명](img:주제/파일.webp "캡션")` */
export function MdImage({ src = "", alt = "", title }: ComponentProps<"img">) {
  const path = typeof src === "string" ? src.replace(/^img:/, "") : "";
  return (
    <HelpFigure
      src={path as ComponentProps<typeof HelpFigure>["src"]}
      alt={alt}
      caption={title}
    />
  );
}

/** `::clip{name="…" alt="…" caption="…"}` */
export function MdClip({ name, alt, caption }: Record<string, string>) {
  return (
    <HelpClip
      name={name as ComponentProps<typeof HelpClip>["name"]}
      alt={alt}
      caption={caption}
    />
  );
}

/** 탭 하나. 제목과 내용은 `HelpTabs` 가 읽어 간다. */
export function HelpTab({ children }: { title?: string; children?: ReactNode }) {
  return <>{children}</>;
}

export function HelpTabs({ children }: { children?: ReactNode }) {
  const tabs = Children.toArray(children).filter(isValidElement) as El[];
  return (
    <HelpTabsView
      titles={tabs.map((tab) => String(tab.props.title ?? ""))}
      panels={tabs.map((tab, i) => (
        <div key={i} className="flex flex-col gap-3">
          {tab.props.children}
        </div>
      ))}
    />
  );
}

/**
 * 증상 / 원인 / 해결 방법 3칸. 안쪽은 `**증상:** …` `**원인:** …` `**해결 방법:** …` 문단이고,
 * 해결 방법 뒤에는 목록이 이어질 수 있다.
 */
export function HelpProblem({ children }: { children?: ReactNode }) {
  const rows: { label: string; inline: ReactNode[]; extra: ReactNode[] }[] = [];
  const isLabel = (label: string) => Object.hasOwn(PROBLEM_LABELS, label);
  const labelOf = (node: ReactNode) =>
    isValidElement(node) && node.type === "strong"
      ? textOf(node).replace(/[:：]\s*$/, "")
      : "";
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    const el = child as El;
    const kids = Children.toArray(el.props.children);
    const isLine = el.type === "p" || el.type === MdParagraph;
    if (isLine && !isLabel(labelOf(kids[0])) && rows.length > 0) {
      rows[rows.length - 1].extra.push(el); // 라벨 없는 다음 문단은 앞 칸에 이어 붙인다
    } else if (isLine) {
      // 세 줄이 한 문단으로 이어져 있다: 굵은 라벨이 나올 때마다 새 칸
      for (const kid of kids) {
        const label = labelOf(kid);
        if (isLabel(label)) rows.push({ label, inline: [], extra: [] });
        else if (rows.length > 0) rows[rows.length - 1].inline.push(kid);
      }
    } else if (rows.length > 0) {
      rows[rows.length - 1].extra.push(el);
    }
  }
  const trim = (nodes: ReactNode[]) =>
    nodes.map((n, i) =>
      typeof n === "string" ? (i === 0 ? n.trimStart() : n).replace(/\n$/, "") : n
    );
  return (
    <dl className="m-0 grid grid-cols-[minmax(72px,max-content)_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-[14px] border border-[var(--tv-rule)] px-4 py-3">
      {rows.map(({ label, inline, extra }) => (
        <div key={label} className="contents">
          <dt className="m-0 font-bold text-[var(--tv-ink)]">{label}</dt>
          <dd
            className={cn(
              "m-0 flex min-w-0 flex-col gap-1.5 [&_p]:m-0 [&_ul]:m-0 [&_ul]:pl-5",
              PROBLEM_LABELS[label] === "symptom" && "font-bold text-[var(--tv-ink)]"
            )}
          >
            <p>{trim(inline)}</p>
            {extra}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 점 목록. 안쪽 문단은 붙여서 그린다. */
export const MdList = ({ children }: { children?: ReactNode }) => (
  <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 [&_p]:m-0">
    {children}
  </ul>
);

export const MdH3 = ({ children }: { children?: ReactNode }) => (
  <h3 className="m-0 mt-2 text-[17px] leading-[1.4] font-extrabold text-[var(--tv-ink)]">
    {children}
  </h3>
);

/** 관련 페이지 섹션의 목록: 링크 카드 묶음 */
export const RelatedList = ({ children }: { children?: ReactNode }) => (
  <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
    {children}
  </ul>
);
export const RelatedItem = ({ children }: { children?: ReactNode }) => (
  <li className="rounded-[14px] border border-[var(--tv-rule)] p-4 text-[14px] leading-[1.6] text-[var(--tv-muted)] [&_a]:block [&_a]:text-[16px] [&_a]:font-extrabold">
    {children}
  </li>
);
