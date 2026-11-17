"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, CreditCard } from "lucide-react";
import { useState, type ReactNode } from "react";

import { BillingNotice } from "@/components/billing/billing-parts";
import {
  SETTINGS_CARD,
  SETTINGS_CARD_ICON,
  SETTINGS_LIST,
} from "@/components/settings/settings-layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetBillingPayment } from "@/lib/api/generated/billing/billing";
import type {
  BillingPaymentResponseData,
  WorkspaceBillingResponseData,
} from "@/lib/api/generated/models";
import { okData } from "@/lib/api/ok-data";
import { billingEvents } from "@/lib/billing/analytics";
import { paymentStatusOf, refundPending } from "@/lib/billing/payment-status";
import { planName } from "@/lib/billing/plan-name";
import {
  useBillingCommands,
  type CommandNotice,
} from "@/lib/billing/use-billing-commands";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { usePollWindow } from "@/lib/billing/use-poll-window";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

type Billing = WorkspaceBillingResponseData;
type Dialog = "cancel" | "resume" | "delete" | null;

export function hasSubscriptionToManage(billing: Billing) {
  return Boolean(
    billing.detail &&
    (billing.status === "ACTIVE" ||
      billing.status === "PAST_DUE" ||
      billing.detail.methodId)
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-sm font-medium text-[var(--el-ink)]">
      {children}
    </h3>
  );
}

export function SubscriptionManagement({
  workspaceId,
  billing,
  onChangeCard,
  onOpenPayment,
}: {
  workspaceId: string;
  billing: Billing;
  onChangeCard: () => void;
  onOpenPayment: (paymentId: string) => void;
}) {
  const t = useTranslations("billing.manage");
  const format = useBillingFormat();
  const commands = useBillingCommands(workspaceId);
  const [dialog, setDialog] = useState<Dialog>(null);
  const detail = billing.detail!;
  const actions = billing.allowedActions;
  const product = billing.product;
  const period = billing.currentPeriod;
  const amount = product ? format.money(product.amountKrw) : null;
  const nextAmount =
    detail.nextChargeAmountKrw != null
      ? format.money(detail.nextChargeAmountKrw)
      : null;
  const masked = detail.maskedCard;
  const cardName = [masked?.issuer, masked?.cardType].filter(Boolean).join(" ");

  const paymentId = detail.currentPaymentId;
  const poll = usePollWindow();
  const latest = useGetBillingPayment(workspaceId, paymentId ?? "", {
    query: {
      enabled: Boolean(paymentId),
      staleTime: 0,
      refetchInterval: (query) =>
        !poll.expired && refundPending(okData(query.state.data)?.refundStatus)
          ? 5000
          : false,
    },
  });
  const payment = paymentId ? okData(latest.data) : null;

  const close = (outcome: "done" | "handled" | "failed") => {
    if (outcome !== "failed") setDialog(null);
  };
  const busy = commands.pending;
  const pastDueEnd =
    billing.status === "PAST_DUE" ? billing.pastDueEndsAt : null;
  const subscribed = billing.status === "ACTIVE" || Boolean(pastDueEnd);
  const renewalPending =
    billing.entitlement?.kind === "RENEWAL_PENDING" && !pastDueEnd;
  const live = billing.status === "ACTIVE" && !billing.cancelAtPeriodEnd;
  const next = !live
    ? null
    : renewalPending
      ? t("nextChargeChecking")
      : period
        ? nextAmount
          ? t("nextChargeValue", {
              date: format.date(period.end),
              amount: nextAmount,
            })
          : format.date(period.end)
        : null;
  const canCancel = actions.includes("CANCEL_SUBSCRIPTION");
  const canResume = actions.includes("RESUME_SUBSCRIPTION");
  const scheduled =
    billing.cancelAtPeriodEnd &&
    billing.status === "ACTIVE" &&
    (renewalPending || period);
  const stopped = scheduled && !detail.methodId;

  return (
    <>
      <section aria-label={t("methodTitle")}>
        <SectionTitle>{t("methodTitle")}</SectionTitle>
        <div className={cn(SETTINGS_CARD, "flex items-center gap-3")}>
          <span
            className={cn(
              SETTINGS_CARD_ICON,
              "mt-0 bg-[var(--el-surface-strong)] text-[var(--el-ink)]"
            )}
          >
            <CreditCard className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            {masked?.number || cardName ? (
              <>
                <p className="truncate text-sm font-medium text-[var(--el-ink)]">
                  {cardName || t("card")}
                </p>
                {masked?.number ? (
                  <p className="mt-0.5 font-mono text-xs text-[var(--el-muted)]">
                    {masked.number}
                  </p>
                ) : null}
                {detail.methodId && detail.methodPayerIsMe === false ? (
                  <p className="mt-0.5 text-xs text-[var(--el-muted)]">
                    {t("cardByOtherAdmin")}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--el-muted)]">{t("noCard")}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {actions.includes("CHANGE_CARD") ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onChangeCard}
              >
                {detail.methodId ? t("changeCard") : t("registerCard")}
              </Button>
            ) : null}
            {actions.includes("DELETE_PAYMENT_METHOD") && detail.methodId ? (
              <Button
                variant="ghost"
                size="sm"
                loading={commands.removePending}
                disabled={busy}
                onClick={() => setDialog("delete")}
              >
                {t("deleteMethod")}
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {subscribed || paymentId ? (
        <section aria-label={t("title")}>
          <SectionTitle>{t("title")}</SectionTitle>
          <div className={SETTINGS_LIST}>
            <dl className="divide-y divide-[var(--el-hairline)] text-sm">
              {product && subscribed ? (
                <Row
                  label={t("plan")}
                  value={t("planValue", {
                    plan: planName(product.planCode),
                    amount: amount!,
                  })}
                />
              ) : null}
              {billing.status === "ACTIVE" ? (
                <Row
                  label={t("nextCharge")}
                  value={next ?? t("noNextCharge")}
                />
              ) : null}
              {paymentId ? (
                <Row
                  label={t("latestPayment")}
                  value={
                    payment ? (
                      <button
                        type="button"
                        onClick={() => onOpenPayment(paymentId)}
                        className="group -mr-1.5 inline-flex items-center gap-2 rounded-control py-0.5 pr-0.5 pl-1.5 hover:bg-[var(--el-surface-strong)]"
                      >
                        <span className="whitespace-nowrap">
                          {payment.completedAt
                            ? t("latestPaymentValue", {
                                date: format.date(payment.completedAt),
                                amount: format.money(payment.amountKrw),
                              })
                            : format.money(payment.amountKrw)}
                        </span>
                        <PaymentStatusText payment={payment} />
                        <span className="sr-only">{t("paymentLink")}</span>
                        <ChevronRight
                          className="size-4 text-[var(--el-muted)]"
                          aria-hidden
                        />
                      </button>
                    ) : (
                      <Skeleton className="inline-block h-4 w-40 align-middle" />
                    )
                  }
                />
              ) : null}
            </dl>
            {canCancel || canResume || scheduled ? (
              <div className="flex min-h-[52px] items-center justify-between gap-4 bg-[var(--el-canvas-soft)] px-4 py-2.5">
                <p className="text-xs leading-5 text-[var(--el-muted)]">
                  {scheduled
                    ? renewalPending || !period
                      ? t("cancelScheduledPending")
                      : stopped
                        ? t("stoppedNoCard", { end: format.date(period.end) })
                        : t("cancelScheduled", {
                            end: format.dateTime(period.end),
                          })
                    : pastDueEnd
                      ? t("pastDueHint", {
                          end: format.dateTime(pastDueEnd),
                        })
                      : period && !renewalPending
                        ? t("cancelHint", { end: format.date(period.end) })
                        : null}
                </p>
                {canResume ? (
                  <Button
                    size="sm"
                    className="shrink-0"
                    loading={commands.resumePending}
                    disabled={busy}
                    onClick={() => setDialog("resume")}
                  >
                    {t("resume")}
                  </Button>
                ) : canCancel ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    loading={commands.cancelPending}
                    disabled={busy}
                    onClick={() => {
                      billingEvents.cancelDialogOpened(workspaceId);
                      setDialog("cancel");
                    }}
                  >
                    {t("cancel")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          {commands.notice ? (
            <div className="mt-3">
              <NoticeLine notice={commands.notice} billing={billing} />
            </div>
          ) : null}
        </section>
      ) : commands.notice ? (
        <NoticeLine notice={commands.notice} billing={billing} />
      ) : null}

      {pastDueEnd || renewalPending || (period && amount) ? (
        <Confirm
          open={dialog === "cancel"}
          onOpenChange={(open) => !busy && setDialog(open ? "cancel" : null)}
          title={t("cancelDialog.title")}
          lines={
            pastDueEnd
              ? [t("cancelDialog.pastDue")]
              : renewalPending || !period || !amount
                ? [t("cancelDialog.pending")]
                : [
                    t("cancelDialog.until", {
                      end: format.dateTime(period.end),
                    }),
                    t("cancelDialog.noCharge", {
                      amount: nextAmount ?? amount,
                    }),
                    t("cancelDialog.undo", { end: format.date(period.end) }),
                  ]
          }
          cancelLabel={t("cancelDialog.keep")}
          confirmLabel={t("cancelDialog.confirm")}
          destructive
          pending={commands.cancelPending}
          onConfirm={async () =>
            close(await commands.cancelSubscription(detail.subscriptionVersion))
          }
        />
      ) : null}
      {period ? (
        <Confirm
          open={dialog === "resume"}
          onOpenChange={(open) => !busy && setDialog(open ? "resume" : null)}
          title={t("resumeDialog.title")}
          lines={[
            t("resumeDialog.noChargeNow"),
            nextAmount
              ? t("resumeDialog.next", {
                  date: format.date(period.end),
                  amount: nextAmount,
                })
              : t("resumeDialog.nextDate", { date: format.date(period.end) }),
          ]}
          confirmLabel={t("resumeDialog.confirm")}
          pending={commands.resumePending}
          onConfirm={async () =>
            close(await commands.resumeSubscription(detail.subscriptionVersion))
          }
        />
      ) : null}
      {detail.methodId ? (
        <Confirm
          open={dialog === "delete"}
          onOpenChange={(open) => !busy && setDialog(open ? "delete" : null)}
          title={t("deleteDialog.title")}
          lines={[t("deleteDialog.body"), t("deleteDialog.after")]}
          confirmLabel={t("deleteDialog.confirm")}
          destructive
          pending={commands.removePending}
          onConfirm={async () => {
            const outcome = await commands.deleteMethod(detail.methodId!);
            if (outcome === "done") toast.success(t("notice.deleted"));
            close(outcome);
          }}
        />
      ) : null}
    </>
  );
}

function NoticeLine({
  notice,
  billing,
}: {
  notice: CommandNotice | null;
  billing?: Billing;
}) {
  const t = useTranslations("billing.manage.notice");
  const format = useBillingFormat();
  if (!notice) return null;
  const period = billing?.currentPeriod;
  const next = billing?.detail?.nextChargeAmountKrw;
  const amount = next != null ? format.money(next) : null;
  switch (notice.kind) {
    case "canceled":
      return period && billing?.entitlement?.kind !== "RENEWAL_PENDING" ? (
        <BillingNotice>
          {t("canceled", { end: format.date(period.end) })}
        </BillingNotice>
      ) : null;
    case "resumed":
      return period ? (
        <BillingNotice>
          {amount
            ? t("resumed", { date: format.date(period.end), amount })
            : t("resumedDate", { date: format.date(period.end) })}
        </BillingNotice>
      ) : null;
    default:
      return <BillingNotice tone="warn">{t(notice.kind)}</BillingNotice>;
  }
}

const STATUS_DOT: Record<ReturnType<typeof paymentStatusOf>, string> = {
  SUCCEEDED: "bg-[var(--el-success)]",
  FAILED: "bg-[var(--el-error)]",
  CHECKING: "bg-[var(--el-muted-soft)]",
  REFUNDED: "bg-[var(--el-muted-soft)]",
  REFUNDING: "bg-[var(--el-muted-soft)]",
  REFUND_FAILED: "bg-[var(--el-error)]",
};

export function PaymentStatusText({
  payment,
}: {
  payment: Pick<BillingPaymentResponseData, "status" | "refundStatus">;
}) {
  const t = useTranslations("billing.paymentStatus");
  const status = paymentStatusOf(payment);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[var(--el-body)]">
      <span
        className={cn("size-1.5 rounded-full", STATUS_DOT[status])}
        aria-hidden
      />
      {t(status)}
    </span>
  );
}

function Confirm({
  open,
  onOpenChange,
  title,
  lines,
  cancelLabel,
  confirmLabel,
  destructive,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  lines: (string | null)[];
  cancelLabel?: string;
  confirmLabel: string;
  destructive?: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  const tActions = useTranslations("common.actions");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-balance">{title}</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            <ul className="grid gap-1.5">
              {lines.filter(Boolean).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel ?? tActions("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            loading={pending}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 text-[var(--el-muted)]">{label}</dt>
      <dd className="text-right text-[var(--el-ink)]">{value}</dd>
    </div>
  );
}
