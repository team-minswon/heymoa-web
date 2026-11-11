import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  getGetBillingPaymentQueryKey,
  getGetMyBillingPaymentsQueryKey,
  useCancelBillingSubscription,
  useDeleteBillingPaymentMethod,
  useRequestBillingRefund,
  useResumeBillingSubscription,
} from "@/lib/api/generated/billing/billing";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { ApiError } from "@/lib/api/fetcher";
import { billingEvents } from "@/lib/billing/analytics";
import { refundPending } from "@/lib/billing/payment-status";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { createRequestKey } from "@/lib/billing/request-key";

/**
 * 화면이 자리에 그리는 결과. 지속 상태라 토스트가 아니라 인라인이다(rule `error-loading`).
 * `refundNotAllowed` 는 조건이 정책 미정이라 서버 문구(`message`)를 그대로 쓴다.
 */
export type CommandNotice =
  | { kind: "stateChanged" | "inProgress" | "notPayer" | "methodInUse" }
  | { kind: "refundNotAllowed"; message: string }
  | { kind: "canceled" | "resumed" };

/** 결과: 성공·화면이 인라인으로 그린 실패(둘 다 확인 창을 닫는다)·그 밖의 실패(토스트가 떴고 확인 창은 그대로). */
type Outcome = "done" | "handled" | "failed";

const INLINE_CODES = [
  "BILLING_STATE_CHANGED",
  "BILLING_IN_PROGRESS",
  "BILLING_REFUND_NOT_ALLOWED",
  "BILLING_METHOD_IN_USE",
  "WORKSPACE_ACCESS_DENIED",
];
const inline = { mutation: { meta: { suppressErrorToast: INLINE_CODES } } };

/**
 * 구매 이후의 명령(해지·재개·환불·카드 삭제). requestKey 는 명령마다 하나이고 성공하거나 화면이 본 상태가 바뀌면(409) 새로 만든다 —
 * 네트워크 실패 뒤 다시 누르면 같은 키가 나간다(`createRequestKey`). 성공하면 그 공간의 결제 조회를 다시 읽는다.
 * `BILLING_STATE_CHANGED` 는 최신 상태를 다시 읽고 다시 확인하게 한다.
 */
export function useBillingCommands(workspaceId: string) {
  const queryClient = useQueryClient();
  const keys = useRef({
    cancel: createRequestKey(),
    resume: createRequestKey(),
    refund: createRequestKey(),
  }).current;
  const [notice, setNotice] = useState<CommandNotice | null>(null);
  const cancel = useCancelBillingSubscription(inline);
  const resume = useResumeBillingSubscription(inline);
  const refund = useRequestBillingRefund(inline);
  const remove = useDeleteBillingPaymentMethod(inline);

  const refresh = (paymentId?: string) =>
    Promise.all([
      invalidateWorkspaceBilling(queryClient, workspaceId),
      queryClient.invalidateQueries({
        queryKey: getGetMyBillingPaymentsQueryKey(),
      }),
      paymentId
        ? queryClient.invalidateQueries({
            queryKey: getGetBillingPaymentQueryKey(workspaceId, paymentId),
          })
        : null,
    ]);

  const run = async (
    key: ReturnType<typeof createRequestKey> | null,
    command: (requestKey: string) => Promise<unknown>,
    onError: (code: string | null, error: unknown) => CommandNotice | null,
    success: CommandNotice | null,
    paymentId?: string
  ): Promise<Outcome> => {
    setNotice(null);
    try {
      await command(key?.current() ?? "");
      key?.renew();
      setNotice(success);
      await refresh(paymentId);
      return "done";
    } catch (error) {
      const code = errorCodeOf(error);
      if (code === "REQUEST_KEY_CONFLICT") key?.renew();
      const handled =
        code === "BILLING_STATE_CHANGED"
          ? ({ kind: "stateChanged" } as const)
          : code === "BILLING_IN_PROGRESS"
            ? ({ kind: "inProgress" } as const)
            : onError(code, error);
      if (!handled) return "failed";
      key?.renew();
      setNotice(handled);
      await refresh(paymentId);
      return "handled";
    }
  };

  return {
    notice,
    clearNotice: () => setNotice(null),
    pending:
      cancel.isPending ||
      resume.isPending ||
      refund.isPending ||
      remove.isPending,
    cancelPending: cancel.isPending,
    resumePending: resume.isPending,
    refundPending: refund.isPending,
    removePending: remove.isPending,

    cancelSubscription: async (expectedVersion: number) => {
      const outcome = await run(
        keys.cancel,
        (requestKey) =>
          cancel.mutateAsync({
            workspaceId,
            data: { requestKey, expectedVersion },
          }),
        () => null,
        { kind: "canceled" }
      );
      if (outcome === "done") billingEvents.subscriptionCanceled(workspaceId);
      return outcome;
    },

    resumeSubscription: (expectedVersion: number) =>
      run(
        keys.resume,
        (requestKey) =>
          resume.mutateAsync({
            workspaceId,
            data: { requestKey, expectedVersion },
          }),
        // 재개는 결제자 본인만 한다 — 아니면 403 이다.
        (_code, error) => {
          if (!(error instanceof ApiError && error.status === 403)) return null;
          billingEvents.subscriptionResumed(workspaceId, "not_payer");
          return { kind: "notPayer" };
        },
        { kind: "resumed" }
      ).then((outcome) => {
        if (outcome === "done")
          billingEvents.subscriptionResumed(workspaceId, "resumed");
        return outcome;
      }),

    requestRefund: async (payment: {
      paymentId: string;
      amountKrw: number;
      expectedVersion: number;
    }) => {
      const outcome = await run(
        keys.refund,
        (requestKey) =>
          refund.mutateAsync({
            workspaceId,
            paymentId: payment.paymentId,
            data: {
              requestKey,
              amountKrw: payment.amountKrw,
              expectedVersion: payment.expectedVersion,
            },
          }),
        (code, error) => {
          if (code !== "BILLING_REFUND_NOT_ALLOWED") return null;
          billingEvents.refundRequested(workspaceId, "not_allowed");
          return {
            kind: "refundNotAllowed",
            message: errorMessageOf(error, ""),
          };
        },
        null,
        payment.paymentId
      );
      if (outcome === "done")
        billingEvents.refundRequested(workspaceId, "accepted");
      return outcome;
    },

    deleteMethod: async (methodId: string) => {
      const outcome = await run(
        null,
        () => remove.mutateAsync({ workspaceId, methodId }),
        (code) => {
          if (code !== "BILLING_METHOD_IN_USE") return null;
          billingEvents.paymentMethodDeleted(workspaceId, "in_use");
          return { kind: "methodInUse" };
        },
        // 성공 안내는 화면이 띄운다 — 카드가 없어지면 관리 영역이 사라질 수 있다.
        null
      );
      if (outcome === "done")
        billingEvents.paymentMethodDeleted(workspaceId, "deleted");
      return outcome;
    },
  };
}

/** 이 화면에서 취소 처리 중을 본 뒤 끝난 결과가 보이면 한 번 낸다. 처음부터 끝난 취소는 세지 않는다. */
export function useRefundResultEvent(
  workspaceId: string,
  refundStatus: string | null | undefined,
  enabled = true
) {
  const sawPending = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    if (refundPending(refundStatus)) {
      sawPending.current = true;
      return;
    }
    if (!sawPending.current) return;
    if (refundStatus === "SUCCEEDED" || refundStatus === "FAILED") {
      sawPending.current = false;
      billingEvents.refundResulted(
        workspaceId,
        refundStatus === "SUCCEEDED" ? "succeeded" : "failed"
      );
    }
  }, [workspaceId, refundStatus, enabled]);
}
