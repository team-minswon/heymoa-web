"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import {
  FeedbackDialog,
  type FeedbackReference,
} from "@/components/workspace/feedback-dialog";
import type { WorkspaceBillingResponseDataProductTestPaymentNotice } from "@/lib/api/generated/models";
import { cn } from "@/lib/utils";

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

export function TestPaymentNotice({
  notice,
}: {
  notice: WorkspaceBillingResponseDataProductTestPaymentNotice | undefined;
}) {
  const t = useTranslations("billing.testNotice");
  if (!notice) return null;
  return <BillingNotice>{t(notice)}</BillingNotice>;
}

export function FeedbackLink({
  reference,
  children,
}: {
  reference: FeedbackReference;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="underline underline-offset-2 hover:text-[var(--el-ink)]"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <FeedbackDialog
        open={open}
        onOpenChange={setOpen}
        reference={reference}
      />
    </>
  );
}
