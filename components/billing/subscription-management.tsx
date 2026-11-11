"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { BillingNotice } from "@/components/billing/billing-parts";
import { BillingSection } from "@/components/billing/billing-screen";
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
import { Button, LinkButton } from "@/components/ui/button";
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
import { toast } from "@/lib/ui/toast";

type Billing = WorkspaceBillingResponseData;
type Dialog = "cancel" | "resume" | "refund" | "delete" | null;

/** 관리할 구독이 있는가 — 유료·미납이거나, 끝났어도 지울 카드가 남았다. 상세(ADMIN)가 있을 때만이다. */
export function hasSubscriptionToManage(billing: Billing) {
  return Boolean(
    billing.detail &&
    (billing.status === "ACTIVE" ||
      billing.status === "PAST_DUE" ||
      billing.detail.methodId)
  );
}

/**
 * 요금제 화면의 「구독 관리」(APP-1565). 다음 결제(날짜·금액)·카드·최근 결제와 그 행동을 한 카드에 둔다. 이용 기간·제공량은
 * 바로 위 「현재 상태」가 적으므로 여기서 다시 적지 않는다.
 * **버튼을 보일지는 서버의 `allowedActions` 로만 정한다** — 화면이 조건을 다시 계산하지 않는다. 위험한 행동(해지·환불·카드 삭제)은
 * 확인 창에서 날짜·금액으로 결과를 적은 뒤 실행한다. 결과 안내는 사라지면 안 돼 자리에 둔다.
 */
export function SubscriptionManagement({
  workspaceId,
  billing,
}: {
  workspaceId: string;
  billing: Billing;
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
  const card = format.card(detail.maskedCard);

  // 최근 결제 한 건. 요약과 환불 금액이 이 조회에서 온다 — 환불 본문의 금액은 상품 가격이 아니라 그 결제의 금액이다.
  const paymentId = detail.currentPaymentId;
  const latest = useGetBillingPayment(workspaceId, paymentId ?? "", {
    query: {
      enabled: Boolean(paymentId),
      staleTime: 0,
      refetchInterval: (query) =>
        refundPending(okData(query.state.data)?.refundStatus) ? 5000 : false,
    },
  });
  const payment = paymentId ? okData(latest.data) : null;

  const close = (outcome: "done" | "handled" | "failed") => {
    if (outcome !== "failed") setDialog(null);
  };
  const busy = commands.pending;
  const next =
    billing.status === "ACTIVE" &&
    !billing.cancelAtPeriodEnd &&
    period &&
    amount
      ? t("nextChargeValue", { date: format.date(period.end), amount })
      : null;

  return (
    <BillingSection title={t("title")}>
      <div className="flex flex-col gap-4">
        <div className="rounded-panel border border-[var(--el-hairline)] bg-white p-5">
          <dl className="grid gap-2.5 text-sm">
            {product &&
            (billing.status === "ACTIVE" || billing.status === "PAST_DUE") ? (
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
                note={
                  billing.cancelAtPeriodEnd && period
                    ? t("cancelScheduled", { end: format.date(period.end) })
                    : undefined
                }
              />
            ) : null}
            <Row label={t("card")} value={card ?? t("noCard")} />
            {paymentId ? (
              <Row
                label={t("latestPayment")}
                value={
                  payment ? (
                    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-3">
                      <span className="whitespace-nowrap">
                        {payment.completedAt
                          ? t("latestPaymentValue", {
                              date: format.date(payment.completedAt),
                              amount: format.money(payment.amountKrw),
                            })
                          : format.money(payment.amountKrw)}
                      </span>
                      <PaymentStatusText payment={payment} />
                      <Link
                        href={`/w/${workspaceId}/billing/payments/${paymentId}`}
                        className="whitespace-nowrap underline underline-offset-4"
                      >
                        {t("paymentLink")}
                      </Link>
                    </span>
                  ) : (
                    <Skeleton className="inline-block h-4 w-40 align-middle" />
                  )
                }
              />
            ) : null}
          </dl>
        </div>

        {billing.cancelAtPeriodEnd &&
        !actions.includes("RESUME_SUBSCRIPTION") &&
        !detail.methodPayerIsMe ? (
          <p className="text-sm text-[var(--el-muted)]">{t("notPayerHint")}</p>
        ) : null}

        <NoticeLine notice={commands.notice} billing={billing} />

        <div className="flex flex-wrap items-center gap-2">
          {actions.includes("RESUME_SUBSCRIPTION") ? (
            <Button
              loading={commands.resumePending}
              disabled={busy}
              onClick={() => setDialog("resume")}
            >
              {t("resume")}
            </Button>
          ) : null}
          {actions.includes("CHANGE_CARD") ? (
            <LinkButton
              href={`/w/${workspaceId}/billing/card`}
              variant="outline"
            >
              {t("changeCard")}
            </LinkButton>
          ) : null}
          {actions.includes("CANCEL_SUBSCRIPTION") ? (
            <Button
              variant="outline"
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
          {actions.includes("REQUEST_REFUND") && payment ? (
            <Button
              variant="outline"
              loading={commands.refundPending}
              disabled={busy}
              onClick={() => setDialog("refund")}
            >
              {t("refund")}
            </Button>
          ) : null}
          {actions.includes("DELETE_PAYMENT_METHOD") && detail.methodId ? (
            <Button
              variant="outline"
              loading={commands.removePending}
              disabled={busy}
              onClick={() => setDialog("delete")}
            >
              {t("deleteMethod")}
            </Button>
          ) : null}
        </div>
      </div>

      {period && amount ? (
        <Confirm
          open={dialog === "cancel"}
          onOpenChange={(open) => !busy && setDialog(open ? "cancel" : null)}
          title={t("cancelDialog.title")}
          lines={[
            t("cancelDialog.until", { end: format.date(period.end) }),
            t("cancelDialog.noCharge", { amount }),
            t("cancelDialog.undo", { end: format.date(period.end) }),
          ]}
          cancelLabel={t("cancelDialog.keep")}
          confirmLabel={t("cancelDialog.confirm")}
          destructive
          pending={commands.cancelPending}
          onConfirm={async () =>
            close(await commands.cancelSubscription(detail.subscriptionVersion))
          }
        />
      ) : null}
      {period && amount ? (
        <Confirm
          open={dialog === "resume"}
          onOpenChange={(open) => !busy && setDialog(open ? "resume" : null)}
          title={t("resumeDialog.title")}
          lines={[
            t("resumeDialog.noChargeNow"),
            t("resumeDialog.next", { date: format.date(period.end), amount }),
          ]}
          confirmLabel={t("resumeDialog.confirm")}
          pending={commands.resumePending}
          onConfirm={async () =>
            close(await commands.resumeSubscription(detail.subscriptionVersion))
          }
        />
      ) : null}
      {payment ? (
        <RefundConfirm
          open={dialog === "refund"}
          onOpenChange={(open) => !busy && setDialog(open ? "refund" : null)}
          payment={payment}
          pending={commands.refundPending}
          onConfirm={async () =>
            close(
              await commands.requestRefund({
                paymentId: payment.paymentId,
                amountKrw: payment.amountKrw,
                expectedVersion: detail.subscriptionVersion,
              })
            )
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
    </BillingSection>
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
  const amount = billing?.product
    ? format.money(billing.product.amountKrw)
    : null;
  switch (notice.kind) {
    case "refundNotAllowed":
      return <BillingNotice tone="warn">{notice.message}</BillingNotice>;
    case "canceled":
      return period ? (
        <BillingNotice>
          {t("canceled", { end: format.date(period.end) })}
        </BillingNotice>
      ) : null;
    case "resumed":
      return period && amount ? (
        <BillingNotice>
          {t("resumed", { date: format.date(period.end), amount })}
        </BillingNotice>
      ) : null;
    default:
      return <BillingNotice tone="warn">{t(notice.kind)}</BillingNotice>;
  }
}

export function PaymentStatusText({
  payment,
}: {
  payment: Pick<BillingPaymentResponseData, "status" | "refundStatus">;
}) {
  const t = useTranslations("billing.paymentStatus");
  return (
    <span className="whitespace-nowrap text-[var(--el-muted)]">
      {t(paymentStatusOf(payment))}
    </span>
  );
}

/** 환불 확인 창. 결제 상세에서도 쓴다. 금액·결제일을 적고, 다음 결제가 멈추고 권한이 사라지며 되돌릴 수 없다는 것을 적는다. */
export function RefundConfirm({
  open,
  onOpenChange,
  payment,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: BillingPaymentResponseData;
  pending: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations("billing.manage.refundDialog");
  const format = useBillingFormat();
  const amount = format.money(payment.amountKrw);
  return (
    <Confirm
      open={open}
      onOpenChange={onOpenChange}
      title={t("title", { amount })}
      lines={[
        payment.completedAt
          ? t("amount", { date: format.date(payment.completedAt), amount })
          : null,
        t("stop"),
        t("access"),
        t("final"),
      ]}
      confirmLabel={t("confirm")}
      destructive
      pending={pending}
      onConfirm={onConfirm}
    />
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

function Row({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-[var(--el-muted)]">{label}</dt>
      <dd className="text-right text-[var(--el-ink)]">
        <span className="whitespace-nowrap">{value}</span>
        {note ? (
          <span className="mt-0.5 block text-[var(--el-muted)]">{note}</span>
        ) : null}
      </dd>
    </div>
  );
}
