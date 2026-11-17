"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/lib/ui/toast";

import type {
  ApprovalDecision,
  ChatStreamPhase,
  ChatStreamState,
} from "@/lib/chat/stream-protocol";
import type {
  ApprovalCardData,
  ApprovalCardStatus,
} from "@/lib/chat/approval-card";

type EndedStatus = Extract<ApprovalCardStatus, { kind: "invalid" | "check" }>;

export type PendingApprovalCard = {
  summary: string | null;
  card: ApprovalCardData | null;
  status:
    | Extract<ApprovalCardStatus, { kind: "open" | "submitted" }>
    | EndedStatus;
};

const TERMINAL_REASON = {
  APPROVAL_NOT_FOUND: "notFound",
  AGENT_CHAT_NOT_FOUND: "chatNotFound",
  NOT_APPROVAL_OWNER: "notOwner",
} as const;

function terminalReason(code: string) {
  return code in TERMINAL_REASON
    ? TERMINAL_REASON[code as keyof typeof TERMINAL_REASON]
    : null;
}

type Pending = {
  approvalId: string;
  tool: string;
  summary: string | null;
  card: ApprovalCardData | null;
} | null;
type Invalidation = {
  approvalId: string;
  approval: NonNullable<Pending>;
  status: EndedStatus;
};

function isAbnormalEnd(phase: ChatStreamPhase): boolean {
  return phase === "failed" || phase === "cancelled";
}

export function useToolApproval({
  pending,
  streamPhase,
  resolve,
}: {
  pending: Pending;
  streamPhase: ChatStreamPhase;
  resolve: (
    approvalId: string,
    decision: ApprovalDecision
  ) => Promise<ChatStreamState["error"]>;
}): {
  approve: (decision: ApprovalDecision) => void;
  card: PendingApprovalCard | null;
} {
  const t = useTranslations("chat");
  const [submitted, setSubmitted] = useState<{
    approvalId: string;
    decision: ApprovalDecision;
  } | null>(null);
  const submittedId = submitted?.approvalId ?? null;
  const [invalidation, setInvalidation] = useState<Invalidation | null>(null);
  const [trackedPending, setTrackedPending] = useState<Pending>(null);
  const pendingRef = useRef<Pending>(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  if (pending) {
    if (pending !== trackedPending) setTrackedPending(pending);
    if (invalidation && invalidation.approvalId !== pending.approvalId) {
      setInvalidation(null);
    }
  } else if (trackedPending && isAbnormalEnd(streamPhase) && !invalidation) {
    setInvalidation({
      approvalId: trackedPending.approvalId,
      approval: trackedPending,
      status:
        submitted?.approvalId === trackedPending.approvalId &&
        submitted.decision === "APPROVED"
          ? { kind: "check" }
          : { kind: "invalid", reason: t("approval.reasons.ended") },
    });
  } else if (!isAbnormalEnd(streamPhase)) {
    if (streamPhase === "streaming" && invalidation) setInvalidation(null);
    if (trackedPending) setTrackedPending(null);
  }

  const approve = useCallback(
    (decision: ApprovalDecision) => {
      const target = pending;
      if (!target) return;
      setSubmitted({ approvalId: target.approvalId, decision });
      void resolve(target.approvalId, decision).then((error) => {
        if (!error) return;
        if (pendingRef.current?.approvalId !== target.approvalId) return;
        const terminal = terminalReason(error.code);
        if (terminal) {
          setInvalidation({
            approvalId: target.approvalId,
            approval: target,
            status: {
              kind: "invalid",
              reason: t(`approval.reasons.${terminal}`),
            },
          });
          return;
        }
        setSubmitted(null);
        toast.error(error.message || t("errors.approvalFailed"));
      });
    },
    [pending, resolve, t]
  );

  let card: PendingApprovalCard | null = null;
  if (
    invalidation &&
    (!pending || pending.approvalId === invalidation.approvalId)
  ) {
    card = {
      summary: invalidation.approval.summary,
      card: invalidation.approval.card,
      status: invalidation.status,
    };
  } else if (pending) {
    card = {
      summary: pending.summary,
      card: pending.card,
      status:
        submittedId === pending.approvalId
          ? { kind: "submitted" }
          : { kind: "open" },
    };
  }

  return { approve, card };
}
