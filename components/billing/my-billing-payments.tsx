"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { PaymentStatusText } from "@/components/billing/subscription-management";
import { SettingsHeader } from "@/components/settings/settings-layout";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetMyBillingPaymentsSuspense } from "@/lib/api/generated/billing/billing";
import type { MyBillingPaymentsResponseDataPaymentsItem } from "@/lib/api/generated/models";
import { okData } from "@/lib/api/ok-data";
import { billingEvents } from "@/lib/billing/analytics";
import { useBillingFormat } from "@/lib/billing/use-billing-format";

/**
 * 설정 › 내 계정 › 결제 내역(APP-1565). 내가 결제자인 결제만, 최신순이다(서버가 정렬한다). 나갔거나 지운 공간의 결제도
 * 결제 때의 공간 이름(스냅샷)으로 보인다. 목록이 공간을 가로질러 공간 결제 상세로 잇지 않는다 — 그 화면은 지금 그 공간의 ADMIN 만 연다.
 */
export function MyBillingPayments() {
  const t = useTranslations("billing.history");
  useEffect(() => {
    billingEvents.paymentHistoryViewed();
  }, []);
  return (
    <div>
      <SettingsHeader title={t("title")} description={t("description")} />
      <DataBoundary
        resetKeys={["myBillingPayments"]}
        fallback={<PaymentsTable label={t("loading")} rows={null} />}
      >
        <Payments />
      </DataBoundary>
    </div>
  );
}

function Payments() {
  const t = useTranslations("billing.history");
  const data = okData(
    useGetMyBillingPaymentsSuspense({ query: { staleTime: 0 } }).data
  );
  const payments = data?.payments ?? [];
  if (payments.length === 0)
    return <p className="text-sm text-[var(--el-muted)]">{t("empty")}</p>;
  return <PaymentsTable rows={payments} />;
}

type Rows = MyBillingPaymentsResponseDataPaymentsItem[];

const SKELETON_ROWS = 4;

/** 실제 표와 같은 머리글·행 구조에서 값만 막대로 바꾼 것이 로딩 자리다(rule `error-loading`). */
function PaymentsTable({ rows, label }: { rows: Rows | null; label?: string }) {
  const t = useTranslations("billing.history");
  const format = useBillingFormat();
  const cell = "py-3 pr-4 align-baseline";
  return (
    <table aria-label={label ?? t("title")} className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--el-hairline)] text-left text-xs text-[var(--el-muted)]">
          <th className={`${cell} font-normal`}>{t("date")}</th>
          <th className={`${cell} font-normal`}>{t("workspace")}</th>
          <th className={`${cell} text-right font-normal`}>{t("amount")}</th>
          <th className="py-3 text-right font-normal">{t("status")}</th>
        </tr>
      </thead>
      <tbody>
        {rows
          ? rows.map((payment) => (
              <tr
                key={payment.paymentId}
                className="border-b border-[var(--el-hairline)] text-[var(--el-ink)]"
              >
                <td className={`${cell} whitespace-nowrap`}>
                  {payment.completedAt
                    ? format.date(payment.completedAt)
                    : t("noDate")}
                </td>
                <td className={`${cell} max-w-0 w-full truncate`}>
                  {payment.workspaceName}
                </td>
                <td className={`${cell} whitespace-nowrap text-right`}>
                  {format.money(payment.amountKrw)}
                </td>
                <td className="py-3 text-right align-baseline">
                  <PaymentStatusText payment={payment} />
                </td>
              </tr>
            ))
          : Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <tr key={index} className="border-b border-[var(--el-hairline)]">
                {[24, 40, 16, 12].map((width, column) => (
                  <td key={column} className={column === 3 ? "py-3" : cell}>
                    <Skeleton
                      className="h-5"
                      style={{ width: `${width * 4}px` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
      </tbody>
    </table>
  );
}
