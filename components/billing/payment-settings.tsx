"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { BillingCheckout } from "@/components/billing/billing-checkout";
import { BillingNotice } from "@/components/billing/billing-parts";
import { BillingPaymentDetail } from "@/components/billing/billing-payment-detail";
import {
  PaymentStatusText,
  SectionTitle,
  SubscriptionManagement,
  hasSubscriptionToManage,
} from "@/components/billing/subscription-management";
import {
  SETTINGS_CARD,
  SETTINGS_LIST,
  SettingsHeader,
} from "@/components/settings/settings-layout";
import { Button } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetMyBillingPaymentsSuspense } from "@/lib/api/generated/billing/billing";
import type { MyBillingPaymentsResponseDataPaymentsItem } from "@/lib/api/generated/models";
import { useGetWorkspaceSuspense } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";
import { billingEvents } from "@/lib/billing/analytics";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { useWorkspaceBilling } from "@/lib/billing/use-workspace-billing";
import { cn } from "@/lib/utils";

type View =
  | { kind: "manage" }
  | { kind: "card" }
  | { kind: "payment"; id: string };

/**
 * 설정 › 결제 관리(PRO-75). 결제 수단·구독·결제 내역을 한 탭에 둔다. 카드 변경과 결제 상세는 같은 탭 안에서 한 단계 들어간다(`view`).
 * 결제 수단과 구독은 이 공간의 것이고 관리자만 본다. 결제 내역은 **내가 결제한 것**이라 다른 공간의 결제도 같이 보인다.
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
 * 내가 결제자인 결제, 최신순(서버가 정렬한다). 나갔거나 지운 공간의 결제도 결제 때의 공간 이름(스냅샷)으로 보인다.
 * 이 공간의 결제이고 내가 관리자일 때만 상세로 들어간다 — 그 화면은 지금 그 공간의 ADMIN 만 연다.
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
        resetKeys={["myBillingPayments"]}
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
  const data = okData(
    useGetMyBillingPaymentsSuspense({ query: { staleTime: 0 } }).data
  );
  const workspace = okData(useGetWorkspaceSuspense(workspaceId).data);
  const payments = data?.payments ?? [];
  if (payments.length === 0)
    return (
      <p className={cn(SETTINGS_CARD, "text-sm text-[var(--el-muted)]")}>
        {t("empty")}
      </p>
    );
  return (
    <PaymentList
      rows={payments}
      openable={(payment) =>
        workspace?.role === "ADMIN" && payment.workspaceId === workspaceId
      }
      onOpen={onOpenPayment}
    />
  );
}

type Item = MyBillingPaymentsResponseDataPaymentsItem;

const ROW =
  "grid min-h-[52px] w-full grid-cols-[132px_minmax(0,1fr)_88px_112px_16px] items-center gap-3 px-4 py-2.5 text-left text-sm";
const SKELETON_ROWS = 3;

/** 실제 목록과 같은 행 구조에서 값만 막대로 바꾼 것이 로딩 자리다(rule `error-loading`). */
function PaymentList({
  rows,
  label,
  openable,
  onOpen,
}: {
  rows: Item[] | null;
  label?: string;
  openable?: (payment: Item) => boolean;
  onOpen?: (paymentId: string) => void;
}) {
  const t = useTranslations("billing.history");
  const format = useBillingFormat();
  return (
    <ul aria-label={label ?? t("title")} className={SETTINGS_LIST}>
      {rows
        ? rows.map((payment) => {
            const cells = (
              <>
                <span className="whitespace-nowrap text-[var(--el-ink)]">
                  {payment.completedAt
                    ? format.date(payment.completedAt)
                    : t("noDate")}
                </span>
                <span className="truncate text-[var(--el-muted)]">
                  {payment.workspaceName}
                </span>
                <span className="text-right whitespace-nowrap text-[var(--el-ink)] tabular-nums">
                  {format.money(payment.amountKrw)}
                </span>
                <PaymentStatusText payment={payment} />
              </>
            );
            return (
              <li key={payment.paymentId}>
                {openable?.(payment) && onOpen ? (
                  <button
                    type="button"
                    onClick={() => onOpen(payment.paymentId)}
                    className={cn(ROW, "hover:bg-[var(--el-canvas-soft)]")}
                  >
                    {cells}
                    <ChevronRight
                      className="size-4 text-[var(--el-muted)]"
                      aria-hidden
                    />
                  </button>
                ) : (
                  <div className={ROW}>{cells}</div>
                )}
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
  );
}
