"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";

import { BillingCheckout } from "@/components/billing/billing-checkout";
import {
  BillingNotice,
  RetryPaymentButton,
  TestPaymentNotice,
  canRetryPayment,
} from "@/components/billing/billing-parts";
import { RecordingUsage } from "@/components/billing/recording-usage";
import { SettingsHeader } from "@/components/settings/settings-layout";
import { Button, LinkButton } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useCancelBillingSetup } from "@/lib/api/generated/billing/billing";
import type { WorkspaceBillingResponseData } from "@/lib/api/generated/models";
import { useGetWorkspaceSuspense } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";
import { billingEvents, useBillingViewerRole } from "@/lib/billing/analytics";
import { refundPending } from "@/lib/billing/payment-status";
import { planName } from "@/lib/billing/plan-name";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { useRefundResultEvent } from "@/lib/billing/use-billing-commands";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { usePollWindow } from "@/lib/billing/use-poll-window";
import {
  billingInProgress,
  useWorkspaceBilling,
} from "@/lib/billing/use-workspace-billing";
import { cn } from "@/lib/utils";

type Billing = WorkspaceBillingResponseData;

/** 현재 요금제 패널. 실제 화면과 skeleton 이 같은 틀을 읽는다(rule `error-loading`). */
const PANEL =
  "grid overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-white md:grid-cols-[minmax(0,1fr)_248px]";
const PANEL_CELL = "p-6";
const PANEL_SIDE =
  "border-t border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-6 md:border-t-0 md:border-l";
const LABEL = "text-xs leading-4 text-[var(--el-muted)]";
const FIGURE =
  "text-[40px] leading-[1.1] font-light tracking-[-0.035em] text-[var(--el-ink)]";

/**
 * 설정 › 요금제(PRO-75). 현재 요금제와 이번 달 사용량, 요금제 비교를 한 탭에 둔다. 구매는 같은 탭 안에서 주문 확인으로
 * 바뀌고(`view`), 카드 입력만 결제 대행사 창으로 나간다. 값(가격·제공량·문구 종류)은 전부 서버 응답이다.
 */
export function WorkspacePlanSettings({
  workspaceId,
  onOpenPayment,
}: {
  workspaceId: string;
  /** 「결제 관리」 탭으로. */
  onOpenPayment: () => void;
}) {
  const t = useTranslations("billing.page");
  const [view, setView] = useState<"plans" | "checkout">("plans");
  const role = useBillingViewerRole(workspaceId);
  useEffect(() => {
    if (role) billingEvents.plansViewed(workspaceId, role);
  }, [workspaceId, role]);

  if (view === "checkout") {
    return (
      <BillingCheckout
        workspaceId={workspaceId}
        purpose="PURCHASE"
        onBack={() => setView("plans")}
      />
    );
  }
  return (
    <div>
      <SettingsHeader title={t("title")} description={t("description")} />
      <DataBoundary
        resetKeys={[workspaceId]}
        fallback={<PlanSkeleton label={t("loading")} />}
      >
        <PlanContent
          workspaceId={workspaceId}
          onCheckout={() => setView("checkout")}
          onOpenPayment={onOpenPayment}
        />
      </DataBoundary>
    </div>
  );
}

function PlanSkeleton({ label }: { label: string }) {
  const t = useTranslations("billing.page");
  return (
    <div aria-label={label} className="flex flex-col gap-8">
      <div className={PANEL}>
        <div className={PANEL_CELL}>
          <p className={LABEL}>{t("currentLabel")}</p>
          <Skeleton className="mt-2 h-11 w-24" />
          <Skeleton className="mt-3 h-5 w-56" />
        </div>
        <div className={PANEL_SIDE}>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-2 h-7 w-32" />
          <Skeleton className="mt-4 h-1.5 w-full" />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-[var(--el-ink)]">
          {t("compare")}
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-[300px] rounded-panel" />
          <Skeleton className="h-[300px] rounded-panel" />
        </div>
      </div>
    </div>
  );
}

function PlanContent({
  workspaceId,
  onCheckout,
  onOpenPayment,
}: {
  workspaceId: string;
  onCheckout: () => void;
  onOpenPayment: () => void;
}) {
  const t = useTranslations("billing.page");
  const poll = usePollWindow();
  // 사용자 환불은 미정산 시도가 아니라 `REFRESH_STATUS` 가 없다 — 취소 처리 중이면 같이 다시 읽는다.
  const billing = useWorkspaceBilling(workspaceId, (data) =>
    !poll.expired &&
    data &&
    (billingInProgress(data) ||
      refundPending(data.detail?.refundedAttempt?.refundStatus))
      ? 5000
      : false
  );
  const refunded = billing.detail?.refundedAttempt;
  useRefundResultEvent(
    workspaceId,
    refunded?.refundStatus,
    refunded?.refundOrigin === "USER"
  );
  const workspace = okData(useGetWorkspaceSuspense(workspaceId).data);
  const isAdmin = workspace?.role === "ADMIN";

  if (!billing.enforced) {
    return <BillingNotice>{t("notEnforced")}</BillingNotice>;
  }
  const kind = billing.entitlement?.kind;
  const isPaid = kind === "PAID" || kind === "TEST" || kind === "GRACE";
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <CurrentPlan
          workspaceId={workspaceId}
          billing={billing}
          isAdmin={isAdmin}
          onOpenPayment={onOpenPayment}
        />
        <Attention
          workspaceId={workspaceId}
          billing={billing}
          isAdmin={isAdmin}
          onRestartPolling={poll.restart}
        />
      </div>
      <PlanCompare
        billing={billing}
        isPaid={isPaid}
        isAdmin={isAdmin}
        onCheckout={() => {
          onCheckout();
        }}
      />
    </div>
  );
}

/** 왼쪽은 지금 요금제와 그 상태 한 줄, 오른쪽은 이번 달 녹음 사용량. */
function CurrentPlan({
  workspaceId,
  billing,
  isAdmin,
  onOpenPayment,
}: {
  workspaceId: string;
  billing: Billing;
  isAdmin: boolean;
  onOpenPayment: () => void;
}) {
  const t = useTranslations("billing.page");
  const format = useBillingFormat();
  const kind = billing.entitlement?.kind ?? "FREE";
  const planCode = billing.entitlement?.planCode ?? "FREE";
  const period = billing.entitlement?.period ?? billing.currentPeriod;
  const product = billing.product;
  const amount = product ? format.money(product.amountKrw) : null;

  const badge =
    kind === "GRACE" || billing.status === "PAST_DUE"
      ? t("badge.pastDue")
      : billing.cancelAtPeriodEnd && billing.status === "ACTIVE"
        ? t("badge.cancelScheduled")
        : kind === "TEST" || kind === "LEGACY_ACCESS"
          ? t(`kind.${kind}`)
          : null;

  const line =
    kind === "GRACE" && period
      ? t("line.grace", { end: format.date(period.end) })
      : billing.status === "PAST_DUE"
        ? t("line.pastDue")
        : billing.cancelAtPeriodEnd && billing.status === "ACTIVE" && period
          ? t("line.cancelScheduled", { end: format.date(period.end) })
          : billing.status === "ACTIVE" && period && amount
            ? t("line.next", { date: format.date(period.end), amount })
            : planCode === "FREE" && product
              ? t("line.free", {
                  allowance: format.duration(
                    product.freeRecordingAllowanceMinutes
                  ),
                })
              : period
                ? format.period(period)
                : null;

  return (
    <div className={PANEL}>
      <div className={cn(PANEL_CELL, "flex flex-col")}>
        <p className={LABEL}>{t("currentLabel")}</p>
        <p className="mt-2 flex items-center gap-2.5">
          <span className={FIGURE}>{planName(planCode)}</span>
          {badge ? (
            <span className="rounded-full bg-[var(--el-surface-strong)] px-2 py-0.5 text-xs whitespace-nowrap text-[var(--el-ink)]">
              {badge}
            </span>
          ) : null}
        </p>
        {line ? (
          <p className="mt-3 text-sm leading-5 text-balance text-[var(--el-body)]">
            {line}
          </p>
        ) : null}
        {isAdmin && billing.detail?.methodId ? (
          <button
            type="button"
            onClick={onOpenPayment}
            className="mt-4 inline-flex items-center gap-1 self-start text-sm text-[var(--el-muted)] underline-offset-4 hover:text-[var(--el-ink)] hover:underline"
          >
            {t("openPayment")}
            <ArrowRight className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className={PANEL_SIDE}>
        <RecordingUsage workspaceId={workspaceId} paid={planCode === "PRO"} />
      </div>
    </div>
  );
}

/** Free 와 유료 상품을 나란히. 유료 카드는 어두운 면이고(DESIGN `pricing-tier-featured`), 구매 버튼은 그 카드 안에 있다. */
function PlanCompare({
  billing,
  isPaid,
  isAdmin,
  onCheckout,
}: {
  billing: Billing;
  isPaid: boolean;
  isAdmin: boolean;
  onCheckout: () => void;
}) {
  const t = useTranslations("billing.page");
  const format = useBillingFormat();
  const product = billing.product;
  if (!product) return null;
  const canStart = billing.allowedActions.includes("START_PURCHASE") && !isPaid;
  return (
    <section aria-label={t("compare")}>
      <h3 className="text-sm font-medium text-[var(--el-ink)]">
        {t("compare")}
      </h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <PlanCard
          name={planName("FREE")}
          price={t("plan.freePrice")}
          current={!isPaid}
          features={[
            t("plan.recording", {
              allowance: format.monthlyMinutes(
                product.freeRecordingAllowanceMinutes
              ),
            }),
            t("plan.members"),
          ]}
        />
        <PlanCard
          featured
          name={planName(product.planCode)}
          price={format.money(product.amountKrw)}
          per={t("plan.perMonth")}
          current={isPaid}
          features={[
            format.allowance(product.recordingAllowanceMinutes),
            t("plan.members"),
            t("plan.shared"),
            t("plan.autoRenew"),
          ]}
          footer={
            isPaid ? null : !isAdmin ? (
              <p className="text-sm leading-5 text-white/70">{t("askAdmin")}</p>
            ) : canStart ? (
              <Button
                onClick={onCheckout}
                className="h-10 w-full bg-white text-[var(--el-ink)] hover:bg-white/90"
              >
                {t("start", { plan: planName(product.planCode) })}
                <ArrowRight aria-hidden />
              </Button>
            ) : null
          }
        />
      </div>
      <div className="mt-3">
        <TestPaymentNotice notice={product.testPaymentNotice ?? undefined} />
      </div>
    </section>
  );
}

function PlanCard({
  name,
  price,
  per,
  current,
  featured,
  features,
  footer,
}: {
  name: string;
  price: string;
  per?: string;
  current: boolean;
  featured?: boolean;
  features: string[];
  footer?: ReactNode;
}) {
  const t = useTranslations("billing.page");
  return (
    <div
      aria-current={current || undefined}
      className={cn(
        "flex min-h-[300px] flex-col rounded-panel border p-6",
        featured
          ? "border-transparent bg-[var(--el-ink)] text-white"
          : "border-[var(--el-hairline)] bg-white text-[var(--el-ink)]"
      )}
    >
      <div className="flex h-6 items-center justify-between gap-2">
        <h4 className="text-base font-medium">{name}</h4>
        {current ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
              featured
                ? "bg-white/15 text-white"
                : "bg-[var(--el-surface-strong)] text-[var(--el-ink)]"
            )}
          >
            {t("plan.current")}
          </span>
        ) : null}
      </div>
      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="text-[32px] leading-[1.15] font-light tracking-[-0.03em]">
          {price}
        </span>
        {per ? (
          <span
            className={cn(
              "text-sm",
              featured ? "text-white/60" : "text-[var(--el-muted)]"
            )}
          >
            {per}
          </span>
        ) : null}
      </p>
      <ul
        className={cn(
          "mt-5 grid gap-2.5 text-sm leading-5",
          featured ? "text-white/85" : "text-[var(--el-body)]"
        )}
      >
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check
              className={cn(
                "mt-0.5 size-4 shrink-0",
                featured ? "text-white/60" : "text-[var(--el-muted)]"
              )}
              aria-hidden
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {footer ? <div className="mt-auto pt-6">{footer}</div> : null}
    </div>
  );
}

/**
 * 요금제 비교보다 먼저 봐야 하는 것 — 처리 중·미납·이어서 할 등록·환불 진행. 없으면 아무것도 그리지 않는다.
 * 구매 시작은 유료 카드 안의 버튼이 맡는다.
 */
function Attention({
  workspaceId,
  billing,
  isAdmin,
  onRestartPolling,
}: {
  workspaceId: string;
  billing: Billing;
  isAdmin: boolean;
  onRestartPolling: () => void;
}) {
  const t = useTranslations("billing.page");
  const queryClient = useQueryClient();
  const cancel = useCancelBillingSetup();
  const actions = billing.allowedActions;
  const detail = billing.detail;
  const checking =
    billing.latestAttemptStatus === "PENDING" ||
    billing.latestAttemptStatus === "PROCESSING" ||
    billing.latestAttemptStatus === "UNKNOWN";

  // 승인 뒤 자동 취소(보상 환불)가 걸린 결제. 끝난 취소는 알리지 않는다 — 결과 화면이 이미 알렸고 상태는 Free 로 보인다.
  const refund =
    detail?.latestAttempt?.refundStatus ??
    detail?.refundedAttempt?.refundStatus;
  // 사용자가 요청한 환불은 「결제 취소 처리 중 → 완료」로 따로 말한다(보상 취소와 섞지 않는다).
  const userRefund =
    detail?.refundedAttempt?.refundOrigin === "USER"
      ? detail.refundedAttempt.refundStatus
      : null;
  const compensation = userRefund ? null : refund;

  const cancelSetup = async () => {
    if (!billing.mySetupId) return;
    await cancel
      .mutateAsync({ workspaceId, setupId: billing.mySetupId })
      .then(() => invalidateWorkspaceBilling(queryClient, workspaceId))
      .catch(() => undefined);
  };

  const notices = [
    billing.teamSetupInProgress ? (
      <BillingNotice key="team">{t("teamInProgress")}</BillingNotice>
    ) : null,
    checking ? (
      <BillingNotice key="checking" title={t("checking.title")}>
        {t("checking.body")}
      </BillingNotice>
    ) : null,
    refundPending(compensation) ? (
      <BillingNotice key="refunding" tone="warn" title={t("refunding.title")}>
        {t("refunding.body")}
      </BillingNotice>
    ) : null,
    compensation === "FAILED" ? (
      <BillingNotice
        key="refundFailed"
        tone="warn"
        title={t("refundFailed.title")}
      >
        {t("refundFailed.body")}
      </BillingNotice>
    ) : null,
    refundPending(userRefund) ? (
      <BillingNotice key="userRefunding" title={t("userRefunding.title")}>
        {t("userRefunding.body")}
      </BillingNotice>
    ) : null,
    userRefund === "SUCCEEDED" && billing.status === "ENDED" ? (
      <BillingNotice key="userRefunded" title={t("userRefunded.title")}>
        {t("userRefunded.body")}
      </BillingNotice>
    ) : null,
    userRefund === "FAILED" ? (
      <BillingNotice
        key="userRefundFailed"
        tone="warn"
        title={t("userRefundFailed.title")}
      >
        {t("userRefundFailed.body")}
      </BillingNotice>
    ) : null,
  ].filter(Boolean);

  const buttons = isAdmin
    ? [
        billing.mySetupId && actions.includes("CONTINUE_SETUP") ? (
          <LinkButton
            key="continue"
            href={`/billing/setups/${billing.mySetupId}`}
          >
            {t("continueSetup")}
          </LinkButton>
        ) : null,
        billing.mySetupId &&
        actions.includes("CONTINUE_SETUP") &&
        actions.includes("CANCEL_SETUP") ? (
          <Button
            key="cancelSetup"
            variant="outline"
            onClick={cancelSetup}
            loading={cancel.isPending}
          >
            {t("cancelSetup")}
          </Button>
        ) : null,
        billing.mySetupId &&
        !actions.includes("CONTINUE_SETUP") &&
        actions.includes("REFRESH_STATUS") ? (
          <LinkButton
            key="viewResult"
            href={`/billing/setups/${billing.mySetupId}`}
            variant="outline"
          >
            {t("viewResult")}
          </LinkButton>
        ) : null,
        actions.includes("RETRY_PAYMENT") &&
        detail &&
        canRetryPayment(detail) &&
        billing.product ? (
          <RetryPaymentButton
            key="retry"
            workspaceId={workspaceId}
            detail={detail}
            amountKrw={billing.product.amountKrw}
            pastDue={billing.status === "PAST_DUE"}
            onRetried={onRestartPolling}
          />
        ) : null,
        actions.includes("REFRESH_STATUS") ? (
          <Button
            key="refresh"
            variant="outline"
            onClick={() => {
              onRestartPolling();
              void invalidateWorkspaceBilling(queryClient, workspaceId);
            }}
          >
            {t("refresh")}
          </Button>
        ) : null,
      ].filter(Boolean)
    : [];

  if (notices.length === 0 && buttons.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {notices}
      {buttons.length > 0 ? (
        <div className="flex flex-wrap items-start gap-2">{buttons}</div>
      ) : null}
    </div>
  );
}
