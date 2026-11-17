"use client";

import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";

import { SitePageLink } from "@/components/heymoa/site-page-link";
import { Checkbox } from "@/components/ui/checkbox";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/lib/i18n/locales";

const ALERT_COLOR: Keyframe[] = [
  {
    borderColor: "var(--el-error)",
    boxShadow:
      "0 0 0 3px color-mix(in oklch, var(--el-error) 25%, transparent)",
  },
  {
    offset: 0.7,
    borderColor: "var(--el-error)",
    boxShadow:
      "0 0 0 3px color-mix(in oklch, var(--el-error) 25%, transparent)",
  },
  {
    borderColor: "var(--el-hairline-strong)",
    boxShadow: "0 0 0 0 transparent",
  },
];
const ALERT_SHAKE: Keyframe[] = [
  { ...ALERT_COLOR[0], transform: "translateX(0)" },
  { offset: 0.15, transform: "translateX(-3px)" },
  { offset: 0.3, transform: "translateX(3px)" },
  { offset: 0.45, transform: "translateX(-2px)" },
  { offset: 0.6, transform: "translateX(0)" },
  { ...ALERT_COLOR[1] },
  { ...ALERT_COLOR[2], transform: "translateX(0)" },
];

export function ConsentCheckbox({
  checked,
  onCheckedChange,
  hint,
  hintId,
  nudge,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hint: string;
  hintId: string;
  nudge: number;
}) {
  const t = useTranslations("auth.consent");
  const locale = useLocale();
  const box = useRef<HTMLElement>(null);
  const language = isLocale(locale) ? locale : DEFAULT_LOCALE;

  useEffect(() => {
    const element = box.current;
    if (!nudge || !element) return;
    element.focus();
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // jsdom 에는 Web Animations 가 없다.
    element.animate?.(reduce ? ALERT_COLOR : ALERT_SHAKE, { duration: 700 });
  }, [nudge]);

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
          ref={box}
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
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      )}
      <span role="status" className="sr-only">
        {nudge > 0 && !checked && <span key={nudge}>{hint}</span>}
      </span>
    </div>
  );
}
