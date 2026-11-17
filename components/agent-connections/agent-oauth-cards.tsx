import Image from "next/image";
import { AlertTriangle, LogIn } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CenteredCard } from "@/components/layout/centered-card";
import { buildGoogleOAuthUrl } from "@/lib/auth/paths";
import { InAppLoginGate } from "@/components/auth/in-app-login-gate";

export const HEYMOA_MARK = (
  <Image
    src="/apple-touch-icon.png"
    alt="HeyMoa"
    width={44}
    height={44}
    className="rounded-full object-contain"
  />
);

export function AgentOAuthLoginCard({ returnTo }: { returnTo: string }) {
  const t = useTranslations("agents.login");
  const locale = useLocale();
  return (
    <CenteredCard icon={HEYMOA_MARK}>
      <h1 className="text-2xl font-light tracking-[-0.01em]">
        {t("title")}
      </h1>
      <p className="mt-2 text-base text-[var(--el-muted)]">
        {t("description")}
      </p>
      <InAppLoginGate returnTo={returnTo}>
        <a
          href={buildGoogleOAuthUrl(returnTo, locale)}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--el-ink)] px-7 py-3.5 text-base font-medium text-white"
        >
          <LogIn className="size-4" aria-hidden />
          {t("google")}
        </a>
      </InAppLoginGate>
    </CenteredCard>
  );
}

export function AgentOAuthEndCard({ message }: { message?: string }) {
  const t = useTranslations("agents.end");
  return (
    <CenteredCard icon={<AlertTriangle className="size-5" aria-hidden />}>
      <h1 className="text-2xl font-light tracking-[-0.01em]">
        {t("title")}
      </h1>
      <p className="mt-2 text-base text-[var(--el-muted)]">
        {message ?? t("reconnect")}
      </p>
    </CenteredCard>
  );
}
