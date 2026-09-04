import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";

import {
  CONTAINER,
  Eyebrow,
  SECTION_X,
} from "@/components/heymoa/landing/shell";
import { siteConfig } from "@/lib/site";

export type LegalSection = {
  title: string;
  body: readonly string[];
};

/**
 * 약관·개인정보의 공통 틀. **랜딩과 같은 면이다** — `DESIGN.md`가 「마케팅 면(랜딩·약관)」을
 * 한 묶음으로 정하므로, 크림 캔버스와 `--lp-*` 토큰을 그대로 쓴다. 예전에는 제품 면 토큰
 * (`--el-*`)에 그라데이션 오브와 유리 패널이었는데, 랜딩이 크림 편집 조판으로 옮겨간 뒤로는
 * 같은 사이트의 두 페이지가 서로 다른 제품처럼 보였다.
 *
 * **문서에는 스크롤 리빌을 안 건다.** 랜딩의 밴드는 훑어보는 자리라 하나씩 떠도 되지만,
 * 여기는 처음부터 끝까지 읽는 글이다 — 읽는 동안 문단이 나타나면 방해만 된다.
 *
 * 상단 여백이 큰 것은 상단바가 **떠 있는 알약**이라 그 아래로 내용을 밀어야 해서다
 * (랜딩 히어로와 같은 이유).
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
  return (
    <div className="landing-surface">
      <section className={`${SECTION_X} pt-28 pb-16 lg:pt-36 lg:pb-24`}>
        <div className={CONTAINER}>
          <header className="flex flex-col">
            <Eyebrow>{label}</Eyebrow>
            {/* 랜딩 섹션 제목과 같은 급이다. 히어로 급을 쓰면 문서 하나가 첫 화면처럼 군다. */}
            <h1 className="m-0 mt-3 max-w-[820px] text-balance break-keep text-[30px] font-extrabold leading-[1.26] tracking-[-1px] text-[var(--lp-ink)] lg:mt-3.5 lg:text-[46px] lg:leading-[1.2] lg:tracking-[-1.6px]">
              {title}
            </h1>
            <p className="m-0 mt-3.5 max-w-[640px] break-keep text-[16px] leading-[1.75] text-[var(--lp-body)] lg:mt-4">
              {description}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--lp-rule)] pt-5 text-[12.5px] text-[var(--lp-muted)] lg:mt-9">
              <span>{siteConfig.name}</span>
              <span>시행일 {effectiveDate}</span>
              <span>{sections.length}개 조항</span>
            </div>
          </header>

          <div className="mt-8 grid items-start gap-4 lg:mt-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6">
            {/* 목차는 크림 카드다 — 본문 흰 카드와 대비를 만들어 「읽는 곳」과 「옮겨 다니는
                곳」이 갈린다. */}
            <aside className="box-border rounded-[18px] border border-[var(--lp-rule)] bg-[var(--lp-cream)] p-5 lg:sticky lg:top-28">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--lp-ink)]">
                <FileText aria-hidden className="size-4 text-[var(--lp-body)]" />
                문서 목차
              </div>
              <nav aria-label={`${title} 목차`} className="mt-4">
                <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {sections.map((section, index) => (
                    <li key={section.title}>
                      <a
                        href={`#section-${index + 1}`}
                        className="flex min-h-6 items-center rounded-lg px-2 py-1.5 text-[12.5px] leading-[1.5] text-[var(--lp-muted)] transition-colors hover:bg-[var(--lp-card)] hover:text-[var(--lp-ink)]"
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>

            <div className="box-border rounded-[18px] border border-[var(--lp-rule)] bg-[var(--lp-card)] p-6 shadow-[0_2px_8px_#33231a12] sm:p-9 lg:rounded-[24px] lg:p-12">
              <article className="flex flex-col gap-9 lg:gap-10">
                {sections.map((section, index) => (
                  <section
                    id={`section-${index + 1}`}
                    key={section.title}
                    className="scroll-mt-28"
                  >
                    {index > 0 ? (
                      <span
                        aria-hidden
                        className="mb-9 block h-px w-full bg-[var(--lp-rule-soft)] lg:mb-10"
                      />
                    ) : null}
                    {/* 세리프는 랜딩의 요약 절 머리와 같은 결이다(편집 조판). */}
                    <h2 className="m-0 break-keep font-serif text-[21px] font-light tracking-[-0.025em] text-[var(--lp-ink)] lg:text-[26px]">
                      {section.title}
                    </h2>
                    <div className="mt-4 flex flex-col gap-3 lg:mt-5">
                      {section.body.map((paragraph) => (
                        <p
                          key={paragraph}
                          className="m-0 break-keep text-[14.5px] leading-[1.85] text-[var(--lp-body)] lg:text-[15px]"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </article>
            </div>
          </div>

          <div className="mt-4 flex flex-col justify-between gap-3 rounded-[18px] border border-[var(--lp-rule)] bg-[var(--lp-cream)] px-6 py-5 lg:mt-6 lg:flex-row lg:items-center">
            <p className="m-0 text-[14px] text-[var(--lp-muted)]">
              정책 관련 문의는 {siteConfig.contactEmail}로 보내주세요.
            </p>
            <Link
              href={relatedHref}
              className="inline-flex min-h-6 items-center gap-1.5 text-[14px] font-medium text-[var(--lp-ink)] underline-offset-4 hover:underline"
            >
              {relatedLabel}
              <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
