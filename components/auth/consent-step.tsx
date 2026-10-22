"use client";

import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/auth/auth-provider";
import { ConsentCheckbox } from "@/components/auth/consent-checkbox";
import { Button } from "@/components/ui/button";
import { errorMessageOf } from "@/lib/api/error-message";

export type ConsentStepMode = "ask" | "retry";

/**
 * 로그인은 끝났지만 약관 동의가 아직 기록되지 않았을 때 `/auth/callback` 이 대시보드로 보내기 전에 세우는 화면
 * (APP-1277). 두 경우다.
 *
 * - `ask` — 로그인 창에서 체크한 표시가 없다(초대·외부 에이전트 로그인 링크, 표시가 만료됨). 같은 체크박스로 받는다.
 * - `retry` — 체크는 했는데 기록이 실패했다. 대시보드에 들어가기 전에 다시 시도한다.
 *
 * 동의하지 않을 사람은 로그아웃으로 나간다 — 동의는 필수라 철회는 탈퇴다(APP-1141).
 */
export function ConsentStep({
  mode,
  onSubmit,
}: {
  mode: ConsentStepMode;
  /** 기록하고 앱으로 들어간다. 실패하면 던진다 — 이 화면이 사유를 그대로 보인다. */
  onSubmit: () => Promise<void>;
}) {
  const t = useTranslations("auth.consent");
  const { logout, isLoggingOut } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = mode === "ask";

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await onSubmit();
      // 성공하면 곧 이동한다. 이동 전에 버튼이 되살아나 한 번 더 눌리지 않게 잠가 둔다.
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
          disabled={ask && !agreed}
          onClick={() => void submit()}
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
