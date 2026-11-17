import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import {
  getGetMyBillingPaymentsQueryKey,
  useCancelBillingSubscription,
  useDeleteBillingPaymentMethod,
  useResumeBillingSubscription,
} from "@/lib/api/generated/billing/billing";
import { errorCodeOf } from "@/lib/api/error-message";
import { billingEvents } from "@/lib/billing/analytics";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { createRequestKey } from "@/lib/billing/request-key";

export type CommandNotice = {
  kind:
    | "stateChanged"
    | "inProgress"
    | "notAdmin"
    | "methodInUse"
    | "canceled"
    | "resumed";
};

type Outcome = "done" | "handled" | "failed";

const INLINE_CODES = [
  "BILLING_STATE_CHANGED",
  "BILLING_PAYMENT_METHOD_NOT_FOUND",
  "BILLING_IN_PROGRESS",
  "BILLING_METHOD_IN_USE",
  "WORKSPACE_ACCESS_DENIED",
];
const inline = { mutation: { meta: { suppressErrorToast: INLINE_CODES } } };

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
    onError: (code: string | null) => CommandNotice | null,
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
        code === "BILLING_STATE_CHANGED" ||
        code === "BILLING_PAYMENT_METHOD_NOT_FOUND"
          ? ({ kind: "stateChanged" } as const)
          : code === "BILLING_IN_PROGRESS"
            ? ({ kind: "inProgress" } as const)
            : (onError(code) ??
              (code === "WORKSPACE_ACCESS_DENIED"
                ? ({ kind: "notAdmin" } as const)
                : null));
      if (!handled) return "failed";
      key?.renew();
      setNotice(handled);
      await refresh();
      return "handled";
    }
  };

  return {
    notice,
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
        (code) => {
          if (code === "WORKSPACE_ACCESS_DENIED")
            billingEvents.subscriptionResumed(workspaceId, "not_admin");
          return null;
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
        null
      );
      if (outcome === "done")
        billingEvents.paymentMethodDeleted(workspaceId, "deleted");
      return outcome;
    },
  };
}
