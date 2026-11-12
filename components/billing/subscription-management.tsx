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

/** 관리할 구독이 있는가 — 유료이거나, 끝났어도 지울 카드가 남았다. 상세(ADMIN)가 있을 때만이다. */
export function hasSubscriptionToManage(billing: Billing) {
  return Boolean(
    billing.detail && (billing.status === "ACTIVE" || billing.detail.methodId)
  );
}

/** 설정 탭 안의 영역 제목. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-sm font-medium text-[var(--el-ink)]">
      {children}
    </h3>
  );
}

/**
 * 설정 › 결제 관리의 「결제 수단」과 「구독」(APP-1565). 카드 한 줄과, 요금제·다음 결제·최근 결제를 한 목록에 둔다.
 * **버튼을 보일지는 서버의 `allowedActions` 로만 정한다** — 화면이 조건을 다시 계산하지 않는다. 위험한 행동(해지·카드 삭제)은
 * 확인 창에서 날짜·금액으로 결과를 적은 뒤 실행한다. 결과 안내는 사라지면 안 돼 자리에 둔다.
 */
export function SubscriptionManagement({
  workspaceId,
  billing,
  onChangeCard,
  onOpenPayment,
}: {
  workspaceId: string;
  billing: Billing;
  /** 카드 변경 화면으로. */
  onChangeCard: () => void;
  /** 그 결제의 상세로. */
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
  // 다음 갱신이 실제로 청구할 금액(APP-1596). 직전 회차의 동의 금액이라 지금 상품가와 다를 수 있고, 다음 결제가 없으면 null 이다 —
  // 그때는 금액을 빼고 날짜만 말한다.
  const nextAmount =
    detail.nextChargeAmountKrw != null
      ? format.money(detail.nextChargeAmountKrw)
      : null;
  const masked = detail.maskedCard;
  const cardName = [masked?.issuer, masked?.cardType].filter(Boolean).join(" ");

  // 최근 결제 한 건의 요약.
  const paymentId = detail.currentPaymentId;
  // 환불 진행 중 다시 읽기는 요금제 탭과 같은 2분 창에서만 한다.
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
  const subscribed = billing.status === "ACTIVE";
  // 갱신 결제 결과를 기다리는 동안은 기간 끝이 이미 지났다 — 끝나는 날을 말하지 않고, 결과에 따라 정해진다고 말한다.
  const renewalPending = billing.entitlement?.kind === "RENEWAL_PENDING";
  const live = billing.status === "ACTIVE" && !billing.cancelAtPeriodEnd;
  // 대기 중의 「다음 결제」는 지금 확인하고 있는 그 결제다. 지난 날짜를 다음 결제일로 보이지 않는다.
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
  // 종료 예정인데 카드가 없다 — 결제자가 빠졌거나 해지 뒤 카드를 지웠다. 어느 쪽인지는 단정하지 않는다(APP-1588).
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
                      : t(stopped ? "stoppedNoCard" : "cancelScheduled", {
                          end: format.date(period.end),
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

      {renewalPending || (period && amount) ? (
        <Confirm
          open={dialog === "cancel"}
          onOpenChange={(open) => !busy && setDialog(open ? "cancel" : null)}
          title={t("cancelDialog.title")}
          lines={
            renewalPending || !period || !amount
              ? [t("cancelDialog.pending")]
              : [
                  t("cancelDialog.until", { end: format.date(period.end) }),
                  t("cancelDialog.noCharge", { amount: nextAmount ?? amount }),
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
            // 카드가 없어지면 이 영역이 통째로 사라져 자리 안내를 볼 수 없다 — 짧은 완료 알림으로 알린다.
            if (outcome === "done") toast.success(t("notice.deleted"));
            close(outcome);
          }}
        />
      ) : null}
    </>
  );
}

/** 명령 결과 안내. 성공은 담담하게, 막힌 이유는 경고로. 날짜·금액은 다시 읽은 최신 상태에서 쓴다. */
export function NoticeLine({
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
  // 재개 뒤 다시 읽은 다음 결제 금액. 없으면 날짜만 말한다.
  const next = billing?.detail?.nextChargeAmountKrw;
  const amount = next != null ? format.money(next) : null;
  switch (notice.kind) {
    case "canceled":
      // 갱신 결과 대기 중에는 아래 상태 줄이 예약을 알린다 — 지난 기간 끝 날짜를 말하지 않는다.
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

/** 결제 상태 — 색 점과 글. 색만으로 뜻을 전하지 않는다. */
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
