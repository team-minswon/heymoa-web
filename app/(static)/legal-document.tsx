import Link from "next/link";
import { ArrowUpRight, ChevronDown, FileText } from "lucide-react";

import {
  BODY,
  CARD_TITLE,
  CONTAINER,
  FOCUS,
  H2,
  LEAD,
  RADIUS,
  TV_VARS,
} from "@/components/heymoa/landing/tokens";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export type LegalSection = {
  title: string;
  body: readonly string[];
};

/** 문서 안 링크는 보라 진한 색이다(흰 면 8.8:1 · 연보라 면 7.9:1). */
const LINK = cn(
  "rounded-[4px] font-bold text-[var(--tv-brand-deep)] underline underline-offset-4 transition-colors hover:text-[var(--tv-brand)]",
  FOCUS
);

/**
 * 약관 · 개인정보의 공통 틀. **랜딩과 같은 면이다** — 상단 바 · 푸터도 랜딩 것이다(`isLandingChromeRoute`).
 * 그래서 랜딩의 `--tv-*`(`TV_VARS`)를 루트에 걸고 흰 바탕 위 라벤더 머리 판, 흰 본문 판, 연보라 목차로 짠다.
 * 예전 크림 · `--lp-*` 판은 랜딩이 흰 바탕 · 보라로 바뀐 뒤 같은 사이트의 다른 페이지처럼 읽혔다.
 * 머리 판은 목차 · 본문과 같은 기둥(`CONTAINER`)에 선다 — 히어로 무대 폭(`STAGE_WRAP`)으로 두면 바로 아래 붙은
 * 목차 카드와 가장자리가 390 에서 8px, 1024~1279 에서 24px 어긋나 실수처럼 보였다.
 *
 * lg 미만에서는 목차를 닫힌 `<details>` 로 둔다 — 펼친 목차(9~10줄)가 본문보다 앞서 390 첫 화면에 본문이 한
 * 줄도 안 보였다. lg 부터는 본문 옆에 펼친 sticky 카드다. 본문 문단은 `[overflow-wrap:anywhere]` 를 같이 건다 — 끊을 자리
 * 없는 URL(개인정보 5조 `tools.google.com/…`)이 320 에서 판 밖으로 넘쳤다. `keep-all` 과 같이 써도 한글
 * 낱말은 그대로 두고 넘치는 토큰만 끊는다. `break-words` 로 쓰면 `cn` 이 같은 묶음의 `break-keep` 을 지워서
 * 한글이 음절마다 갈렸다(「워 / 크스페이스」).
 *
 * **문서에는 스크롤 리빌 · 장식(쪽지 · 테이프 · 말풍선)을 안 둔다.** 랜딩은 훑어보는 자리지만 여기는 처음부터
 * 끝까지 읽는 글이다 — 읽는 동안 문단이 나타나거나 장식이 끼면 방해만 된다.
 *
 * 상단 바가 흐름 안의 sticky 64px 라 위 여백은 작다(옛 떠 있는 알약 때는 그 아래로 밀어야 해서 컸다). 대신 바가
 * 목차 → 조항 이동의 도착점을 가리지 않게 조항마다 `scroll-mt-20`(80px, 랜딩 구간과 같은 값)을 준다.
 */
export function LegalDocument({
  label,
  title,
  description,
  effectiveDate,
  sections,
  relatedHref,
  relatedLabel,
}: {
  label: string;
  title: string;
  description: string;
  effectiveDate: string;
  sections: readonly LegalSection[];
  relatedHref: string;
  relatedLabel: string;
}) {
  // 좁은 화면의 접는 목차와 넓은 화면의 sticky 카드가 같은 목록을 쓴다(한쪽은 늘 display:none).
  const toc = (
    <nav aria-label={`${title} 목차`}>
      <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
        {sections.map((section, index) => (
          <li key={section.title}>
            <a
              href={`#section-${index + 1}`}
              className={cn(
                "flex min-h-6 items-center rounded-[8px] px-2 py-1.5 text-[14px] leading-[1.5] break-keep text-[var(--tv-body)] underline-offset-4 transition-colors hover:bg-white hover:text-[var(--tv-brand-deep)] hover:underline",
                FOCUS
              )}
            >
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );

  return (
    <div style={TV_VARS} className="w-full flex-1 bg-white pb-6 text-[var(--tv-ink)] lg:pb-8">
      <div className={cn(CONTAINER, "pt-3 lg:pt-6")}>
        <header className={cn(RADIUS.face, "bg-[var(--tv-lav)] px-6 py-10 lg:px-12 lg:py-16")}>
          <p className="m-0 inline-flex h-7 items-center rounded-full bg-white px-3 text-[13px] font-extrabold leading-none tracking-[0.02em] text-[var(--tv-brand-deep)]">
            {label}
          </p>
          {/* 랜딩 섹션 제목(H2)과 같은 급이다. 히어로 급을 쓰면 문서 하나가 첫 화면처럼 군다. */}
          <h1 className={cn(H2, "mt-4 max-w-[820px]")}>{title}</h1>
          <p className={cn(LEAD, "mt-4 max-w-[640px]")}>{description}</p>
          <p className="m-0 mt-6 flex flex-wrap gap-x-5 gap-y-1 text-[14px] leading-[1.6] text-[var(--tv-muted)]">
            <span>
              시행일{" "}
              <b className="font-bold text-[var(--tv-ink)]">{effectiveDate}</b>
            </span>
            <span>{sections.length}개 조항</span>
          </p>
        </header>
      </div>

      <div
        className={cn(
          CONTAINER,
          "mt-8 grid items-start gap-6 lg:mt-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10"
        )}
      >
        {/* 목차는 연보라 카드, 본문은 흰 판 — 「옮겨 다니는 곳」과 「읽는 곳」이 갈린다. */}
        <details className="group rounded-[20px] bg-[var(--tv-lav-soft)] lg:hidden">
          <summary
            className={cn(
              "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[20px] px-5 py-3 text-[14px] font-extrabold text-[var(--tv-ink)] [&::-webkit-details-marker]:hidden",
              FOCUS
            )}
          >
            <FileText aria-hidden className="size-4 text-[var(--tv-muted)]" />
            문서 목차
            <span className="font-medium text-[var(--tv-muted)]">· {sections.length}개 조항</span>
            <ChevronDown
              aria-hidden
              className="ml-auto size-4 text-[var(--tv-muted)] transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="px-5 pb-5">{toc}</div>
        </details>
        <aside className="box-border hidden rounded-[20px] bg-[var(--tv-lav-soft)] p-5 lg:sticky lg:top-24 lg:block">
          <p className="m-0 flex items-center gap-2 text-[13px] font-extrabold tracking-[0.02em] text-[var(--tv-muted)]">
            <FileText aria-hidden className="size-4" />
            문서 목차
          </p>
          <div className="mt-3">{toc}</div>
        </aside>

        {/* 줄 길이를 지키려고 본문 판은 760 까지만 넓힌다(lg 안쪽 글줄 약 660px). */}
        <div className="min-w-0 max-w-[760px]">
          <article className="box-border rounded-[24px] border border-[var(--tv-rule)] bg-white p-6 sm:p-9 lg:p-12">
            {sections.map((section, index) => (
              <section
                id={`section-${index + 1}`}
                key={section.title}
                className={cn(
                  "scroll-mt-20",
                  index > 0 &&
                    "mt-9 border-t border-[var(--tv-rule)] pt-9 lg:mt-10 lg:pt-10"
                )}
              >
                <h2 className={CARD_TITLE}>{section.title}</h2>
                <div className="mt-3 flex flex-col gap-3 lg:mt-4">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className={cn(BODY, "[overflow-wrap:anywhere]")}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </article>

          <div className="mt-4 flex flex-col gap-3 rounded-[20px] bg-[var(--tv-lav-soft)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between lg:mt-6">
            <p className="m-0 break-words break-keep text-[15px] leading-[1.6] text-[var(--tv-body)]">
              정책 관련 문의는{" "}
              <a href={`mailto:${siteConfig.contactEmail}`} className={LINK}>
                {siteConfig.contactEmail}
              </a>
              로 보내 주세요.
            </p>
            <Link
              href={relatedHref}
              className={cn(LINK, "inline-flex min-h-6 shrink-0 items-center gap-1.5 text-[15px]")}
            >
              {relatedLabel}
              <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
