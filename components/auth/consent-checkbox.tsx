"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";

import { SitePageLink } from "@/components/heymoa/site-page-link";
import { Checkbox } from "@/components/ui/checkbox";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n/locales";

/**
 * 「개인정보 처리방침과 이용약관을 읽었으며 이에 동의합니다」(APP-1277). 로그인 창과 동의를 다시 받는 callback
 * 화면이 같은 것을 쓴다. 문서 이름은 각 문서로 가는 링크다. 체크하기 전에는 **다음 동작이 왜 막혀 있는지**
 * `hint` 를 옆에 보인다.
 */
export function ConsentCheckbox({
  checked,
  onCheckedChange,
  hint,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hint: string;
}) {
  const t = useTranslations("auth.consent");
  const locale = useLocale();
  const hintId = useId();
  const language = isLocale(locale) ? locale : DEFAULT_LOCALE;
  // 로그인 창을 닫지 않고 문서를 읽도록 브라우저에서는 새 탭으로 열린다(`SitePageLink`).
  const documentLink = (path: string) => {
    const DocumentLink = (chunks: React.ReactNode) => (
      <SitePageLink
        href={localePath(language, path)}
        className="underline underline-offset-2 hover:text-[var(--el-ink)]"
      >
        {chunks}
      </SitePageLink>
    );
    return DocumentLink;
  };

  return (
    <div className="text-left">
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-5 text-[var(--el-body)]">
        <Checkbox
          className="mt-0.5"
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-describedby={checked ? undefined : hintId}
        />
        <span>
          {t.rich("label", {
            privacy: documentLink("/privacy"),
            terms: documentLink("/terms"),
          })}
        </span>
      </label>
      {!checked && (
        <p
          id={hintId}
          className="mt-1.5 pl-[26px] text-xs text-[var(--el-body)]"
        >
          {hint}
        </p>
      )}
    </div>
  );
}
