import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";

import { Panel } from "@/components/heymoa/primitives";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/lib/site";

export type LegalSection = {
  title: string;
  body: readonly string[];
};

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
    <div className="relative overflow-hidden px-4 pb-20 pt-32 sm:px-6 sm:pt-36 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-12 size-[28rem] rounded-full bg-[radial-gradient(circle,var(--el-gradient-mint)_0%,transparent_68%)] opacity-25 blur-3xl"
      />
      <div className="relative mx-auto max-w-6xl">
        <header className="overflow-hidden rounded-[28px] border border-[var(--el-hairline)] bg-white/80 px-6 py-10 shadow-[0_8px_32px_rgba(12,10,9,0.05)] backdrop-blur-sm sm:px-10 sm:py-14 lg:px-14">
          <Badge
            variant="secondary"
            className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
          >
            {label}
          </Badge>
          <h1 className="mt-6 max-w-3xl font-serif text-4xl font-light leading-[1.08] tracking-[-0.03em] text-[var(--el-ink)] sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[var(--el-body)] sm:text-base">
            {description}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[var(--el-hairline)] pt-5 text-xs text-[var(--el-muted)]">
            <span>{siteConfig.name}</span>
            <span>시행일 {effectiveDate}</span>
            <span>{sections.length}개 조항</span>
          </div>
        </header>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-5 lg:sticky lg:top-28">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--el-ink)]">
              <FileText className="size-4" />
              문서 목차
            </div>
            <nav aria-label={`${title} 목차`} className="mt-4">
              <ol className="space-y-1">
                {sections.map((section, index) => (
                  <li key={section.title}>
                    <a
                      href={`#section-${index + 1}`}
                      className="block rounded-lg px-2 py-2 text-xs leading-5 text-[var(--el-muted)] transition-colors hover:bg-white hover:text-[var(--el-ink)]"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <Panel className="p-6 sm:p-9 lg:p-12">
            <article className="space-y-10">
              {sections.map((section, index) => (
                <section
                  id={`section-${index + 1}`}
                  key={section.title}
                  className="scroll-mt-28"
                >
                  {index > 0 ? <Separator className="mb-10" /> : null}
                  <h2 className="font-serif text-2xl font-light tracking-[-0.015em] text-[var(--el-ink)] sm:text-[28px]">
                    {section.title}
                  </h2>
                  <div className="mt-5 space-y-3 text-sm leading-7 text-[var(--el-body)] sm:text-[15px]">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </article>
          </Panel>
        </div>

        <div className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-[var(--el-hairline)] bg-white px-6 py-5 text-sm sm:flex-row sm:items-center">
          <p className="text-[var(--el-muted)]">
            정책 관련 문의는 {siteConfig.contactEmail}로 보내주세요.
          </p>
          <Link
            href={relatedHref}
            className="inline-flex items-center gap-1.5 font-medium text-[var(--el-ink)] underline-offset-4 hover:underline"
          >
            {relatedLabel}
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
