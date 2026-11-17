"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { SitePageLink } from "@/components/heymoa/site-page-link";
import type { HelpPageId } from "@/app/[lang]/help/_content/ids";
import { helpPathById } from "@/app/[lang]/help/_content/path-by-id";
import { track } from "@/lib/analytics/track";
import { localePath } from "@/lib/i18n/locales";

export function HelpLink({
  topic,
  children,
}: {
  topic: HelpPageId;
  children?: ReactNode;
}) {
  const t = useTranslations("common.actions");
  const locale = useLocale();
  return (
    <SitePageLink
      href={localePath(locale, helpPathById(topic))}
      onClick={() => track("help_opened", { topic })}
      className="font-medium text-[var(--el-ink)] underline underline-offset-2 hover:text-[var(--el-body)]"
    >
      {children ?? t("learnMore")}
    </SitePageLink>
  );
}
