"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { BackLink } from "@/components/billing/back-link";
import { BillingNotice } from "@/components/billing/billing-parts";
import {
  NoticeLine,
  PaymentStatusText,
  RefundConfirm,
} from "@/components/billing/subscription-management";
import {
  SETTINGS_LIST,
  SettingsHeader,
} from "@/components/settings/settings-layout";
import { Button } from "@/components/ui/button";
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
 * 설정 › 결제 관리에서 한 단계 들어간 결제 한 건(ADMIN). 금액·기간·상태·카드·환불 상태와 출처를 보인다.
 * 환불됐거나 기간이 끝난 옛 결제는 「당시 결과」와 「현재 상태」를 갈라 적는다 — 옛 성공을 지금 권한처럼 읽히게 하지 않는다.
 * 환불 버튼은 서버가 `REQUEST_REFUND` 를 주고 이 결제가 지금 유료 기간의 결제일 때만이다.
 */
export function BillingPaymentDetail({
  workspaceId,
  paymentId,
  onBack,
}: {
  workspaceId: string;
  paymentId: string;
  onBack: () => void;
}) {
  const t = useTranslations("billing.payment");
  useEffect(() => {
    billingEvents.paymentViewed(workspaceId);
  }, [workspaceId]);
  return (
    <div>
      <BackLink onClick={onBack}>{t("back")}</BackLink>
      <SettingsHeader title={t("title")} description={t("description")} />
      <PaymentContent workspaceId={workspaceId} paymentId={paymentId} />
    </div>
  );
}

const HERO = "flex flex-wrap items-baseline gap-x-3 gap-y-1";
const ROW =
  "flex min-h-[52px] items-center justify-between gap-4 px-4 py-2.5 text-sm";
const SKELETON_ROWS = 4;

function PaymentSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} className="flex flex-col gap-6">
      <div>
        <div className={HERO}>
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="mt-2 h-5 w-56" />
      </div>
      <div className={SETTINGS_LIST}>
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <div key={index} className={ROW}>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
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

  if (query.isPending) return <PaymentSkeleton label={t("loading")} />;
  if (!payment) {
    const status = query.error instanceof ApiError ? query.error.status : null;
    return status === 404 || status === 403 ? (
      <BillingNotice tone="warn">
        {status === 404 ? t("notFound") : t("askAdmin")}
      </BillingNotice>
    ) : (
      <InlineRetry
        onRetry={() => void query.refetch()}
        label={t("loadFailed")}
      />
    );
  }
  const current = billing.detail?.currentPaymentId === paymentId;
  return (
    <div className="flex flex-col gap-6">
      <PaymentHero payment={payment} />
      <PaymentRows payment={payment} current={current} />
      <RefundArea
        workspaceId={workspaceId}
        payment={payment}
        refundable={
          current && billing.allowedActions.includes("REQUEST_REFUND")
        }
        expectedVersion={billing.detail?.subscriptionVersion ?? null}
      />
      <TaxInvoiceLine />
    </div>
  );
}

/** 얼마를 언제 무엇으로 냈는가 — 한눈에 읽는 줄. */
function PaymentHero({ payment }: { payment: BillingPaymentResponseData }) {
  const t = useTranslations("billing.payment");
  const format = useBillingFormat();
  return (
    <div>
      <p className={HERO}>
        <span className="text-[36px] leading-10 font-light tracking-[-0.035em] text-[var(--el-ink)]">
          {format.money(payment.amountKrw)}
        </span>
        <span className="text-sm">
          <PaymentStatusText payment={payment} />
        </span>
      </p>
      <p className="mt-2 text-sm leading-5 text-[var(--el-muted)]">
        {[
          payment.completedAt ? format.dateTime(payment.completedAt) : null,
          t(`kindValue.${payment.kind}`),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
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
    <dl className={SETTINGS_LIST}>
      <Row label={t("workspace")} value={payment.workspaceName} />
      {payment.period ? (
        <Row label={t("period")} value={format.period(payment.period)} />
      ) : null}
      {card ? <Row label={t("card")} value={card} /> : null}
      {now ? (
        <>
          <Row label={t("then")} value={t("thenPaid")} />
          <Row label={t("now")} value={now} wrap />
        </>
      ) : null}
      {payment.errorCode ? (
        <Row
          label={t("status")}
          value={t("errorCode", { code: payment.errorCode })}
        />
      ) : null}
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
    <div className="flex flex-col items-start gap-3 [&>[role=alert]]:self-stretch [&>[role=status]]:self-stretch">
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
    <div className={ROW}>
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
