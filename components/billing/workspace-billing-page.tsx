"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import {
  BillingNotice,
  RetryPaymentButton,
  TestPaymentNotice,
  canRetryPayment,
} from "@/components/billing/billing-parts";
import {
  BillingScreen,
  BillingSection,
} from "@/components/billing/billing-screen";
import { RecordingUsage } from "@/components/billing/recording-usage";
import { Button, LinkButton } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { useCancelBillingSetup } from "@/lib/api/generated/billing/billing";
import type { WorkspaceBillingResponseData } from "@/lib/api/generated/models";
import { useGetWorkspaceSuspense } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";
import { planName } from "@/lib/billing/plan-name";
import { billingEvents, useBillingViewerRole } from "@/lib/billing/analytics";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { usePollWindow } from "@/lib/billing/use-poll-window";
import {
  billingInProgress,
  useWorkspaceBilling,
} from "@/lib/billing/use-workspace-billing";

/**
 * `/w/{workspaceId}/billing` — 요금제와 현재 상태. 값(가격·제공량·문구 종류)은 전부 서버 응답이다.
 * Free·ENDED 는 정상 상태다. 구매·관리 버튼은 서버가 준 `allowedActions`(ADMIN 만 받는다)로 가른다.
 */
export function WorkspaceBillingPage({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("billing.page");
  const role = useBillingViewerRole(workspaceId);
  useEffect(() => {
    if (role) billingEvents.plansViewed(workspaceId, role);
  }, [workspaceId, role]);
  return (
    <BillingScreen title={t("title")} description={t("description")}>
      <DataBoundary
        resetKeys={[workspaceId]}
        fallback={<PlansSkeleton label={t("loading")} />}
      >
        <PlansContent workspaceId={workspaceId} />
      </DataBoundary>
    </BillingScreen>
  );
}

function PlansSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} className="flex flex-col gap-10">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function PlansContent({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("billing.page");
  const poll = usePollWindow();
  const billing = useWorkspaceBilling(workspaceId, (data) =>
    !poll.expired && data && billingInProgress(data) ? 5000 : false
  );
  const workspace = okData(useGetWorkspaceSuspense(workspaceId).data);
  const isAdmin = workspace?.role === "ADMIN";

  if (!billing.enforced) {
    return <BillingNotice>{t("notEnforced")}</BillingNotice>;
  }
  const isPaid =
    billing.entitlement?.kind === "PAID" ||
    billing.entitlement?.kind === "TEST";
  const actions = (
    <Actions
      workspaceId={workspaceId}
      billing={billing}
      isAdmin={isAdmin}
      onRestartPolling={poll.restart}
      isPaid={isPaid}
    />
  );
  // 처리 중·미납·이어서 할 등록은 요금제 비교보다 먼저 보여야 한다 — 그때만 안내와 버튼을 현재 상태 아래로 올린다.
  const needsAttention =
    billingInProgress(billing) ||
    billing.status === "PAST_DUE" ||
    billing.teamSetupInProgress ||
    Boolean(billing.mySetupId);
  return (
    <>
      <BillingSection title={t("status")}>
        <div className="flex flex-col gap-4">
          <StatusCard billing={billing} />
          <RecordingUsage
            workspaceId={workspaceId}
            paid={billing.entitlement?.planCode === "PRO"}
          />
          {needsAttention ? actions : null}
        </div>
      </BillingSection>
      <BillingSection title={t("plans")}>
        <Plans billing={billing} isPaid={isPaid}>
          {needsAttention ? null : actions}
        </Plans>
      </BillingSection>
    </>
  );
}

function StatusCard({ billing }: { billing: WorkspaceBillingResponseData }) {
  const t = useTranslations("billing.page");
  const format = useBillingFormat();
  const kind = billing.entitlement?.kind ?? "FREE";
  const plan = planName(billing.entitlement?.planCode ?? "FREE");
  const period = billing.entitlement?.period ?? billing.currentPeriod;
  return (
    <div className="rounded-panel border border-[var(--el-hairline)] bg-white p-5">
      <p className="text-lg font-medium text-[var(--el-ink)]">{plan}</p>
      <dl className="mt-3 grid gap-1.5 text-sm text-[var(--el-muted)]">
        {kind === "LEGACY_ACCESS" || kind === "TEST" ? (
          <div>{t(`kind.${kind}`)}</div>
        ) : null}
        {billing.entitlement ? (
          <div>
            <dt className="sr-only">{t("allowance")}</dt>
            <dd>
              {format.allowance(billing.entitlement.recordingAllowanceMinutes)}
            </dd>
          </div>
        ) : null}
        {period ? (
          <div>
            <dt className="sr-only">{t("period")}</dt>
            <dd>{format.period(period)}</dd>
          </div>
        ) : null}
        {billing.status === "PAST_DUE" ? <div>{t("pastDue")}</div> : null}
        {billing.status === "ENDED" ? <div>{t("ended")}</div> : null}
        {billing.cancelAtPeriodEnd && period ? (
          <div>{t("cancelScheduled", { end: format.date(period.end) })}</div>
        ) : null}
      </dl>
    </div>
  );
}

function Plans({
  billing,
  isPaid,
  children,
}: {
  billing: WorkspaceBillingResponseData;
  isPaid: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("billing.page");
  const format = useBillingFormat();
  const product = billing.product;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <PlanCard name={planName("FREE")} current={!isPaid}>
          {product ? (
            <li>
              {format.monthlyMinutes(product.freeRecordingAllowanceMinutes)}
            </li>
          ) : null}
        </PlanCard>
        {product ? (
          <PlanCard
            name={t("plan.paid", { plan: planName(product.planCode) })}
            current={isPaid}
            price={t("plan.price", { amount: format.money(product.amountKrw) })}
          >
            <li>{format.allowance(product.recordingAllowanceMinutes)}</li>
            <li>{t("plan.shared")}</li>
            <li>{t("plan.autoRenew")}</li>
          </PlanCard>
        ) : null}
      </div>
      <TestPaymentNotice notice={product?.testPaymentNotice ?? undefined} />
      {children}
    </div>
  );
}

function PlanCard({
  name,
  price,
  current,
  children,
}: {
  name: string;
  price?: string;
  current: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("billing.page");
  return (
    <div
      aria-current={current || undefined}
      className="rounded-panel border border-[var(--el-hairline)] bg-white p-5 aria-[current]:border-[var(--el-ink)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-base font-medium text-[var(--el-ink)]">{name}</h4>
        {current ? (
          <span className="text-xs text-[var(--el-muted)]">
            {t("plan.current")}
          </span>
        ) : null}
      </div>
      {price ? (
        <p className="mt-1 text-2xl font-light text-[var(--el-ink)]">{price}</p>
      ) : null}
      <ul className="mt-3 grid gap-1 text-sm text-[var(--el-muted)]">
        {children}
      </ul>
    </div>
  );
}

function Actions({
  workspaceId,
  billing,
  isAdmin,
  isPaid,
  onRestartPolling,
}: {
  workspaceId: string;
  billing: WorkspaceBillingResponseData;
  isAdmin: boolean;
  isPaid: boolean;
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

  const cancelSetup = async () => {
    if (!billing.mySetupId) return;
    await cancel
      .mutateAsync({ workspaceId, setupId: billing.mySetupId })
      .then(() => invalidateWorkspaceBilling(queryClient, workspaceId))
      .catch(() => undefined);
  };

  return (
    // 안내 카드는 위의 카드들과 같은 폭으로, 버튼은 글자 폭으로.
    <div className="flex flex-col items-start gap-3 [&>[role=alert]]:self-stretch [&>[role=status]]:self-stretch">
      {billing.teamSetupInProgress ? (
        <BillingNotice>{t("teamInProgress")}</BillingNotice>
      ) : null}
      {checking ? (
        <BillingNotice title={t("checking.title")}>
          {t("checking.body")}
        </BillingNotice>
      ) : null}
      {refund === "PENDING" ||
      refund === "PROCESSING" ||
      refund === "UNKNOWN" ? (
        <BillingNotice tone="warn" title={t("refunding.title")}>
          {t("refunding.body")}
        </BillingNotice>
      ) : null}
      {refund === "FAILED" ? (
        <BillingNotice tone="warn" title={t("refundFailed.title")}>
          {t("refundFailed.body")}
        </BillingNotice>
      ) : null}
      {billing.status === "PAST_DUE" && !checking ? (
        <BillingNotice tone="warn">{t("pastDue")}</BillingNotice>
      ) : null}
      {!isAdmin ? <BillingNotice>{t("askAdmin")}</BillingNotice> : null}
      {isAdmin &&
      actions.includes("START_PURCHASE") &&
      !isPaid &&
      billing.product ? (
        <LinkButton href={`/w/${workspaceId}/billing/checkout`}>
          {t("start", { plan: planName(billing.product.planCode) })}
        </LinkButton>
      ) : null}
      {isAdmin && billing.mySetupId && actions.includes("CONTINUE_SETUP") ? (
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={`/billing/setups/${billing.mySetupId}`}>
            {t("continueSetup")}
          </LinkButton>
          {actions.includes("CANCEL_SETUP") ? (
            <Button
              variant="outline"
              onClick={cancelSetup}
              loading={cancel.isPending}
            >
              {t("cancelSetup")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {isAdmin &&
      billing.mySetupId &&
      !actions.includes("CONTINUE_SETUP") &&
      actions.includes("REFRESH_STATUS") ? (
        <LinkButton
          href={`/billing/setups/${billing.mySetupId}`}
          variant="outline"
        >
          {t("viewResult")}
        </LinkButton>
      ) : null}
      {isAdmin &&
      actions.includes("RETRY_PAYMENT") &&
      detail &&
      canRetryPayment(detail) &&
      billing.product ? (
        <RetryPaymentButton
          workspaceId={workspaceId}
          detail={detail}
          amountKrw={billing.product.amountKrw}
          onRetried={onRestartPolling}
        />
      ) : null}
      {isAdmin && actions.includes("REFRESH_STATUS") ? (
        <Button
          variant="outline"
          onClick={() => {
            onRestartPolling();
            void invalidateWorkspaceBilling(queryClient, workspaceId);
          }}
        >
          {t("refresh")}
        </Button>
      ) : null}
    </div>
  );
}
