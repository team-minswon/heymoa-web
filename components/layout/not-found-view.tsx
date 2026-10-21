import { SearchX } from "lucide-react";
import Link from "next/link";

import { messagesFor } from "@/i18n/messages";
import { localePath, type Locale } from "@/lib/i18n/locales";

/**
 * 404 본문. 세 곳(마케팅 `app/[lang]/not-found`, 제품 `app/(product)/not-found`, `app/global-not-found`)이
 * 같이 쓴다. 홈 링크는 그 언어의 랜딩(`/` 또는 `/en`)이다.
 *
 * `plainLink` — 전역 404 문서는 앱 라우터 트리 밖이라 `<Link>` 클라이언트 이동이 반쪽만 동작한다. 실측하면
 * 주소와 제목만 `/`로 바뀌고 본문은 404 그대로 남아서 사용자가 막다른 곳에 갇힌다. 거기서는 새 문서를 연다.
 */
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
