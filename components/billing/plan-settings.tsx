"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";

import {
  BillingNotice,
  FeedbackLink,
  TestPaymentNotice,
} from "@/components/billing/billing-parts";
import { RecordingUsage } from "@/components/billing/recording-usage";
import { SettingsHeader } from "@/components/settings/settings-layout";
import { CardChangeDialog } from "@/components/billing/card-change-dialog";
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
import { goToCheckout } from "@/lib/billing/navigate";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { usePollWindow } from "@/lib/billing/use-poll-window";
import {
  billingInProgress,
  billingNeedsRereading,
  useWorkspaceBilling,
} from "@/lib/billing/use-workspace-billing";
import { cn } from "@/lib/utils";

type Billing = WorkspaceBillingResponseData;

const PANEL =
  "grid overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-white md:grid-cols-[minmax(0,1fr)_auto]";
const PANEL_CELL = "p-6";
const PANEL_SIDE =
  "border-t border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-6 md:w-[248px] md:border-t-0 md:border-l";
const LABEL = "text-xs leading-4 text-[var(--el-muted)]";
const FIGURE =
  "text-[40px] leading-[1.1] font-light tracking-[-0.035em] text-[var(--el-ink)]";

export function WorkspacePlanSettings({
  workspaceId,
  onOpenPayment,
}: {
  workspaceId: string;
  onOpenPayment: () => void;
}) {
  const t = useTranslations("billing.page");
  const role = useBillingViewerRole(workspaceId);
  useEffect(() => {
    if (role) billingEvents.plansViewed(workspaceId, role);
  }, [workspaceId, role]);
  const checkout = () => {
    if (role) billingEvents.checkoutEntered(workspaceId, role);
    goToCheckout(workspaceId);
  };
  return (
    <div>
      <SettingsHeader title={t("title")} description={t("description")} />
      <DataBoundary
        resetKeys={[workspaceId]}
        fallback={<PlanSkeleton label={t("loading")} />}
      >
        <PlanContent
          workspaceId={workspaceId}
          onCheckout={checkout}
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
          <Skeleton className="h-[259px] rounded-panel" />
          <Skeleton className="h-[259px] rounded-panel" />
        </div>
        <IncludedInBoth />
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
  const poll = usePollWindow();
  const billing = useWorkspaceBilling(workspaceId, (data) =>
    !poll.expired && data && billingNeedsRereading(data) ? 5000 : false
  );
  const workspace = okData(useGetWorkspaceSuspense(workspaceId).data);
  const isAdmin = workspace?.role === "ADMIN";

  const kind = billing.entitlement?.kind;
  const isPaid = kind === "PAID" || kind === "RENEWAL_PENDING";
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
          onCheckout={onCheckout}
        />
      </div>
      <PlanCompare
        billing={billing}
        isPaid={isPaid}
        isAdmin={isAdmin}
        onCheckout={onCheckout}
      />
    </div>
  );
}

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
  const nextAmount = billing.detail?.nextChargeAmountKrw;
  const amount = nextAmount != null ? format.money(nextAmount) : null;

  const cancelScheduled =
    billing.cancelAtPeriodEnd && billing.status === "ACTIVE";
  const pastDueEnd =
    billing.status === "PAST_DUE" ? billing.pastDueEndsAt : null;
  const badge = pastDueEnd
    ? t("badge.pastDue")
    : cancelScheduled
      ? t("badge.cancelScheduled")
      : null;
  const stoppedNoCard = isAdmin && cancelScheduled && !billing.detail?.methodId;

  const line = pastDueEnd
    ? t(isAdmin ? "line.pastDue" : "line.pastDueMember", {
        end: format.dateTime(pastDueEnd).replaceAll(" ", "\u00a0"),
      })
    : kind === "RENEWAL_PENDING"
      ? t("line.renewalPending")
      : cancelScheduled && period
        ? t(
            stoppedNoCard ? "line.stoppedNoCardAdmin" : "line.cancelScheduled",
            {
              end: (stoppedNoCard
                ? format.date(period.end)
                : format.dateTime(period.end)
              ).replaceAll(" ", "\u00a0"),
            }
          )
        : billing.status === "ACTIVE" && period && (amount || !isAdmin)
          ? amount
            ? t("line.next", { date: format.date(period.end), amount })
            : t("line.nextDate", { date: format.date(period.end) })
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
          <p className="mt-3 text-sm leading-5 text-pretty text-[var(--el-body)]">
            {line}
          </p>
        ) : null}
        {isAdmin && (billing.detail?.methodId || stoppedNoCard) ? (
          <button
            type="button"
            onClick={onOpenPayment}
            className="mt-4 inline-flex items-center gap-1 self-start text-sm text-[var(--el-muted)] underline-offset-4 hover:text-[var(--el-ink)] hover:underline"
          >
            {t(stoppedNoCard ? "registerCard" : "openPayment")}
            <ArrowRight className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <RecordingUsage
        workspaceId={workspaceId}
        paid={planCode === "PRO"}
        className={PANEL_SIDE}
      />
    </div>
  );
}

const FEATURES = [
  "liveNotes",
  "speakers",
  "links",
  "agentChat",
  "mcp",
] as const;

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
  const actions = billing.allowedActions;
  const canStart = actions.includes("START_PURCHASE") && !isPaid;
  const salesPaused =
    !canStart &&
    (billing.status === "FREE" || billing.status === "ENDED") &&
    !actions.includes("CONTINUE_SETUP") &&
    !billingInProgress(billing) &&
    !billing.teamSetupInProgress &&
    !refundPending(billing.detail?.refundedAttempt?.refundStatus);
  const salesNoticeShown =
    Boolean(product) && !isPaid && isAdmin && salesPaused;
  const workspaceId = billing.workspaceId;
  useEffect(() => {
    if (salesNoticeShown)
      billingEvents.salesUnavailableViewed(workspaceId, "admin");
  }, [salesNoticeShown, workspaceId]);
  if (!product) return null;
  return (
    <section aria-label={t("compare")}>
      <h3 className="text-sm font-medium text-[var(--el-ink)]">
        {t("compare")}
      </h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <PlanCard
          name={planName("FREE")}
          price={t("plan.freePrice")}
          tagline={t("plan.freeTagline")}
          highlight={t("plan.recording", {
            allowance: format.monthlyMinutes(
              product.freeRecordingAllowanceMinutes
            ),
          })}
          current={!isPaid}
        />
        <PlanCard
          featured
          name={planName(product.planCode)}
          price={format.money(product.amountKrw)}
          per={t("plan.perMonth")}
          tagline={t("plan.proTagline")}
          highlight={format.allowance(product.recordingAllowanceMinutes)}
          current={isPaid}
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
            ) : salesPaused ? (
              <p className="text-sm leading-5 text-white/70">
                {t("salesPaused")}
              </p>
            ) : null
          }
        />
      </div>
      <IncludedInBoth />
      <div className="mt-3 grid gap-1 text-xs leading-5 text-[var(--el-muted)]">
        <p>{t("plan.footWorkspace")}</p>
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
  tagline,
  highlight,
  current,
  featured,
  footer,
}: {
  name: string;
  price: string;
  per?: string;
  tagline: string;
  highlight: string;
  current: boolean;
  featured?: boolean;
  footer?: ReactNode;
}) {
  const t = useTranslations("billing.page");
  return (
    <div
      aria-current={current || undefined}
      className={cn(
        "flex flex-col rounded-panel border p-6",
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
      <p
        className={cn(
          "mt-2 text-sm leading-5",
          featured ? "text-white/70" : "text-[var(--el-muted)]"
        )}
      >
        {tagline}
      </p>
      <p
        className={cn(
          "mt-5 flex items-start gap-2 text-sm leading-5 font-medium",
          featured ? "text-white" : "text-[var(--el-ink)]"
        )}
      >
        <Check
          className={cn(
            "mt-0.5 size-4 shrink-0",
            featured ? "text-white/60" : "text-[var(--el-muted)]"
          )}
          aria-hidden
        />
        <span>{highlight}</span>
      </p>
      {footer ? <div className="mt-auto pt-6">{footer}</div> : null}
    </div>
  );
}

function IncludedInBoth() {
  const t = useTranslations("billing.page");
  const items = [
    t("plan.members"),
    ...FEATURES.map((key) => t(`plan.features.${key}`)),
  ];
  return (
    <div className="mt-4 rounded-panel border border-[var(--el-hairline)] px-6 py-5">
      <p className="text-xs text-[var(--el-muted)]">{t("plan.includes")}</p>
      <ul className="mt-3 grid gap-x-6 gap-y-2.5 text-sm leading-5 text-[var(--el-body)] sm:grid-cols-2">
        {items.map((text) => (
          <li key={text} className="flex items-start gap-2">
            <Check
              className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]"
              aria-hidden
            />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function attentionFlagsOf(billing: Billing) {
  const pastDue = billing.status === "PAST_DUE";
  const replacing = billing.status === "ACTIVE" || pastDue;
  const renewalWait =
    billing.entitlement?.kind === "RENEWAL_PENDING" && !pastDue;
  const checking =
    !renewalWait &&
    (billing.latestAttemptStatus === "PENDING" ||
      billing.latestAttemptStatus === "PROCESSING" ||
      billing.latestAttemptStatus === "UNKNOWN");
  return { pastDue, replacing, renewalWait, checking };
}

function useAttentionNotices(billing: Billing) {
  const t = useTranslations("billing.page");
  const { checking } = attentionFlagsOf(billing);
  const detail = billing.detail;
  const refundAttempt = detail?.latestAttempt?.refundStatus
    ? detail.latestAttempt
    : detail?.refundedAttempt;
  const refund = refundAttempt?.refundStatus;
  const userRefund =
    detail?.refundedAttempt?.refundOrigin === "OPERATOR"
      ? detail.refundedAttempt.refundStatus
      : null;
  const compensation = userRefund ? null : refund;
  const userRefundAttempt = detail?.refundedAttempt;
  const userRefundKey =
    userRefundAttempt?.attemptId === detail?.currentPaymentId
      ? ({ pending: "userRefunding", failed: "userRefundFailed" } as const)
      : ({
          pending: "userPastRefunding",
          failed: "userPastRefundFailed",
        } as const);

  return [
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
    compensation === "FAILED" && refundAttempt ? (
      <BillingNotice
        key="refundFailed"
        tone="warn"
        title={t("refundFailed.title")}
      >
        {t.rich("refundFailed.body", {
          link: (chunks) => (
            <FeedbackLink
              reference={{ type: "payment", id: refundAttempt.attemptId }}
            >
              {chunks}
            </FeedbackLink>
          ),
        })}
      </BillingNotice>
    ) : null,
    refundPending(userRefund) ? (
      <BillingNotice
        key="userRefunding"
        title={t(`${userRefundKey.pending}.title`)}
      >
        {t(`${userRefundKey.pending}.body`)}
      </BillingNotice>
    ) : null,
    userRefund === "SUCCEEDED" && billing.status === "ENDED" ? (
      <BillingNotice key="userRefunded" title={t("userRefunded.title")}>
        {t("userRefunded.body")}
      </BillingNotice>
    ) : null,
    billing.status === "ENDED" &&
    billing.closedReason &&
    !(billing.closedReason === "REFUNDED" && userRefund === "SUCCEEDED") ? (
      <BillingNotice key="closed">
        {t(`closed.${billing.closedReason}`)}
      </BillingNotice>
    ) : null,
    userRefund === "FAILED" && userRefundAttempt ? (
      <BillingNotice
        key="userRefundFailed"
        tone="warn"
        title={t(`${userRefundKey.failed}.title`)}
      >
        {t.rich(`${userRefundKey.failed}.body`, {
          link: (chunks) => (
            <FeedbackLink
              reference={{ type: "payment", id: userRefundAttempt.attemptId }}
            >
              {chunks}
            </FeedbackLink>
          ),
        })}
      </BillingNotice>
    ) : null,
  ].filter(Boolean);
}

function Attention({
  workspaceId,
  billing,
  isAdmin,
  onRestartPolling,
  onCheckout,
}: {
  workspaceId: string;
  billing: Billing;
  isAdmin: boolean;
  onRestartPolling: () => void;
  onCheckout: () => void;
}) {
  const t = useTranslations("billing.page");
  const queryClient = useQueryClient();
  const cancel = useCancelBillingSetup();
  const [cardChange, setCardChange] = useState(false);
  const actions = billing.allowedActions;
  const { pastDue, replacing, renewalWait } = attentionFlagsOf(billing);
  const detail = billing.detail;

  const cancelSetup = async () => {
    if (!billing.mySetupId) return;
    await cancel
      .mutateAsync({ workspaceId, setupId: billing.mySetupId })
      .then(() => invalidateWorkspaceBilling(queryClient, workspaceId))
      .catch(() => undefined);
  };

  const notices = useAttentionNotices(billing);

  const continuing =
    Boolean(billing.mySetupId) && actions.includes("CONTINUE_SETUP");
  const buttons = isAdmin
    ? [
        pastDue && actions.includes("CHANGE_CARD") && !continuing ? (
          <Button
            key="reRegister"
            onClick={() => {
              billingEvents.cardChangeStarted(workspaceId);
              setCardChange(true);
            }}
          >
            {t("reRegisterCard")}
          </Button>
        ) : null,
        billing.mySetupId && actions.includes("CONTINUE_SETUP") ? (
          <Button
            key="continue"
            onClick={() => (replacing ? setCardChange(true) : onCheckout())}
          >
            {t("continueSetup")}
          </Button>
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
        actions.includes("REFRESH_STATUS") && !renewalWait ? (
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
      <CardChangeDialog
        workspaceId={workspaceId}
        open={cardChange}
        register={!detail?.methodId}
        onClose={() => setCardChange(false)}
      />
    </div>
  );
}
