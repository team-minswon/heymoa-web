"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useRetryBillingPayment } from "@/lib/api/generated/billing/billing";
import type {
  WorkspaceBillingResponseDataDetail,
  WorkspaceBillingResponseDataProductTestPaymentNotice,
} from "@/lib/api/generated/models";
import { errorCodeOf } from "@/lib/api/error-message";
import { billingEvents } from "@/lib/billing/analytics";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { createRequestKey } from "@/lib/billing/request-key";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { cn } from "@/lib/utils";

/** 화면 안의 상태 한 덩어리. 사라지면 안 되는 안내라 토스트가 아니라 자리에 둔다(rule `error-loading`). */
export function BillingNotice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warn";
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "warn" ? "alert" : "status"}
      className={cn(
        "rounded-panel border p-4 text-sm leading-6",
        tone === "warn"
          ? "border-[var(--el-hairline-strong)] bg-[var(--el-surface-strong)]"
          : "border-[var(--el-hairline)] bg-white",
        className
      )}
    >
      {title ? (
        <p className="font-medium text-[var(--el-ink)]">{title}</p>
      ) : null}
      {children ? (
        <div className="text-[var(--el-muted)]">{children}</div>
      ) : null}
    </div>
  );
}

/** 시험 결제 안내. 서버 값이 문구를 정하고, 값이 없으면(실결제) 아무것도 그리지 않는다. */
export function TestPaymentNotice({
  notice,
}: {
  notice: WorkspaceBillingResponseDataProductTestPaymentNotice | undefined;
}) {
  const t = useTranslations("billing.testNotice");
  if (!notice) return null;
  return <BillingNotice>{t(notice)}</BillingNotice>;
}

type Detail = NonNullable<WorkspaceBillingResponseDataDetail>;

/** 「다시 결제」가 열려 있는가 — 확정 거절된 열린 회차가 있고 결제 수단의 결제자가 나일 때만이다. */
export function canRetryPayment(detail: WorkspaceBillingResponseDataDetail) {
  return Boolean(
    detail &&
    detail.openCycleId &&
    detail.methodVersion != null &&
    detail.latestAttempt?.status === "FAILED" &&
    detail.methodPayerIsMe
  );
}

/**
 * 확정 거절 뒤 「{금액} 다시 결제」. 금액은 서버 값이다. requestKey 는 이 버튼이 보는 실패 시도 하나에 하나다 — 네트워크 실패
 * 뒤 다시 눌러도 같은 키가 나가고, 성공하거나 화면이 본 상태가 바뀌었다고(409) 하면 새 키를 쓴다.
 * 409 둘(`BILLING_STATE_CHANGED`·`BILLING_IN_PROGRESS`)은 지속 상태라 토스트가 아니라 인라인으로 그린다.
 */
export function RetryPaymentButton({
  workspaceId,
  detail,
  amountKrw,
  pastDue = false,
  onRetried,
}: {
  workspaceId: string;
  detail: Detail;
  amountKrw: number;
  /** 갱신 실패(미납)면 「미납 결제」 — 첫 구매 실패의 「다시 결제」와 문구를 가른다. */
  pastDue?: boolean;
  onRetried?: () => void;
}) {
  const t = useTranslations("billing.retry");
  const format = useBillingFormat();
  const queryClient = useQueryClient();
  const key = useRef(createRequestKey()).current;
  const [notice, setNotice] = useState<"changed" | "inProgress" | null>(null);
  const retry = useRetryBillingPayment({
    mutation: {
      meta: {
        suppressErrorToast: ["BILLING_STATE_CHANGED", "BILLING_IN_PROGRESS"],
      },
    },
  });

  const run = async () => {
    setNotice(null);
    billingEvents.retryClicked({
      workspace_id: workspaceId,
      result: "declined",
    });
    try {
      await retry.mutateAsync({
        workspaceId,
        cycleId: detail.openCycleId!,
        data: {
          requestKey: key.current(),
          expectedFailedAttemptId: detail.latestAttempt!.attemptId,
          expectedVersion: detail.subscriptionVersion,
          methodVersion: detail.methodVersion!,
        },
      });
      key.renew();
      await invalidateWorkspaceBilling(queryClient, workspaceId);
      onRetried?.();
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === "BILLING_STATE_CHANGED" || code === "BILLING_IN_PROGRESS") {
        key.renew();
        setNotice(code === "BILLING_IN_PROGRESS" ? "inProgress" : "changed");
        await invalidateWorkspaceBilling(queryClient, workspaceId);
      } else if (code === "REQUEST_KEY_CONFLICT") {
        key.renew();
      }
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button onClick={run} loading={retry.isPending}>
        {t(pastDue ? "pastDueButton" : "button", {
          amount: format.money(amountKrw),
        })}
      </Button>
      {notice ? (
        <p role="alert" className="text-sm text-[var(--el-muted)]">
          {t(notice)}
        </p>
      ) : null}
    </div>
  );
}
