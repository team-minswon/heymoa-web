"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/ui/toast";

import type {
  ApprovalDecision,
  ChatStreamPhase,
  ChatStreamState,
} from "@/lib/chat/stream-protocol";
import {
  type ApprovalCardData,
  type ApprovalCardStatus,
  ENDED_REASON,
  UNKNOWN_REASON,
} from "@/lib/chat/approval-card";

/** 결정 전 카드가 지날 수 있는 상태. 확정은 스트림이 한다 — 결정된 블록이 제자리에 카드로 선다. */
type EndedStatus = Extract<ApprovalCardStatus, { kind: "invalid" | "check" }>;

/** 스레드가 그릴 승인 카드. pending이 사라진 뒤에도 무효화 카드를 남기려고 훅이 소유한다. */
export type PendingApprovalCard = {
  summary: string | null;
  card: ApprovalCardData | null;
  status:
    | Extract<ApprovalCardStatus, { kind: "open" | "submitted" }>
    | EndedStatus;
};

/**
 * 다시 눌러도 소용없는 종료 오류와 그 사유. `AGENT_CHAT_CAPACITY_EXCEEDED`(503)는 잠시 뒤
 * 다시 누르면 되므로 여기 없다.
 */
const TERMINAL_REASON: Record<string, string> = {
  // 승인 만료는 없다. 404 는 이미 처리됐거나 그 턴이 승인 대기가 아닌 것이다.
  APPROVAL_NOT_FOUND: "이미 처리됐거나 지나간 승인입니다.",
  AGENT_CHAT_NOT_FOUND: "대화를 찾을 수 없어 처리할 수 없습니다.",
  NOT_APPROVAL_OWNER: "이 승인은 요청한 사람만 처리할 수 있습니다.",
};

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

/**
 * 승인을 기다리던 스트림이 답 없이 끝났나. 정상 `done` 이면 승인은 이미 확정돼 `pending` 이
 * 지워진 뒤다.
 */
function isAbnormalEnd(phase: ChatStreamPhase): boolean {
  return phase === "failed" || phase === "cancelled";
}

/**
 * 승인 상태 기계. approve 는 결과를 낙관적으로 뒤집지 않고 `submitted` 로만 간다 — 확정은
 * 재접속한 스트림의 `tool_approval_resolved` 가 `pending` 을 지우며 반영한다.
 *
 * 무효화 입구는 둘이다: 종료 오류(403/404)와, 승인 대기 중 스트림이 비정상 종료해 `pending`
 * 이 사라지는 것. 후자를 위해 직전 승인을 붙잡아 둔다.
 *
 * 보내기는 주입된 `resolve` 가 한다. 실패면 사유를, 성공이면 null 을 돌려준다.
 */
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
  const [submitted, setSubmitted] = useState<{
    approvalId: string;
    decision: ApprovalDecision;
  } | null>(null);
  const submittedId = submitted?.approvalId ?? null;
  const [invalidation, setInvalidation] = useState<Invalidation | null>(null);
  // 비정상 종료면 `pending` 이 이미 null 이라 직전 값을 붙잡아 무효화 카드로 남긴다.
  const [trackedPending, setTrackedPending] = useState<Pending>(null);
  // 비동기 콜백에서는 클로저의 pending 이 낡으므로 ref 로 최신 값을 본다.
  const pendingRef = useRef<Pending>(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // 렌더 중에 이전 상태와 비교해 조정한다. 각 set 은 조건을 곧 거짓으로 만들어 루프 없이 수렴한다.
  if (pending) {
    if (pending !== trackedPending) setTrackedPending(pending);
    if (invalidation && invalidation.approvalId !== pending.approvalId) {
      setInvalidation(null); // 새 승인이 왔다.
    }
  } else if (trackedPending && isAbnormalEnd(streamPhase) && !invalidation) {
    // 승인을 기다리다 스트림이 비정상 종료했다.
    setInvalidation({
      approvalId: trackedPending.approvalId,
      approval: trackedPending,
      status:
        submitted?.approvalId === trackedPending.approvalId &&
        submitted.decision === "APPROVED"
          ? { kind: "check", reason: UNKNOWN_REASON }
          : { kind: "invalid", reason: ENDED_REASON },
    });
  } else if (!isAbnormalEnd(streamPhase)) {
    // 새 턴이 시작됐거나, 결정이 적혀 대기가 걷혔다(202 뒤). 결정된 블록이 제자리에 카드로 서므로
    // 붙잡아 둘 것이 없다 — 붙잡아 두면 뒤이은 실패가 같은 승인을 무효 카드로 한 번 더 세운다.
    if (streamPhase === "streaming" && invalidation) setInvalidation(null);
    if (trackedPending) setTrackedPending(null);
  }

  const approve = useCallback(
    (decision: ApprovalDecision) => {
      const target = pending;
      if (!target) return;
      // 보내기 전에 잠근다. 확정은 재접속한 스트림이 하고, 그 사이 잠그지 않으면 결정이 중복된다.
      setSubmitted({ approvalId: target.approvalId, decision });
      void resolve(target.approvalId, decision).then((error) => {
        if (!error) return;
        // 스트림이 먼저 확정했으면 늦게 온 오류다. 죽은 카드를 되살리거나 헛토스트를 띄우지 않는다.
        if (pendingRef.current?.approvalId !== target.approvalId) return;
        if (error.code in TERMINAL_REASON) {
          // 다시 눌러도 같은 오류라 카드를 무효화한다.
          setInvalidation({
            approvalId: target.approvalId,
            approval: target,
            status: { kind: "invalid", reason: TERMINAL_REASON[error.code] },
          });
          return;
        }
        // 재시도할 수 있는 실패다. 잠금을 풀고, 그릴 인라인 자리가 없어 토스트한다.
        setSubmitted(null);
        toast.error(error.message || "승인을 처리하지 못했습니다.");
      });
    },
    [pending, resolve]
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
