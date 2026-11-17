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

export function MyPaymentsSettings() {
  const t = useTranslations("billing.history");
  const [open, setOpen] = useState<{
    workspaceId: string;
    paymentId: string;
  } | null>(null);
  useEffect(() => {
    billingEvents.paymentHistoryViewed("me");
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
      onOpen={({ workspaceId, paymentId }) =>
        onOpen({ workspaceId, paymentId })
      }
    />
  );
}
