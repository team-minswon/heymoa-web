"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { BillingPaymentDetail } from "@/components/billing/billing-payment-detail";
import { PaymentList } from "@/components/billing/payment-history";
import {
  SETTINGS_CARD,
  SettingsHeader,
} from "@/components/settings/settings-layout";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetMyBillingPaymentsSuspense } from "@/lib/api/generated/billing/billing";
import { useGetWorkspacesSuspense } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";
import { billingEvents } from "@/lib/billing/analytics";
import { cn } from "@/lib/utils";

/**
 * 설정 › 계정 › 내 결제 내역(APP-1596). 내가 결제자인 결제 전부라 워크스페이스의 한도 집행 여부와 상관없고, 나갔거나 지운 공간의
 * 결제도 결제 때의 이름(스냅샷)으로 보인다. 행은 지금 내가 그 공간의 ADMIN 일 때만 상세로 들어간다 — 상세는 그 공간의 ADMIN 만 연다.
 * 내역이 한 건도 없으면 설정 창이 이 탭을 숨긴다.
 */
export function MyPaymentsSettings() {
  const t = useTranslations("billing.history");
  const [open, setOpen] = useState<{
    workspaceId: string;
    paymentId: string;
  } | null>(null);
  useEffect(() => {
    billingEvents.paymentHistoryViewed();
  }, []);

  if (open) {
    return (
      <DataBoundary
        resetKeys={[open.workspaceId, open.paymentId]}
        fallback={<Skeleton className="h-80 w-full rounded-panel" />}
      >
        <BillingPaymentDetail
          workspaceId={open.workspaceId}
          paymentId={open.paymentId}
          backLabel={t("myTitle")}
          onBack={() => setOpen(null)}
        />
      </DataBoundary>
    );
  }
  return (
    <div>
      <SettingsHeader title={t("myTitle")} description={t("myDescription")} />
      <DataBoundary
        resetKeys={["myBillingPayments"]}
        fallback={<PaymentList label={t("loading")} rows={null} />}
      >
        <Payments onOpen={setOpen} />
      </DataBoundary>
    </div>
  );
}

function Payments({
  onOpen,
}: {
  onOpen: (target: { workspaceId: string; paymentId: string }) => void;
}) {
  const t = useTranslations("billing.history");
  const payments =
    okData(useGetMyBillingPaymentsSuspense({ query: { staleTime: 0 } }).data)
      ?.payments ?? [];
  const admin = new Set(
    (okData(useGetWorkspacesSuspense().data)?.workspaces ?? [])
      .filter((workspace) => workspace.role === "ADMIN")
      .map((workspace) => workspace.workspaceId)
  );
  const workspaceOf = new Map(
    payments.map((payment) => [payment.paymentId, payment.workspaceId])
  );
  if (payments.length === 0)
    return (
      <p className={cn(SETTINGS_CARD, "text-sm text-[var(--el-muted)]")}>
        {t("empty")}
      </p>
    );
  return (
    <PaymentList
      label={t("myTitle")}
      rows={payments.map((payment) => ({
        ...payment,
        middle: payment.workspaceName,
        openable: admin.has(payment.workspaceId),
      }))}
      onOpen={(paymentId) =>
        onOpen({ workspaceId: workspaceOf.get(paymentId)!, paymentId })
      }
    />
  );
}
