"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { LoginForm } from "@/components/auth/auth-modal";
import { CenteredCard } from "@/components/layout/centered-card";

export function BrowserLoginLanding({ returnTo }: { returnTo: string }) {
  const t = useTranslations("auth.browser");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--el-canvas)] p-4">
      <CenteredCard
        icon={
          <Image
            src="/apple-touch-icon.png"
            alt="HeyMoa"
            width={40}
            height={40}
            className="rounded-full"
          />
        }
      >
        <h1 className="text-balance text-2xl font-light">{t("title")}</h1>
        <p className="mb-6 mt-3 text-sm leading-6 text-[var(--el-body)]">
          {t("continue")}
        </p>
        <LoginForm returnTo={returnTo} />
      </CenteredCard>
    </div>
  );
}
