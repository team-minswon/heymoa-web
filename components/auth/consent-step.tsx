"use client";

import { useId, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/auth/auth-provider";
import { ConsentCheckbox } from "@/components/auth/consent-checkbox";
import { Button } from "@/components/ui/button";
import { errorMessageOf } from "@/lib/api/error-message";

export type ConsentStepMode = "ask" | "retry";

export function ConsentStep({
  mode,
  onSubmit,
}: {
  mode: ConsentStepMode;
  onSubmit: () => Promise<void>;
}) {
  const t = useTranslations("auth.consent");
  const { logout, isLoggingOut } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [nudge, setNudge] = useState(0);
  const hintId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = mode === "ask";
  const blocked = ask && !agreed;

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await onSubmit();
    } catch (cause) {
      setError(errorMessageOf(cause, t("step.failed")));
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-panel border border-[var(--el-hairline)] bg-white p-8 text-center shadow-[0_16px_48px_rgba(12,10,9,0.08)]">
      {ask ? (
        <ShieldCheck
          className="mx-auto mb-5 size-10 text-[var(--el-ink)]"
          aria-hidden
        />
      ) : (
        <AlertTriangle
          className="mx-auto mb-5 size-10 text-[var(--el-error)]"
          aria-hidden
        />
      )}
      <h1 className="text-3xl font-light tracking-[-0.025em] text-[var(--el-ink)]">
        {ask ? t("step.askTitle") : t("step.retryTitle")}
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--el-muted)]">
        {ask ? t("step.askDescription") : t("step.retryDescription")}
      </p>
      {ask && (
        <div className="mt-6">
          <ConsentCheckbox
            checked={agreed}
            onCheckedChange={setAgreed}
            hint={t("requiredToContinue")}
            hintId={hintId}
            nudge={nudge}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-[var(--el-error)]">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-col gap-3">
        <Button
          type="button"
          size="xl"
          className="w-full rounded-full"
          loading={pending}
          aria-disabled={blocked || undefined}
          aria-describedby={blocked ? hintId : undefined}
          onClick={() =>
            blocked ? setNudge((count) => count + 1) : void submit()
          }
        >
          {ask ? t("step.agree") : t("step.retry")}
        </Button>
        <Button
          type="button"
          size="xl"
          variant="outline"
          className="w-full rounded-full"
          loading={isLoggingOut}
          disabled={pending}
          onClick={() => void logout()}
        >
          {t("step.logout")}
        </Button>
      </div>
    </div>
  );
}
