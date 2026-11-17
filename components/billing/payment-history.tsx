"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PaymentStatusText } from "@/components/billing/subscription-management";
import { SETTINGS_LIST } from "@/components/settings/settings-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { billingEvents } from "@/lib/billing/analytics";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { cn } from "@/lib/utils";

type PaymentRow = {
  paymentId: string;
  completedAt: string | null;
  middle: string;
  amountKrw: number;
  status: Parameters<typeof PaymentStatusText>[0]["payment"]["status"];
  refundStatus: Parameters<
    typeof PaymentStatusText
  >[0]["payment"]["refundStatus"];
  openable: boolean;
  receiptUrl?: string | null;
  workspaceId?: string;
};

const PAYMENT_PAGE = 12;

const ROW =
  "grid min-h-[52px] w-full grid-cols-[132px_minmax(0,1fr)_88px_112px_56px_16px] items-center gap-3 px-4 py-2.5 text-left text-sm";
const RECEIPT_SLOT = "absolute top-1/2 right-[44px] w-14 -translate-y-1/2";
const SKELETON_ROWS = 3;

export function PaymentList<R extends PaymentRow>({
  rows,
  label,
  onOpen,
}: {
  rows: R[] | null;
  label: string;
  onOpen?: (row: R) => void;
}) {
  const t = useTranslations("billing.history");
  const format = useBillingFormat();
  const [expanded, setExpanded] = useState(false);
  const shown = rows && !expanded ? rows.slice(0, PAYMENT_PAGE) : rows;
  const hidden = rows ? rows.length - (shown?.length ?? 0) : 0;
  return (
    <div className={SETTINGS_LIST}>
      <ul aria-label={label} className="divide-y divide-[var(--el-hairline)]">
        {shown
          ? shown.map((payment) => {
              const date = payment.completedAt
                ? format.date(payment.completedAt)
                : t("noDate");
              const cells = (
                <>
                  <span className="whitespace-nowrap text-[var(--el-ink)]">
                    {date}
                  </span>
                  <span className="truncate text-[var(--el-muted)]">
                    {payment.middle}
                  </span>
                  <span className="text-right whitespace-nowrap text-[var(--el-ink)] tabular-nums">
                    {format.money(payment.amountKrw)}
                  </span>
                  <PaymentStatusText payment={payment} />
                  <span aria-hidden />
                </>
              );
              return (
                <li key={payment.paymentId} className="group relative">
                  {payment.openable && onOpen ? (
                    <button
                      type="button"
                      onClick={() => onOpen(payment)}
                      className={cn(
                        ROW,
                        "group-hover:bg-[var(--el-canvas-soft)]"
                      )}
                    >
                      {cells}
                      <span className="sr-only">{t("detail")}</span>
                      <ChevronRight
                        className="size-4 text-[var(--el-muted)]"
                        aria-hidden
                      />
                    </button>
                  ) : (
                    <div className={ROW}>{cells}</div>
                  )}
                  <ReceiptLink
                    url={payment.receiptUrl}
                    date={date}
                    workspaceId={payment.workspaceId}
                    className={RECEIPT_SLOT}
                  />
                </li>
              );
            })
          : Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li key={index} className={ROW}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="ml-auto h-4 w-14" />
                <Skeleton className="h-4 w-12" />
              </li>
            ))}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex min-h-[44px] w-full items-center justify-center text-sm text-[var(--el-muted)] hover:bg-[var(--el-canvas-soft)] hover:text-[var(--el-ink)]"
        >
          {t("more", { count: hidden })}
        </button>
      ) : null}
    </div>
  );
}

export function ReceiptLink({
  url,
  date,
  workspaceId,
  className,
}: {
  url: string | null | undefined;
  date: string;
  workspaceId?: string;
  className?: string;
}) {
  const t = useTranslations("billing.history");
  if (!url?.startsWith("https://")) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("receiptLabel", { date })}
      onClick={() => billingEvents.receiptClicked(workspaceId)}
      className={cn(
        "text-sm whitespace-nowrap text-[var(--el-muted)] underline underline-offset-2 hover:text-[var(--el-ink)]",
        className
      )}
    >
      {t("receipt")}
    </a>
  );
}
