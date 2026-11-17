import { useTranslations } from "next-intl";

import { HEYMOA_MARK } from "@/components/agent-connections/agent-oauth-cards";
import { LoginForm } from "@/components/auth/auth-modal";
import { CenteredCard } from "@/components/layout/centered-card";

export function WorkspaceLoginCard({
  description,
}: {
  description?: string;
} = {}) {
  const t = useTranslations("workspace.loginCard");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--el-canvas)] p-4 text-[var(--el-ink)]">
      <CenteredCard icon={HEYMOA_MARK}>
        <h1 className="text-2xl font-light tracking-[-0.01em] text-balance">
          {t("title")}
        </h1>
        <p className="mt-2 text-base text-[var(--el-muted)]">
          {description ?? t("description")}
        </p>
        <div className="mx-auto mt-6 w-full max-w-sm">
          <LoginForm />
        </div>
      </CenteredCard>
    </div>
  );
}
