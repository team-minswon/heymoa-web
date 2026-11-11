"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { BillingNotice } from "@/components/billing/billing-parts";
import {
  BillingScreen,
  BillingSection,
} from "@/components/billing/billing-screen";
import {
  NoticeLine,
  PaymentStatusText,
  RefundConfirm,
} from "@/components/billing/subscription-management";
import { Button, LinkButton } from "@/components/ui/button";
import { DataBoundary } from "@/components/ui/data-boundary";
import { InlineRetry } from "@/components/ui/inline-retry";
import { Skeleton } from "@/components/ui/skeleton";
import { FeedbackDialog } from "@/components/workspace/feedback-dialog";
import { useGetBillingPayment } from "@/lib/api/generated/billing/billing";
import type { BillingPaymentResponseData } from "@/lib/api/generated/models";
import { ApiError } from "@/lib/api/fetcher";
import { okData } from "@/lib/api/ok-data";
import { billingEvents } from "@/lib/billing/analytics";
import { refundPending } from "@/lib/billing/payment-status";
import {
  useBillingCommands,
  useRefundResultEvent,
} from "@/lib/billing/use-billing-commands";
import { useBillingFormat } from "@/lib/billing/use-billing-format";
import { useWorkspaceBilling } from "@/lib/billing/use-workspace-billing";

/**
 * `/w/{workspaceId}/billing/payments/{paymentId}` — 공간 결제 한 건(ADMIN). 금액·기간·상태·카드·환불 상태와 출처를 보인다.
 * 환불됐거나 기간이 끝난 옛 결제는 「당시 결과」와 「현재 상태」를 갈라 적는다 — 옛 성공을 지금 권한처럼 읽히게 하지 않는다.
 * 환불 버튼은 서버가 `REQUEST_REFUND` 를 주고 이 결제가 지금 유료 기간의 결제일 때만이다.
 */
export function BillingPaymentPage({
  workspaceId,
  paymentId,
}: {
  workspaceId: string;
  paymentId: string;
}) {
  const t = useTranslations("billing.payment");
  useEffect(() => {
    billingEvents.paymentViewed(workspaceId);
  }, [workspaceId]);
  return (
    <BillingScreen title={t("title")} description={t("description")}>
      <DataBoundary
        resetKeys={[workspaceId, paymentId]}
        fallback={<PaymentSkeleton label={t("loading")} />}
      >
        <PaymentContent workspaceId={workspaceId} paymentId={paymentId} />
      </DataBoundary>
    </BillingScreen>
  );
}

const ROWS = 7;
function PaymentSkeleton({ label }: { label: string }) {
  const t = useTranslations("billing.payment");
  return (
    <BillingSection title={t("summary")}>
      <div
        aria-label={label}
        className="grid gap-3 rounded-panel border border-[var(--el-hairline)] bg-white p-5"
      >
        {Array.from({ length: ROWS }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full" />
        ))}
      </div>
    </BillingSection>
  );
}

function PaymentContent({
  workspaceId,
  paymentId,
}: {
  workspaceId: string;
  paymentId: string;
}) {
  const t = useTranslations("billing.payment");
  const billing = useWorkspaceBilling(workspaceId);
  // 404·403 을 화면이 그리고 취소 처리 중에는 다시 읽어서 suspense 조회가 아니다(rule `error-loading` 예외).
  const query = useGetBillingPayment(workspaceId, paymentId, {
    query: {
      staleTime: 0,
      retry: false,
      refetchInterval: (q) =>
        refundPending(okData(q.state.data)?.refundStatus) ? 5000 : false,
    },
  });
  const payment = okData(query.data);
  useRefundResultEvent(workspaceId, payment?.refundStatus);

  const back = (
    <LinkButton
      href={`/w/${workspaceId}/billing`}
      variant="outline"
      className="self-start"
    >
      {t("back")}
    </LinkButton>
  );
  if (query.isPending) return <PaymentSkeleton label={t("loading")} />;
  if (!payment) {
    const status = query.error instanceof ApiError ? query.error.status : null;
    return (
      <div className="flex flex-col gap-4">
        {status === 404 || status === 403 ? (
          <BillingNotice tone="warn">
            {status === 404 ? t("notFound") : t("askAdmin")}
          </BillingNotice>
        ) : (
          <InlineRetry
            onRetry={() => void query.refetch()}
            label={t("loadFailed")}
          />
        )}
        {back}
      </div>
    );
  }
  const current = billing.detail?.currentPaymentId === paymentId;
  return (
    <div className="flex flex-col gap-10">
      <BillingSection title={t("summary")}>
        <PaymentRows payment={payment} current={current} />
        <RefundArea
          workspaceId={workspaceId}
          payment={payment}
          refundable={
            current && billing.allowedActions.includes("REQUEST_REFUND")
          }
          expectedVersion={billing.detail?.subscriptionVersion ?? null}
        />
      </BillingSection>
      <div className="flex flex-col gap-4">
        {back}
        <TaxInvoiceLine />
      </div>
    </div>
  );
}

function PaymentRows({
  payment,
  current,
}: {
  payment: BillingPaymentResponseData;
  current: boolean;
}) {
  const t = useTranslations("billing.payment");
  const tStatus = useTranslations("billing.paymentStatus");
  const format = useBillingFormat();
  const card = format.card(payment.maskedCard);
  // 지금 기간의 결제가 아니거나 환불이 걸린 성공 결제는 그때의 결과와 지금을 따로 적는다.
  const now =
    payment.status !== "SUCCEEDED"
      ? null
      : payment.refundStatus === "SUCCEEDED"
        ? t("nowRefunded")
        : refundPending(payment.refundStatus)
          ? t("nowRefunding")
          : !current
            ? t("nowEnded")
            : null;
  return (
    <dl className="grid gap-3 rounded-panel border border-[var(--el-hairline)] bg-white p-5 text-sm">
      <Row label={t("workspace")} value={payment.workspaceName} />
      <Row label={t("kind")} value={t(`kindValue.${payment.kind}`)} />
      <Row label={t("amount")} value={format.money(payment.amountKrw)} />
      {payment.period ? (
        <Row label={t("period")} value={format.period(payment.period)} />
      ) : null}
      {payment.completedAt ? (
        <Row
          label={t("completedAt")}
          value={format.dateTime(payment.completedAt)}
        />
      ) : null}
      {now ? (
        <>
          <Row label={t("then")} value={t("thenPaid")} />
          <Row label={t("now")} value={now} wrap />
        </>
      ) : (
        <Row
          label={t("status")}
          value={
            <>
              <PaymentStatusText payment={payment} />
              {payment.errorCode ? (
                <span className="mt-0.5 block text-xs text-[var(--el-muted)]">
                  {t("errorCode", { code: payment.errorCode })}
                </span>
              ) : null}
            </>
          }
        />
      )}
      {card ? <Row label={t("card")} value={card} /> : null}
      {payment.refundStatus ? (
        <Row
          label={t("refund")}
          value={
            payment.refundOrigin
              ? t("refundValue", {
                  status: tStatus(
                    payment.refundStatus === "SUCCEEDED"
                      ? "REFUNDED"
                      : payment.refundStatus === "FAILED"
                        ? "REFUND_FAILED"
                        : "REFUNDING"
                  ),
                  origin: t(`origin.${payment.refundOrigin}`),
                })
              : tStatus("REFUNDING")
          }
        />
      ) : null}
    </dl>
  );
}

function RefundArea({
  workspaceId,
  payment,
  refundable,
  expectedVersion,
}: {
  workspaceId: string;
  payment: BillingPaymentResponseData;
  refundable: boolean;
  expectedVersion: number | null;
}) {
  const t = useTranslations("billing.manage");
  const commands = useBillingCommands(workspaceId);
  const [open, setOpen] = useState(false);
  if (!commands.notice && (!refundable || expectedVersion == null)) return null;
  return (
    <div className="mt-4 flex flex-col items-start gap-3 [&>[role=alert]]:self-stretch [&>[role=status]]:self-stretch">
      <NoticeLine notice={commands.notice} />
      {refundable && expectedVersion != null ? (
        <>
          <Button
            variant="outline"
            loading={commands.refundPending}
            onClick={() => setOpen(true)}
          >
            {t("refund")}
          </Button>
          <RefundConfirm
            open={open}
            onOpenChange={(next) => !commands.pending && setOpen(next)}
            payment={payment}
            pending={commands.refundPending}
            onConfirm={async () => {
              const outcome = await commands.requestRefund({
                paymentId: payment.paymentId,
                amountKrw: payment.amountKrw,
                expectedVersion,
              });
              if (outcome !== "failed") setOpen(false);
            }}
          />
        </>
      ) : null}
    </div>
  );
}

/** 세금계산서는 화면을 만들지 않는다 — 기존 문의·피드백 창으로 받는다. */
function TaxInvoiceLine() {
  const t = useTranslations("billing.payment");
  const [open, setOpen] = useState(false);
  return (
    <p className="text-xs leading-5 text-[var(--el-muted)]">
      {t.rich("taxInvoice", {
        link: (chunks) => (
          <button
            type="button"
            className="underline underline-offset-2 hover:text-[var(--el-ink)]"
            onClick={() => setOpen(true)}
          >
            {chunks}
          </button>
        ),
      })}
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </p>
  );
}

function Row({
  label,
  value,
  wrap,
}: {
  label: string;
  value: React.ReactNode;
  wrap?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-[var(--el-muted)]">{label}</dt>
      <dd
        className={
          wrap
            ? "text-right text-[var(--el-ink)]"
            : "whitespace-nowrap text-right text-[var(--el-ink)]"
        }
      >
        {value}
      </dd>
    </div>
  );
}
