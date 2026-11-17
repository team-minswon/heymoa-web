import { SearchX } from "lucide-react";
import Link from "next/link";

import { messagesFor } from "@/i18n/messages";
import { localePath, type Locale } from "@/lib/i18n/locales";

export function NotFoundView({
  locale,
  plainLink = false,
}: {
  locale: Locale;
  plainLink?: boolean;
}) {
  const text = messagesFor(locale).common.notFound;
  const homeClass =
    "mt-7 rounded-full bg-[var(--el-primary)] px-5 py-2.5 text-sm font-medium text-white";
  const home = localePath(locale, "/");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--el-canvas)] p-4 text-center">
      <SearchX className="mb-5 size-10 text-[var(--el-muted)]" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--el-muted)]">
        {text.label}
      </p>
      <h1 className="mt-3 text-3xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
        {text.title}
      </h1>
      <p className="mt-3 text-sm text-[var(--el-muted)]">{text.description}</p>
      {plainLink ? (
        <a href={home} className={homeClass}>
          {text.home}
        </a>
      ) : (
        <Link href={home} className={homeClass}>
          {text.home}
        </Link>
      )}
    </div>
  );
}
