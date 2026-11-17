"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { localePath } from "@/lib/i18n/locales";

export function FocusTopBar() {
  const t = useTranslations("shell.focusChrome");
  const { status, isLoggingOut, logout } = useAuth();

  return (
    <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
      <span className="inline-flex items-center gap-2.5">
        <Image
          src="/apple-touch-icon.png"
          alt=""
          width={32}
          height={32}
          className="rounded-full object-contain"
          priority
        />
        <span className="text-[18px] font-medium tracking-tight text-[var(--el-ink)]">
          {siteConfig.name}
        </span>
      </span>
      {status === "authenticated" ? (
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="px-3 text-sm text-[var(--el-muted)]"
          loading={isLoggingOut}
          onClick={() => void logout()}
        >
          <LogOut aria-hidden />
          {t("logout")}
        </Button>
      ) : null}
    </header>
  );
}

const LINK =
  "inline-flex min-h-6 items-center rounded-[4px] transition-colors hover:text-[var(--el-ink)] hover:underline";

export function FocusFooter() {
  const t = useTranslations("shell.focusChrome");
  const locale = useLocale();
  return (
    <footer className="flex items-center justify-center gap-2 px-4 pt-2 pb-6 text-sm text-[var(--el-muted)]">
      <Link href={localePath(locale, "/terms")} className={LINK}>
        {t("terms")}
      </Link>
      <span aria-hidden>·</span>
      <Link href={localePath(locale, "/privacy")} className={LINK}>
        {t("privacy")}
      </Link>
    </footer>
  );
}
