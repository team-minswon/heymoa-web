"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { WorkspaceBillingResponseDataProductTestPaymentNotice } from "@/lib/api/generated/models";
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
