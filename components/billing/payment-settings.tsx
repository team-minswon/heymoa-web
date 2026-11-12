"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { BillingCheckout } from "@/components/billing/billing-checkout";
import { BillingNotice } from "@/components/billing/billing-parts";
import { BillingPaymentDetail } from "@/components/billing/billing-payment-detail";
import { PaymentList } from "@/components/billing/payment-history";
import {
  SectionTitle,
  SubscriptionManagement,
  hasSubscriptionToManage,
} from "@/components/billing/subscription-management";
import {
  SETTINGS_CARD,
  SettingsHeader,
} from "@/components/settings/settings-layout";
import { Button } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetWorkspaceBillingPaymentsSuspense } from "@/lib/api/generated/billing/billing";
import { useGetWorkspaceSuspense } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";
import { billingEvents } from "@/lib/billing/analytics";
import { useWorkspaceBilling } from "@/lib/billing/use-workspace-billing";
import { cn } from "@/lib/utils";

type View =
  | { kind: "manage" }
  | { kind: "card" }
  | { kind: "payment"; id: string };

/**
 * 설정 › 결제 관리(PRO-75). 결제 수단·구독·결제 내역을 한 탭에 둔다. 카드 변경과 결제 상세는 같은 탭 안에서 한 단계 들어간다(`view`).
 * 탭 전체가 ADMIN 전용이다(멤버에게는 탭이 없다). 결제 내역은 이 공간의 것이고, 내가 결제한 내역은 계정 쪽 「내 결제 내역」 탭이다.
 */
export function WorkspacePaymentSettings({
  workspaceId,
  onOpenPlans,
}: {
  workspaceId: string;
  /** 「요금제」 탭으로. */
  onOpenPlans: () => void;
}) {
  const t = useTranslations("billing.manage");
  const [view, setView] = useState<View>({ kind: "manage" });
  const back = () => setView({ kind: "manage" });

  if (view.kind === "card") {
    return (
      <BillingCheckout
        workspaceId={workspaceId}
        purpose="REPLACE"
        onBack={back}
      />
    );
  }
  if (view.kind === "payment") {
    return (
      <DataBoundary
        resetKeys={[workspaceId, view.id]}
        fallback={<Skeleton className="h-80 w-full rounded-panel" />}
      >
        <BillingPaymentDetail
          workspaceId={workspaceId}
          paymentId={view.id}
          onBack={back}
        />
      </DataBoundary>
    );
  }
  return (
    <div>
      <SettingsHeader
        title={t("pageTitle")}
        description={t("pageDescription")}
      />
      <div className="flex flex-col gap-8">
        <DataBoundary
          resetKeys={[workspaceId]}
          fallback={<ManageSkeleton label={t("loading")} />}
        >
          <Manage
            workspaceId={workspaceId}
            onOpenPlans={onOpenPlans}
            onChangeCard={() => setView({ kind: "card" })}
            onOpenPayment={(id) => setView({ kind: "payment", id })}
          />
        </DataBoundary>
        <History
          workspaceId={workspaceId}
          onOpenPayment={(id) => setView({ kind: "payment", id })}
        />
      </div>
    </div>
  );
}

function ManageSkeleton({ label }: { label: string }) {
  const t = useTranslations("billing.manage");
  return (
    <section aria-label={label}>
      <SectionTitle>{t("methodTitle")}</SectionTitle>
      <div className={cn(SETTINGS_CARD, "flex items-center gap-3")}>
        <Skeleton className="size-9 rounded-control" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-1.5 h-3 w-40" />
        </div>
      </div>
    </section>
  );
}

function Manage({
  workspaceId,
  onOpenPlans,
  onChangeCard,
  onOpenPayment,
}: {
  workspaceId: string;
  onOpenPlans: () => void;
  onChangeCard: () => void;
  onOpenPayment: (paymentId: string) => void;
}) {
  const t = useTranslations("billing.manage");
  const tPage = useTranslations("billing.page");
  const billing = useWorkspaceBilling(workspaceId);
  const workspace = okData(useGetWorkspaceSuspense(workspaceId).data);

  if (workspace?.role !== "ADMIN") {
    return <BillingNotice>{tPage("askAdmin")}</BillingNotice>;
  }
  if (!hasSubscriptionToManage(billing)) {
    return (
      <section aria-label={t("methodTitle")}>
        <SectionTitle>{t("methodTitle")}</SectionTitle>
        <div
          className={cn(
            SETTINGS_CARD,
            "flex items-center justify-between gap-4"
          )}
        >
          <p className="text-sm leading-5 text-[var(--el-muted)]">
            {t("empty")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onOpenPlans}
          >
            {t("openPlans")}
          </Button>
        </div>
      </section>
    );
  }
  return (
    <SubscriptionManagement
      workspaceId={workspaceId}
      billing={billing}
      onChangeCard={onChangeCard}
      onOpenPayment={onOpenPayment}
    />
  );
}

/**
 * 이 공간의 결제 내역(APP-1596). 결제자가 누구든 이 공간의 결제 전부이고 ADMIN 에게만 보인다(이 탭이 ADMIN 전용이다).
 * 결제자 이름이 없으면(탈퇴) 「탈퇴한 멤버」. 행은 모두 이 공간의 결제라 상세로 들어간다.
 */
function History({
  workspaceId,
  onOpenPayment,
}: {
  workspaceId: string;
  onOpenPayment: (paymentId: string) => void;
}) {
  const t = useTranslations("billing.history");
  useEffect(() => {
    billingEvents.paymentHistoryViewed();
  }, []);
  return (
    <section aria-label={t("title")}>
      <SectionTitle>{t("title")}</SectionTitle>
      <DataBoundary
        resetKeys={[workspaceId]}
        fallback={<PaymentList label={t("loading")} rows={null} />}
      >
        <Payments workspaceId={workspaceId} onOpenPayment={onOpenPayment} />
      </DataBoundary>
      <p className="mt-3 text-xs leading-5 text-[var(--el-muted)]">
        {t("description")}
      </p>
    </section>
  );
}

function Payments({
  workspaceId,
  onOpenPayment,
}: {
  workspaceId: string;
  onOpenPayment: (paymentId: string) => void;
}) {
  const t = useTranslations("billing.history");
  const payments =
    okData(
      useGetWorkspaceBillingPaymentsSuspense(workspaceId, {
        query: { staleTime: 0 },
      }).data
    )?.payments ?? [];
  if (payments.length === 0)
    return (
      <p className={cn(SETTINGS_CARD, "text-sm text-[var(--el-muted)]")}>
        {t("empty")}
      </p>
    );
  return (
    <PaymentList
      label={t("title")}
      rows={payments.map((payment) => ({
        ...payment,
        middle: payment.payerName ?? t("leftMember"),
        openable: true,
      }))}
      onOpen={onOpenPayment}
    />
  );
}
