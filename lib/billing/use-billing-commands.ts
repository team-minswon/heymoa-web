import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  getGetMyBillingPaymentsQueryKey,
  useCancelBillingSubscription,
  useDeleteBillingPaymentMethod,
  useResumeBillingSubscription,
} from "@/lib/api/generated/billing/billing";
import { errorCodeOf } from "@/lib/api/error-message";
import { ApiError } from "@/lib/api/fetcher";
import { billingEvents } from "@/lib/billing/analytics";
import { refundPending } from "@/lib/billing/payment-status";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { createRequestKey } from "@/lib/billing/request-key";

/** 화면이 자리에 그리는 결과. 지속 상태라 토스트가 아니라 인라인이다(rule `error-loading`). */
export type CommandNotice = {
  kind:
    | "stateChanged"
    | "inProgress"
    | "notAdmin"
    | "methodInUse"
    | "canceled"
    | "resumed";
};

/** 결과: 성공·화면이 인라인으로 그린 실패(둘 다 확인 창을 닫는다)·그 밖의 실패(토스트가 떴고 확인 창은 그대로). */
type Outcome = "done" | "handled" | "failed";

const INLINE_CODES = [
  "BILLING_STATE_CHANGED",
  "BILLING_IN_PROGRESS",
  "BILLING_METHOD_IN_USE",
  "WORKSPACE_ACCESS_DENIED",
];
const inline = { mutation: { meta: { suppressErrorToast: INLINE_CODES } } };

/**
 * 구매 이후의 명령(해지·재개·카드 삭제). 환불은 문의로만 받는다. requestKey 는 명령마다 하나이고 성공하거나 화면이 본 상태가 바뀌면(409) 새로 만든다 —
 * 네트워크 실패 뒤 다시 누르면 같은 키가 나간다(`createRequestKey`). 성공하면 그 공간의 결제 조회를 다시 읽는다.
 * `BILLING_STATE_CHANGED` 는 최신 상태를 다시 읽고 다시 확인하게 한다.
 */
export function useBillingCommands(workspaceId: string) {
  const queryClient = useQueryClient();
  const keys = useRef({
    cancel: createRequestKey(),
    resume: createRequestKey(),
  }).current;
  const [notice, setNotice] = useState<CommandNotice | null>(null);
  const cancel = useCancelBillingSubscription(inline);
  const resume = useResumeBillingSubscription(inline);
  const remove = useDeleteBillingPaymentMethod(inline);

  const refresh = () =>
    Promise.all([
      invalidateWorkspaceBilling(queryClient, workspaceId),
      queryClient.invalidateQueries({
        queryKey: getGetMyBillingPaymentsQueryKey(),
      }),
    ]);

  const run = async (
    key: ReturnType<typeof createRequestKey> | null,
    command: (requestKey: string) => Promise<unknown>,
    onError: (code: string | null, error: unknown) => CommandNotice | null,
    success: CommandNotice | null
  ): Promise<Outcome> => {
    setNotice(null);
    try {
      await command(key?.current() ?? "");
      key?.renew();
      setNotice(success);
      await refresh();
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
      await refresh();
      return "handled";
    }
  };

  return {
    notice,
    clearNotice: () => setNotice(null),
    pending: cancel.isPending || resume.isPending || remove.isPending,
    cancelPending: cancel.isPending,
    resumePending: resume.isPending,
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
        // 재개는 관리자 누구나 한다 — 관리자가 아니면 403 이다.
        (_code, error) => {
          if (!(error instanceof ApiError && error.status === 403)) return null;
          billingEvents.subscriptionResumed(workspaceId, "not_admin");
          return { kind: "notAdmin" };
        },
        { kind: "resumed" }
      ).then((outcome) => {
        if (outcome === "done")
          billingEvents.subscriptionResumed(workspaceId, "resumed");
        return outcome;
      }),

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
